/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  CompletionItem,
  CompletionItemKind,
  Hover,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  Range,
  ResponseError,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AbcLspServer, AbcTransformParams } from "./AbcLspServer";
import { AbctDocument } from "./AbctDocument";
import { AbcDocument } from "./AbcDocument";
import { DECORATION_SYMBOLS } from "./completions";
import { standardTokenScopes } from "./server_helpers";
import { provideHover } from "./abct/AbctHoverProvider";
import { provideAbctCompletions } from "./abct/AbctCompletionProvider";
import { resolveSelectionRanges } from "./selectionRangeResolver";
import { lookupSelector } from "./selectorLookup";
import { fromAst } from "../../abct2/src/csTree/fromAst";
import { createSelection } from "../../abct2/src/selection";
import { CSNode } from "../../abct2/src/csTree/types";
import { File_structure } from "abc-parser";

// ============================================================================
// ABCT Evaluation Request Types
// ============================================================================

/**
 * Parameters for the abct.evaluate request.
 */
interface AbctEvalParams {
  /** The URI of the ABCT document to evaluate */
  uri: string;
}

/**
 * Parameters for the abct.evaluateToLine request.
 */
interface AbctEvalToLineParams {
  /** The URI of the ABCT document to evaluate */
  uri: string;
  /** Evaluate up to and including this line (1-based, as shown in editor) */
  line: number;
}

/**
 * Parameters for the abct.evaluateSelection request.
 */
interface AbctEvalSelectionParams {
  /** The URI of the ABCT document to evaluate */
  uri: string;
  /** The selection range to evaluate */
  selection: Range;
}

/**
 * Result of an ABCT evaluation request.
 */
interface AbctEvalResult {
  /** The formatted ABC output */
  abc: string;
  /** Any diagnostics generated during evaluation */
  diagnostics: Array<{
    severity: number;
    range: Range;
    message: string;
    source: string;
  }>;
}

// ============================================================================
// Selector Command Request Types
// ============================================================================

interface ApplySelectorParams {
  uri: string;
  selector: string;
  args?: number[];
  cursorNodeIds: number[];
}

interface ApplySelectorResult {
  ranges: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }>;
  cursorNodeIds: number[];
}

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

/**
 * Instantiate an AbcServer, which will store the documents and handle the requests.
 */
const abcServer = new AbcLspServer(documents, (type, params) => {
  switch (type) {
    case "diagnostics":
      connection.sendDiagnostics(params);
      break;
    default:
      break;
  }
});

// CS tree cache: keyed by AST reference identity. A WeakMap handles
// multi-document scenarios without cache thrashing, and automatically
// garbage-collects stale trees when the AST is replaced.
const csTreeCache = new WeakMap<File_structure, CSNode>();

function getCsTree(ast: File_structure): CSNode {
  let tree = csTreeCache.get(ast);
  if (!tree) {
    tree = fromAst(ast);
    csTreeCache.set(ast, tree);
  }
  return tree;
}

/**
 * Check the capabilities of the client,
 * and return the capabilities of the server.
 * This is so the client knows what to ask from the server.
 */
connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;
  const hasSemanticTokensCapability = !!capabilities.textDocument?.semanticTokens?.requests?.full;
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      definitionProvider: false, // Not implemented for ABCT
      referencesProvider: false, // Not implemented for ABCT
      hoverProvider: true,
      completionProvider: {
        resolveProvider: true,
        // Trigger characters: "!" for ABC decorations, "@" and "|" for ABCT completions
        triggerCharacters: ["!", "@", "|"],
      },
    },
  };
  result.capabilities.documentHighlightProvider = false;
  result.capabilities.renameProvider = {
    prepareProvider: false,
  };
  result.capabilities.documentSymbolProvider = false;

  if (hasSemanticTokensCapability) {
    result.capabilities.semanticTokensProvider = {
      legend: {
        tokenTypes: Object.keys(standardTokenScopes).filter((val) => Number.isNaN(parseInt(val, 10))),
        tokenModifiers: [],
      },
      range: false,
      full: true,
    };
  }

  const hasFormattingCapability = !!capabilities.textDocument?.formatting?.dynamicRegistration;

  if (hasFormattingCapability) {
    result.capabilities.documentFormattingProvider = true;
  }

  return result;
});

connection.onInitialized(() => {});

connection.languages.semanticTokens.on((params) => {
  return abcServer.onSemanticTokens(params.textDocument.uri);
});

connection.onDocumentFormatting((params) => abcServer.onFormat(params.textDocument.uri));

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const uri = params.textDocument.uri;

  // Hover is only supported for ABCT files
  if (!uri.toLowerCase().endsWith(".abct")) {
    return null;
  }

  const doc = abcServer.abcDocuments.get(uri);
  if (!doc || !(doc instanceof AbctDocument) || !doc.AST) {
    return null;
  }

  return provideHover(doc.AST, params.position);
});

connection.onRequest("divideRhythm", (params: AbcTransformParams) => {
  return abcServer.onRhythmTransform(params.uri, "/", params.selection);
});
connection.onRequest("multiplyRhythm", (params: AbcTransformParams) => {
  return abcServer.onRhythmTransform(params.uri, "*", params.selection);
});
connection.onRequest("transposeUp", (params: AbcTransformParams) => {
  return abcServer.onTranspose(params.uri, 12, params.selection);
});
connection.onRequest("transposeDn", (params: AbcTransformParams) => {
  return abcServer.onTranspose(params.uri, -12, params.selection);
});

// ============================================================================
// Selector Command Request Handlers
// ============================================================================

connection.onRequest("abct2.applySelector", (params: ApplySelectorParams): ApplySelectorResult => {
  const doc = abcServer.abcDocuments.get(params.uri);
  if (!doc || !(doc instanceof AbcDocument) || !doc.AST) {
    return { ranges: [], cursorNodeIds: [] };
  }

  const root = getCsTree(doc.AST);

  const selectorFn = lookupSelector(params.selector);
  if (!selectorFn) {
    throw new ResponseError(-1, `Unknown selector: "${params.selector}"`);
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

  const newSelection = selectorFn(selection, ...(params.args ?? []));
  const ranges = resolveSelectionRanges(newSelection);
  const cursorNodeIds = newSelection.cursors.map((cursor) => [...cursor][0]);
  return { ranges, cursorNodeIds };
});
connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  const uri = textDocumentPosition.textDocument.uri;

  // Handle ABCT files with the ABCT completion provider
  if (uri.toLowerCase().endsWith(".abct")) {
    const doc = documents.get(uri);
    if (!doc) {
      return [];
    }
    return provideAbctCompletions(doc, textDocumentPosition.position);
  }

  // Handle ABC files with the existing completion logic
  const doc = abcServer.abcDocuments.get(uri);
  if (!doc) {
    return [];
  }
  const char = abcServer.findCharInDoc(
    uri,
    textDocumentPosition.position.character,
    textDocumentPosition.position.line
  );

  /**
   * If the char is not a completion trigger, ignore.
   */
  if (!char || char !== "!") {
    return [];
  }
  // TODO check that the char is in the body.
  return DECORATION_SYMBOLS.map((symbol, index) => {
    /**
     * TODO if documentation doesn't display,
     * use the onCompletionResolve
     */
    return <CompletionItem>{
      data: index + 1,
      documentation: symbol.documentation,
      kind: CompletionItemKind.Text,
      insertText: symbol.label.replace(/[!]/g, ""),
      label: symbol.label,
      labelDetails: "decoration",
    };
  });
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

// ============================================================================
// ABCT Evaluation Request Handlers
// ============================================================================

/**
 * Helper to get an AbctDocument from the server's document map.
 * Returns null if the document is not found or is not an ABCT document.
 */
function getAbctDocument(uri: string): AbctDocument | null {
  const doc = abcServer.abcDocuments.get(uri);
  if (!doc || !(doc instanceof AbctDocument)) {
    return null;
  }
  return doc;
}

/**
 * Handler for abct.evaluate - Evaluate entire ABCT file
 */
connection.onRequest("abct.evaluate", async (params: AbctEvalParams): Promise<AbctEvalResult> => {
  const doc = getAbctDocument(params.uri);
  if (!doc) {
    return {
      abc: "",
      diagnostics: [{
        severity: 1, // Error
        range: Range.create(0, 0, 0, 0),
        message: "Document not found or not an ABCT file",
        source: "abct",
      }],
    };
  }

  const result = await doc.evaluate({});
  return {
    abc: result.abc,
    diagnostics: result.diagnostics.map(d => ({
      severity: d.severity ?? 1,
      range: d.range,
      message: d.message,
      source: d.source ?? "abct",
    })),
  };
});

/**
 * Handler for abct.evaluateToLine - Evaluate up to specific line
 */
connection.onRequest("abct.evaluateToLine", async (params: AbctEvalToLineParams): Promise<AbctEvalResult> => {
  const doc = getAbctDocument(params.uri);
  if (!doc) {
    return {
      abc: "",
      diagnostics: [{
        severity: 1,
        range: Range.create(0, 0, 0, 0),
        message: "Document not found or not an ABCT file",
        source: "abct",
      }],
    };
  }

  const result = await doc.evaluate({ toLine: params.line });
  return {
    abc: result.abc,
    diagnostics: result.diagnostics.map(d => ({
      severity: d.severity ?? 1,
      range: d.range,
      message: d.message,
      source: d.source ?? "abct",
    })),
  };
});

/**
 * Handler for abct.evaluateSelection - Evaluate only selected expression
 */
connection.onRequest("abct.evaluateSelection", async (params: AbctEvalSelectionParams): Promise<AbctEvalResult> => {
  const doc = getAbctDocument(params.uri);
  if (!doc) {
    return {
      abc: "",
      diagnostics: [{
        severity: 1,
        range: Range.create(0, 0, 0, 0),
        message: "Document not found or not an ABCT file",
        source: "abct",
      }],
    };
  }

  const result = await doc.evaluate({ selection: params.selection });
  return {
    abc: result.abc,
    diagnostics: result.diagnostics.map(d => ({
      severity: d.severity ?? 1,
      range: d.range,
      message: d.message,
      source: d.source ?? "abct",
    })),
  };
});

documents.listen(connection);
connection.listen();
