#!/usr/bin/env node
/**
 * abc-kak-client.js
 *
 * Socket client for communicating with the ABC LSP server from Kakoune.
 * Handles UTF-16/byte offset conversion between LSP and Kakoune.
 *
 * Usage:
 *   abc-kak-client.js [options]
 *
 * Options:
 *   --socket=PATH         Unix socket path (required)
 *   --uri=URI             Document URI (required)
 *   --selector=NAME       Selector name (use for selector operations)
 *   --transform=NAME      Transform name (use for transform operations)
 *   --args=JSON           Selector/transform arguments as JSON array (default: [])
 *   --ranges=DESC         Kakoune selection descriptors, space-separated (optional)
 *   --buffer-file=PATH    Path to temp file containing buffer content (required)
 *   --timeout=MS          Request timeout in milliseconds (default: 5000)
 *
 * Selector mode output (on success, exit 0):
 *   Line 1: space-separated Kakoune selection descriptors
 *
 * Transform mode output (on success, exit 0):
 *   Lines: replacement text (entire buffer content after transform)
 *
 * Output (on error, exit 1):
 *   stderr: error message
 */

const net = require("net");
const fs = require("fs");
const readline = require("readline");

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs() {
  const args = {
    socket: null,
    uri: null,
    selector: null,
    transform: null,
    args: [],
    ranges: "",
    bufferFile: null,
    timeout: 5000,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--socket=")) {
      args.socket = arg.substring("--socket=".length);
    } else if (arg.startsWith("--uri=")) {
      args.uri = arg.substring("--uri=".length);
    } else if (arg.startsWith("--selector=")) {
      args.selector = arg.substring("--selector=".length);
    } else if (arg.startsWith("--transform=")) {
      args.transform = arg.substring("--transform=".length);
    } else if (arg.startsWith("--args=")) {
      try {
        args.args = JSON.parse(arg.substring("--args=".length));
      } catch {
        error("Invalid JSON in --args");
      }
    } else if (arg.startsWith("--ranges=")) {
      args.ranges = arg.substring("--ranges=".length);
    } else if (arg.startsWith("--buffer-file=")) {
      args.bufferFile = arg.substring("--buffer-file=".length);
    } else if (arg.startsWith("--timeout=")) {
      args.timeout = parseInt(arg.substring("--timeout=".length), 10);
    }
  }

  if (!args.socket) {
    error("Missing required --socket argument");
  }
  if (!args.uri) {
    error("Missing required --uri argument");
  }
  if (!args.selector && !args.transform) {
    error("Missing required --selector or --transform argument");
  }
  if (args.selector && args.transform) {
    error("Cannot specify both --selector and --transform");
  }
  if (!args.bufferFile) {
    error("Missing required --buffer-file argument");
  }

  return args;
}

function error(message) {
  process.stderr.write(message + "\n");
  process.exit(1);
}

// ============================================================================
// Buffer Content and Line Lookup
// ============================================================================

/**
 * Reads the buffer file and returns an array of lines.
 * Lines are stored without line endings.
 */
function readBufferLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    // Split by \n, handling potential trailing newline
    const lines = content.split("\n");
    // If the last line is empty (file ends with \n), keep it for proper indexing
    return lines;
  } catch (err) {
    error(`Failed to read buffer file: ${err.message}`);
  }
}

// ============================================================================
// UTF-16 / Byte Offset Conversion
// ============================================================================

/**
 * Converts a UTF-16 code unit offset to a byte offset within a line.
 * Node.js strings are UTF-16 internally.
 */
function utf16ToByteOffset(line, utf16Offset) {
  // Handle edge cases
  if (utf16Offset <= 0) return 0;
  if (utf16Offset >= line.length) {
    return Buffer.byteLength(line, "utf8");
  }

  // Slice to the UTF-16 position and get byte length
  const prefix = line.slice(0, utf16Offset);
  return Buffer.byteLength(prefix, "utf8");
}

/**
 * Converts a byte offset to a UTF-16 code unit offset within a line.
 */
function byteToUtf16Offset(line, byteOffset) {
  if (byteOffset <= 0) return 0;

  const lineBytes = Buffer.from(line, "utf8");
  if (byteOffset >= lineBytes.length) {
    return line.length;
  }

  // Decode the prefix up to the byte offset
  const prefixBytes = lineBytes.slice(0, byteOffset);
  const prefix = prefixBytes.toString("utf8");
  return prefix.length;
}

// ============================================================================
// Kakoune Descriptor Parsing and Generation
// ============================================================================

/**
 * Parses a Kakoune selection descriptor into start/end positions.
 * Format: "line.col,line.col" where both are 1-indexed and col is byte offset.
 * Returns { startLine, startCol, endLine, endCol } with 0-indexed line and 1-indexed byte columns.
 */
function parseKakDescriptor(desc) {
  const [startPart, endPart] = desc.split(",");
  const [startLine, startCol] = startPart.split(".").map((n) => parseInt(n, 10));
  const [endLine, endCol] = endPart.split(".").map((n) => parseInt(n, 10));

  return {
    startLine: startLine - 1, // Convert to 0-indexed
    startCol, // Keep 1-indexed byte offset
    endLine: endLine - 1,
    endCol,
  };
}

/**
 * Normalizes a Kakoune descriptor so start <= end.
 * Kakoune can have backwards selections (anchor after cursor).
 */
function normalizeDescriptor(desc) {
  const parsed = parseKakDescriptor(desc);
  const startPos = parsed.startLine * 100000 + parsed.startCol;
  const endPos = parsed.endLine * 100000 + parsed.endCol;

  if (startPos <= endPos) {
    return parsed;
  }

  // Swap start and end
  return {
    startLine: parsed.endLine,
    startCol: parsed.endCol,
    endLine: parsed.startLine,
    endCol: parsed.startCol,
  };
}

/**
 * Converts a Kakoune descriptor to an LSP range.
 * Kakoune uses 1-indexed, byte offsets, inclusive end.
 * LSP uses 0-indexed, UTF-16 code unit offsets, exclusive end.
 */
function kakDescriptorToLspRange(desc, lines) {
  const { startLine, startCol, endLine, endCol } = normalizeDescriptor(desc);

  const startLineContent = lines[startLine] || "";
  const endLineContent = lines[endLine] || "";

  // Convert byte offset (1-indexed) to UTF-16 offset (0-indexed)
  // Kakoune's column is 1-indexed, so startCol=1 means first byte -> offset 0
  const startUtf16 = byteToUtf16Offset(startLineContent, startCol - 1);

  // Kakoune's end is inclusive, LSP's is exclusive
  // endCol is 1-indexed inclusive byte position
  // Convert to 0-indexed exclusive: add 1 byte then convert
  const endByteExclusive = endCol; // Already points to last included byte's position (1-indexed)
  const endUtf16 = byteToUtf16Offset(endLineContent, endByteExclusive);

  return {
    start: { line: startLine, character: startUtf16 },
    end: { line: endLine, character: endUtf16 },
  };
}

/**
 * Converts an LSP range to a Kakoune selection descriptor.
 * LSP uses 0-indexed, UTF-16 code unit offsets, exclusive end.
 * Kakoune uses 1-indexed, byte offsets, inclusive end.
 */
function lspRangeToKakDescriptor(range, lines) {
  const startLine = range.start.line;
  const endLine = range.end.line;

  const startLineContent = lines[startLine] || "";
  const endLineContent = lines[endLine] || "";

  // Convert UTF-16 offset to byte offset
  const startByte = utf16ToByteOffset(startLineContent, range.start.character);
  const endByte = utf16ToByteOffset(endLineContent, range.end.character);

  // Convert 0-indexed to 1-indexed
  const startCol = startByte + 1;

  // LSP end is exclusive, Kakoune is inclusive
  // If endByte is 0, the inclusive end is the last byte of the previous line
  let endCol;
  let adjustedEndLine = endLine;

  if (endByte === 0 && endLine > 0) {
    // End at column 0 means inclusive end is last byte of previous line
    adjustedEndLine = endLine - 1;
    const prevLineContent = lines[adjustedEndLine] || "";
    endCol = Buffer.byteLength(prevLineContent, "utf8");
    if (endCol === 0) endCol = 1; // Edge case: empty line
  } else if (endByte === 0) {
    // First line, column 0 - edge case
    endCol = 1;
  } else {
    // Normal case: subtract 1 to make inclusive
    endCol = endByte;
  }

  // Handle zero-width ranges (not representable in Kakoune)
  if (
    startLine === adjustedEndLine &&
    startCol > endCol
  ) {
    return null; // Skip this range
  }

  return `${startLine + 1}.${startCol},${adjustedEndLine + 1}.${endCol}`;
}

// ============================================================================
// Socket Communication
// ============================================================================

function sendRequest(socketPath, request, timeout) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath, () => {
      client.write(JSON.stringify(request) + "\n");
    });

    const rl = readline.createInterface({
      input: client,
      crlfDelay: Infinity,
    });

    const timeoutId = setTimeout(() => {
      rl.close();
      client.destroy();
      reject(new Error("Request timeout"));
    }, timeout);

    rl.once("line", (line) => {
      clearTimeout(timeoutId);
      rl.close();
      client.destroy();
      try {
        resolve(JSON.parse(line));
      } catch {
        reject(new Error("Invalid JSON response"));
      }
    });

    client.on("error", (err) => {
      clearTimeout(timeoutId);
      rl.close();
      if (err.code === "ENOENT") {
        reject(new Error("ABC LSP server not running (socket not found)"));
      } else if (err.code === "ECONNREFUSED") {
        reject(new Error("ABC LSP server not responding"));
      } else {
        reject(err);
      }
    });
  });
}

// ============================================================================
// Text Edit Application
// ============================================================================

/**
 * Applies LSP text edits to buffer content and returns the new content.
 * Edits are applied in reverse order (from end of document to start) to
 * preserve positions of earlier edits.
 */
function applyEdits(content, edits) {
  // Sort edits by position (descending) to apply from end to start
  const sortedEdits = [...edits].sort((a, b) => {
    if (b.range.start.line !== a.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });

  const lines = content.split("\n");

  for (const edit of sortedEdits) {
    const startLine = edit.range.start.line;
    const endLine = edit.range.end.line;
    const startChar = edit.range.start.character;
    const endChar = edit.range.end.character;

    // Get the text before the edit range on the start line
    const startLineText = lines[startLine] || "";
    const prefix = startLineText.slice(0, startChar);

    // Get the text after the edit range on the end line
    const endLineText = lines[endLine] || "";
    const suffix = endLineText.slice(endChar);

    // Replace the affected lines with the new content
    const newLines = edit.newText.split("\n");
    newLines[0] = prefix + newLines[0];
    newLines[newLines.length - 1] = newLines[newLines.length - 1] + suffix;

    lines.splice(startLine, endLine - startLine + 1, ...newLines);
  }

  return lines.join("\n");
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs();
  const lines = readBufferLines(args.bufferFile);
  const bufferContent = lines.join("\n");

  // Convert kakoune selection descriptors to LSP ranges
  let lspRanges = [];
  if (args.ranges) {
    const descriptors = args.ranges.split(/\s+/).filter((d) => d);
    lspRanges = descriptors.map((desc) => kakDescriptorToLspRange(desc, lines));
  }

  let request;
  if (args.selector) {
    request = {
      id: 1,
      method: "abc.applySelector",
      params: {
        uri: args.uri,
        selector: args.selector,
        args: args.args,
        ranges: lspRanges,
      },
    };
  } else {
    request = {
      id: 1,
      method: "abc.applyTransform",
      params: {
        uri: args.uri,
        transform: args.transform,
        args: args.args,
        ranges: lspRanges,
      },
    };
  }

  let response;
  try {
    response = await sendRequest(args.socket, request, args.timeout);
  } catch (err) {
    error(err.message);
  }

  if (response.error) {
    error(response.error.message);
  }

  const result = response.result;

  if (args.selector) {
    // Selector mode: output ranges as Kakoune descriptors
    if (!result || !result.ranges || result.ranges.length === 0) {
      // No matches - output empty line for descriptors
      console.log("");
      process.exit(0);
    }

    // Convert LSP ranges to Kakoune descriptors
    const descriptors = result.ranges
      .map((range) => lspRangeToKakDescriptor(range, lines))
      .filter((desc) => desc !== null);

    if (descriptors.length === 0) {
      console.log("");
      process.exit(0);
    }

    // Output
    console.log(descriptors.join(" "));
  } else {
    // Transform mode: apply edits and output new buffer content
    if (!result || !result.edits || result.edits.length === 0) {
      // No changes - output original content
      process.stdout.write(bufferContent);
      process.exit(0);
    }

    const newContent = applyEdits(bufferContent, result.edits);
    process.stdout.write(newContent);
  }
}

main();
