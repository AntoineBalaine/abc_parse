import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { resolveSelectionRanges, findNodesInRange } from "./selectionRangeResolver";
import { lookupSelector, getAvailableSelectors } from "./selectorLookup";
import { lookupTransform } from "./transformLookup";
import { fromAst, createSelection, Selection, selectRange, CSNode, TAGS } from "editor";
import { File_structure } from "abc-parser";
import { AbcDocument } from "./AbcDocument";
import { AbcxDocument } from "./AbcxDocument";
import { AbctDocument } from "./AbctDocument";
import { serializeCSTree } from "./csTreeSerializer";
import { computeTextEditsFromDiff } from "./textEditFromDiff";

// ============================================================================
// Error Codes (JSON-RPC style)
// ============================================================================

export const ERROR_CODES = {
  DOCUMENT_NOT_FOUND: -32001,
  FILE_TYPE_NOT_SUPPORTED: -32002,
  INVALID_REQUEST: -32600,
  UNKNOWN_METHOD: -32601,
  INVALID_PARAMS: -32602,
};

// ============================================================================
// Types
// ============================================================================

interface LSPPosition {
  line: number;
  character: number;
}

interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

interface SocketRequest {
  id: number | string;
  method: string;
  params?: {
    uri?: string;
    selector?: string;
    transform?: string;
    args?: unknown[];
    /** Editor selections as ranges - used to scope the selector/transform operation */
    ranges?: LSPRange[];
  };
}

interface SelectorResult {
  ranges: LSPRange[];
}

interface TransformResult {
  edits: Array<{ range: LSPRange; newText: string }>;
}

interface SocketResponse {
  id: number | string;
  result?: SelectorResult | TransformResult;
  error?: {
    code: number;
    message: string;
  };
}

type DocumentGetter = (uri: string) => AbcDocument | AbcxDocument | AbctDocument | undefined;
type CsTreeGetter = (ast: File_structure) => CSNode;

// ============================================================================
// Socket Path Computation
// ============================================================================

/**
 * Computes the socket path using the same logic as the Kakoune plugin.
 * Priority order:
 *   1. $XDG_RUNTIME_DIR/abc-lsp.sock
 *   2. /tmp/abc-lsp-$USER/lsp.sock (fallback)
 */
export function computeSocketPath(): string {
  const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
  if (xdgRuntimeDir) {
    return path.join(xdgRuntimeDir, "abc-lsp.sock");
  }
  const user = process.env.USER || process.env.USERNAME || "unknown";
  return path.join("/tmp", `abc-lsp-${user}`, "lsp.sock");
}

/**
 * Ensures the parent directory for the socket exists with proper permissions.
 */
function ensureSocketDirectory(socketPath: string): void {
  const dir = path.dirname(socketPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Checks if a socket is stale by attempting to connect.
 * Returns true if the socket is stale (no server listening).
 */
function isSocketStale(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = net.createConnection(socketPath, () => {
      // Connection succeeded, another server is running
      client.destroy();
      resolve(false);
    });
    client.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED" || err.code === "ENOENT") {
        resolve(true);
      } else {
        // Some other error, treat as stale
        resolve(true);
      }
    });
    // Timeout after 1 second
    client.setTimeout(1000, () => {
      client.destroy();
      resolve(true);
    });
  });
}

/**
 * Safely unlinks a stale socket file after verifying ownership.
 */
function safeUnlink(socketPath: string): void {
  try {
    const stats = fs.statSync(socketPath);
    if (stats.uid === process.getuid?.()) {
      fs.unlinkSync(socketPath);
    }
  } catch {
    // File doesn't exist or can't stat, ignore
  }
}

// ============================================================================
// Input Validation
// ============================================================================

const VALID_URI_REGEX = /^file:\/\/[^?#]*$/;

function validateUri(uri: unknown): uri is string {
  if (typeof uri !== "string") return false;
  if (!VALID_URI_REGEX.test(uri)) return false;
  // Reject path traversal
  if (uri.includes("..")) return false;
  return true;
}

function validateRequest(request: unknown): SocketRequest {
  if (typeof request !== "object" || request === null) {
    throw { code: ERROR_CODES.INVALID_REQUEST, message: "Request must be an object" };
  }

  const req = request as Record<string, unknown>;

  if (req.id === undefined || req.id === null) {
    throw { code: ERROR_CODES.INVALID_REQUEST, message: "Request must have an id" };
  }

  if (typeof req.method !== "string") {
    throw { code: ERROR_CODES.INVALID_REQUEST, message: "Request must have a method string" };
  }

  return {
    id: req.id as number | string,
    method: req.method,
    params: req.params as SocketRequest["params"],
  };
}

function validateApplySelectorParams(params: SocketRequest["params"]): {
  uri: string;
  selector: string;
  args: (number | string)[];
  ranges: LSPRange[];
} {
  if (!params) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "Missing params" };
  }

  if (!validateUri(params.uri)) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "Invalid or missing URI" };
  }

  if (typeof params.selector !== "string") {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "Missing selector name" };
  }

  const availableSelectors = getAvailableSelectors();
  if (!availableSelectors.includes(params.selector)) {
    throw {
      code: ERROR_CODES.INVALID_PARAMS,
      message: `Unknown selector: "${params.selector}". Available: ${availableSelectors.join(", ")}`,
    };
  }

  if (params.args !== undefined) {
    if (!Array.isArray(params.args)) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: "args must be an array" };
    }
    if (!params.args.every((arg) => typeof arg === "number" || typeof arg === "string")) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: "args must be an array of numbers or strings" };
    }
  }

  if (params.ranges !== undefined && !Array.isArray(params.ranges)) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "ranges must be an array" };
  }

  return {
    uri: params.uri,
    selector: params.selector,
    args: params.args ?? [],
    ranges: params.ranges ?? [],
  };
}

function validateApplyTransformParams(params: SocketRequest["params"]): {
  uri: string;
  transform: string;
  args: unknown[];
  ranges: LSPRange[];
} {
  if (!params) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "Missing params" };
  }

  if (!validateUri(params.uri)) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "Invalid or missing URI" };
  }

  if (typeof params.transform !== "string") {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "Missing transform name" };
  }

  const transformFn = lookupTransform(params.transform);
  if (!transformFn) {
    throw {
      code: ERROR_CODES.INVALID_PARAMS,
      message: `Unknown transform: "${params.transform}"`,
    };
  }

  if (params.args !== undefined && !Array.isArray(params.args)) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "args must be an array" };
  }

  if (params.ranges !== undefined && !Array.isArray(params.ranges)) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "ranges must be an array" };
  }

  return {
    uri: params.uri,
    transform: params.transform,
    args: params.args ?? [],
    ranges: params.ranges ?? [],
  };
}

// ============================================================================
// Request Handler
// ============================================================================

function handleApplySelector(
  params: {
    uri: string;
    selector: string;
    args: (number | string)[];
    ranges: LSPRange[];
  },
  getDocument: DocumentGetter,
  getCsTree: CsTreeGetter
): SelectorResult {
  const doc = getDocument(params.uri);

  if (!doc) {
    throw { code: ERROR_CODES.DOCUMENT_NOT_FOUND, message: "Document not yet opened" };
  }

  if (doc instanceof AbcxDocument) {
    throw { code: ERROR_CODES.FILE_TYPE_NOT_SUPPORTED, message: "Selectors are not supported for ABCx files" };
  }

  if (doc instanceof AbctDocument) {
    throw { code: ERROR_CODES.FILE_TYPE_NOT_SUPPORTED, message: "Selectors are not supported for ABCT files" };
  }

  if (!(doc instanceof AbcDocument) || !doc.AST) {
    throw { code: ERROR_CODES.DOCUMENT_NOT_FOUND, message: "Document has no parsed AST" };
  }

  const root = getCsTree(doc.AST);
  const selectorFn = lookupSelector(params.selector);

  if (!selectorFn) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: `Unknown selector: "${params.selector}"` };
  }

  // Stateless approach: use provided ranges to create initial selection
  let selection: Selection;
  if (params.ranges.length > 0) {
    // Constrain to nodes within the provided ranges
    const allCursors: Set<number>[] = [];
    for (const range of params.ranges) {
      const baseSelection = createSelection(root);
      const narrowed = selectRange(
        baseSelection,
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character
      );
      allCursors.push(...narrowed.cursors);
    }
    if (allCursors.length === 0) {
      // No nodes found within the selection ranges
      return { ranges: [] };
    }
    selection = { root, cursors: allCursors };
  } else {
    // No selections: start from root (select entire document)
    selection = createSelection(root);
  }

  const newSelection = selectorFn(selection, ...params.args);
  const resultRanges = resolveSelectionRanges(newSelection);

  return { ranges: resultRanges };
}

/**
 * Map of transform names to the node tags they operate on.
 * Default is [Note, Chord] if not specified.
 */
const TRANSFORM_NODE_TAGS: Record<string, string[]> = {
  harmonize: [TAGS.Note, TAGS.Chord],
  consolidateRests: [TAGS.Rest],
  insertVoiceLine: [TAGS.Note, TAGS.Chord],
};

function handleApplyTransform(
  params: {
    uri: string;
    transform: string;
    args: unknown[];
    ranges: LSPRange[];
  },
  getDocument: DocumentGetter
): TransformResult {
  const doc = getDocument(params.uri);

  if (!doc) {
    throw { code: ERROR_CODES.DOCUMENT_NOT_FOUND, message: "Document not yet opened" };
  }

  if (doc instanceof AbcxDocument) {
    throw { code: ERROR_CODES.FILE_TYPE_NOT_SUPPORTED, message: "Transforms are not supported for ABCx files" };
  }

  if (doc instanceof AbctDocument) {
    throw { code: ERROR_CODES.FILE_TYPE_NOT_SUPPORTED, message: "Transforms are not supported for ABCT files" };
  }

  if (!(doc instanceof AbcDocument) || !doc.AST) {
    throw { code: ERROR_CODES.DOCUMENT_NOT_FOUND, message: "Document has no parsed AST" };
  }

  const transformFn = lookupTransform(params.transform);
  if (!transformFn) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: `Unknown transform: "${params.transform}"` };
  }

  // Build a fresh CSTree from the AST (transforms mutate in place)
  const root = fromAst(doc.AST);

  // Determine which node tags this transform operates on
  const tags = TRANSFORM_NODE_TAGS[params.transform] ?? [TAGS.Note, TAGS.Chord];

  // Convert each editor selection range to a cursor containing nodes of the appropriate type
  const allCursors: Set<number>[] = [];
  for (const range of params.ranges) {
    const nodeIds = findNodesInRange(root, range, tags);
    for (const id of nodeIds) {
      allCursors.push(new Set([id]));
    }
  }

  if (allCursors.length === 0) {
    // No nodes found within the selection ranges
    return { edits: [] };
  }

  const selection: Selection = { root, cursors: allCursors };

  // Apply transform (mutates tree in place)
  const newSelection = transformFn(selection, doc.ctx, ...params.args);

  // Serialize modified tree to text
  const newText = serializeCSTree(newSelection.root, doc.ctx);
  const oldText = doc.document.getText();

  // Compute minimal TextEdits using LCS-based diff
  const textEdits = computeTextEditsFromDiff(oldText, newText);

  // Convert TextEdit[] to the simpler format for socket response
  const edits = textEdits.map((edit) => ({
    range: edit.range,
    newText: edit.newText,
  }));

  return { edits };
}

// ============================================================================
// Socket Handler Class
// ============================================================================

export class SocketHandler {
  private server: net.Server | null = null;
  private socketPath: string;
  private getDocument: DocumentGetter;
  private getCsTree: CsTreeGetter;
  private isOwner = false;

  constructor(
    socketPath: string,
    getDocument: DocumentGetter,
    getCsTree: CsTreeGetter
  ) {
    this.socketPath = socketPath;
    this.getDocument = getDocument;
    this.getCsTree = getCsTree;
  }

  /**
   * Attempts to start the socket server using "first server wins" pattern.
   * Returns true if this server owns the socket, false if another server already has it.
   */
  async start(): Promise<boolean> {
    // Check if socket file exists
    if (fs.existsSync(this.socketPath)) {
      const stale = await isSocketStale(this.socketPath);
      if (!stale) {
        // Another server is running, skip socket creation
        console.error(`[abc-lsp] Socket ${this.socketPath} already in use by another server`);
        return false;
      }
      // Socket is stale, unlink it
      safeUnlink(this.socketPath);
    }

    ensureSocketDirectory(this.socketPath);

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleConnection(socket));

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.error(`[abc-lsp] Socket ${this.socketPath} already in use`);
          resolve(false);
        } else {
          reject(err);
        }
      });

      this.server.listen(this.socketPath, () => {
        this.isOwner = true;
        console.error(`[abc-lsp] Socket listening on ${this.socketPath}`);
        resolve(true);
      });
    });
  }

  private handleConnection(socket: net.Socket): void {
    const rl = readline.createInterface({
      input: socket,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      let request: SocketRequest;
      let response: SocketResponse;

      try {
        const parsed = JSON.parse(line);
        request = validateRequest(parsed);
      } catch (err) {
        if (err instanceof SyntaxError) {
          response = {
            id: 0,
            error: { code: ERROR_CODES.INVALID_REQUEST, message: "Invalid JSON" },
          };
        } else if (typeof err === "object" && err !== null && "code" in err) {
          response = {
            id: 0,
            error: err as { code: number; message: string },
          };
        } else {
          response = {
            id: 0,
            error: { code: ERROR_CODES.INVALID_REQUEST, message: String(err) },
          };
        }
        socket.write(JSON.stringify(response) + "\n");
        return;
      }

      try {
        let result: SelectorResult | TransformResult;

        if (request.method === "abct2.applySelector") {
          const validatedParams = validateApplySelectorParams(request.params);
          result = handleApplySelector(validatedParams, this.getDocument, this.getCsTree);
        } else if (request.method === "abct2.applyTransform") {
          const validatedParams = validateApplyTransformParams(request.params);
          result = handleApplyTransform(validatedParams, this.getDocument);
        } else {
          throw { code: ERROR_CODES.UNKNOWN_METHOD, message: `Unknown method: "${request.method}"` };
        }

        response = { id: request.id, result };
      } catch (err) {
        if (typeof err === "object" && err !== null && "code" in err) {
          response = {
            id: request.id,
            error: err as { code: number; message: string },
          };
        } else {
          response = {
            id: request.id,
            error: { code: ERROR_CODES.INVALID_REQUEST, message: String(err) },
          };
        }
      }

      socket.write(JSON.stringify(response) + "\n");
    });

    socket.on("error", (err) => {
      console.error("[abc-lsp] Socket client error:", err.message);
    });
  }

  /**
   * Stops the socket server and cleans up the socket file.
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.isOwner && fs.existsSync(this.socketPath)) {
      safeUnlink(this.socketPath);
    }
  }

  get isSocketOwner(): boolean {
    return this.isOwner;
  }
}
