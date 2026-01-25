import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { resolveSelectionRanges } from "./selectionRangeResolver";
import { lookupSelector, getAvailableSelectors } from "./selectorLookup";
import { fromAst } from "../../abct2/src/csTree/fromAst";
import { createSelection } from "../../abct2/src/selection";
import { CSNode } from "../../abct2/src/csTree/types";
import { File_structure } from "abc-parser";
import { AbcDocument } from "./AbcDocument";
import { AbcxDocument } from "./AbcxDocument";
import { AbctDocument } from "./AbctDocument";

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
    args?: (number | string)[];
    cursorNodeIds?: number[];
    scope?: LSPRange[];
  };
}

interface SocketResponse {
  id: number | string;
  result?: {
    ranges: LSPRange[];
    cursorNodeIds: number[];
  };
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
  cursorNodeIds: number[];
  scope: LSPRange[];
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

  if (params.cursorNodeIds !== undefined) {
    if (!Array.isArray(params.cursorNodeIds)) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: "cursorNodeIds must be an array" };
    }
    if (!params.cursorNodeIds.every((id) => typeof id === "number")) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: "cursorNodeIds must be an array of numbers" };
    }
  }

  if (params.scope !== undefined && !Array.isArray(params.scope)) {
    throw { code: ERROR_CODES.INVALID_PARAMS, message: "scope must be an array of ranges" };
  }

  return {
    uri: params.uri,
    selector: params.selector,
    args: params.args ?? [],
    cursorNodeIds: params.cursorNodeIds ?? [],
    scope: params.scope ?? [],
  };
}

// ============================================================================
// Scope Filtering
// ============================================================================

/**
 * Compares two LSP positions lexicographically.
 * Returns negative if a < b, positive if a > b, zero if equal.
 */
function comparePosition(a: LSPPosition, b: LSPPosition): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.character - b.character;
}

/**
 * Checks if range A is fully contained within range B.
 * Uses lexicographic comparison to avoid arithmetic overflow.
 */
function isRangeContained(inner: LSPRange, outer: LSPRange): boolean {
  return comparePosition(inner.start, outer.start) >= 0 &&
         comparePosition(inner.end, outer.end) <= 0;
}

/**
 * Filters ranges to only those fully contained within at least one scope range.
 * Also returns the indices of ranges that passed the filter for cursorNodeId pruning.
 */
function filterByScope(
  ranges: LSPRange[],
  scope: LSPRange[]
): { filteredRanges: LSPRange[]; passingIndices: number[] } {
  if (scope.length === 0) {
    return {
      filteredRanges: ranges,
      passingIndices: ranges.map((_, i) => i),
    };
  }

  const passingIndices: number[] = [];
  const filteredRanges: LSPRange[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const isContained = scope.some((scopeRange) => isRangeContained(range, scopeRange));
    if (isContained) {
      passingIndices.push(i);
      filteredRanges.push(range);
    }
  }

  return { filteredRanges, passingIndices };
}

// ============================================================================
// Request Handler
// ============================================================================

function handleApplySelector(
  params: {
    uri: string;
    selector: string;
    args: (number | string)[];
    cursorNodeIds: number[];
    scope: LSPRange[];
  },
  getDocument: DocumentGetter,
  getCsTree: CsTreeGetter
): SocketResponse["result"] {
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

  let selection;
  if (params.cursorNodeIds.length === 0) {
    selection = createSelection(root);
  } else {
    selection = {
      root,
      cursors: params.cursorNodeIds.map((id) => new Set([id])),
    };
  }

  const newSelection = selectorFn(selection, ...params.args);
  const ranges = resolveSelectionRanges(newSelection);
  let cursorNodeIds = newSelection.cursors.map((cursor) => [...cursor][0]);

  // Apply scope filtering
  const { filteredRanges, passingIndices } = filterByScope(ranges, params.scope);
  cursorNodeIds = passingIndices.map((i) => cursorNodeIds[i]);

  return { ranges: filteredRanges, cursorNodeIds };
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
        if (request.method !== "abct2.applySelector") {
          throw { code: ERROR_CODES.UNKNOWN_METHOD, message: `Unknown method: "${request.method}"` };
        }

        const validatedParams = validateApplySelectorParams(request.params);
        const result = handleApplySelector(validatedParams, this.getDocument, this.getCsTree);

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
