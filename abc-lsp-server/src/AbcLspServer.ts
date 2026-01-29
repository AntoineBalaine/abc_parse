import { AbcFormatter, convertFileToDeferred } from "abc-parser";
import { HandlerResult, Position, Range, SemanticTokens, SemanticTokensBuilder, TextDocuments, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AbcDocument } from "./AbcDocument";
import { AbclDocument } from "./AbclDocument";
import { AbctFormatter } from "./abct/AbctFormatter";
import { AbctDocument } from "./AbctDocument";
import { AbcxDocument } from "./AbcxDocument";
import { LspEventListener, mapTTtoStandardScope, mapAbctTTtoScope, standardTokenScopes } from "./server_helpers";
import { AbctTT } from "../../abct/src/scanner";
import { isAssignment } from "../../abct/src/ast";

/** Common interface for ABC, ABCx, ABCL, and ABCT documents */
type DocumentType = AbcDocument | AbcxDocument | AbclDocument | AbctDocument;

/** Type guard to check if a document is an AbcDocument (has ctx property) */
function isAbcDocument(doc: DocumentType): doc is AbcDocument {
  return doc instanceof AbcDocument;
}

/** Type guard to check if a document is an AbcxDocument (has ctx property) */
function isAbcxDocument(doc: DocumentType): doc is AbcxDocument {
  return doc instanceof AbcxDocument;
}

/** Type guard to check if a document is an AbclDocument (has ctx property) */
function isAbclDocument(doc: DocumentType): doc is AbclDocument {
  return doc instanceof AbclDocument;
}

/** Type guard to check if a document has ctx property (AbcDocument, AbcxDocument, or AbclDocument) */
function hasCtx(doc: DocumentType): doc is AbcDocument | AbcxDocument | AbclDocument {
  return isAbcDocument(doc) || isAbcxDocument(doc) || isAbclDocument(doc);
}

/**
 * Storage for abc scores, their diagnostics,
 * and access for handlers for SemanticTokens, Formatting, and RhythmTransform.
 */
export class AbcLspServer {
  /**
   * A hashmap of abc scores stored by the server.
   * Uses the document's uri as key to index the scores.
   * Supports both ABC (.abc) and ABCx (.abcx) documents.
   */
  abcDocuments: Map<string, DocumentType> = new Map();
  constructor(
    private documents: TextDocuments<TextDocument>,
    private listener: LspEventListener
  ) {
    this.documents.onDidChangeContent((change) => {
      this.onDidChangeContent(change.document.uri);
    });

    this.documents.onDidClose((event) => {
      this.abcDocuments.delete(event.document.uri);
    });
  }

  /**
   * Checks if a URI refers to an ABCx file
   */
  private isAbcxFile(uri: string): boolean {
    return uri.toLowerCase().endsWith(".abcx");
  }

  /**
   * Checks if a URI refers to an ABCT file
   */
  private isAbctFile(uri: string): boolean {
    return uri.toLowerCase().endsWith(".abct");
  }

  /**
   * Checks if a URI refers to an ABCL file
   */
  private isAbclFile(uri: string): boolean {
    return uri.toLowerCase().endsWith(".abcl");
  }

  /**
   * Get the updated changes in the document,
   * parse it and send diagnostics to the client.
   * @param uri
   */
  onDidChangeContent(uri: string) {
    let abcDocument = this.abcDocuments.get(uri);
    if (!abcDocument) {
      const document = this.documents.get(uri);
      if (document) {
        // Create appropriate document type based on file extension
        if (this.isAbctFile(uri)) {
          abcDocument = new AbctDocument(document);
        } else if (this.isAbcxFile(uri)) {
          abcDocument = new AbcxDocument(document);
        } else if (this.isAbclFile(uri)) {
          abcDocument = new AbclDocument(document);
        } else {
          abcDocument = new AbcDocument(document);
        }
        this.abcDocuments.set(uri, abcDocument);
      }
    }

    if (abcDocument) {
      abcDocument.analyze();
      this.listener("diagnostics", {
        uri: uri,
        diagnostics: abcDocument.diagnostics,
      });
    }
  }

  /**
   * Handler for Semantic Tokens request
   *
   * Find the requested document and build its semantic tokens for syntax highlighting.
   * @param uri of the document
   * @returns SemanticTokens
   */
  onSemanticTokens(uri: string): HandlerResult<SemanticTokens, void> {
    const abcDocument = this.abcDocuments.get(uri); // find doc in previously parsed docs
    if (!abcDocument || !abcDocument.tokens) {
      return { data: [] };
    }

    const builder = new SemanticTokensBuilder();

    // ABCT documents use scanner tokens directly
    if (abcDocument instanceof AbctDocument) {
      // Build set of variable definition positions from AST
      const varDefPositions = new Set<string>();
      if (abcDocument.AST) {
        for (const stmt of abcDocument.AST.statements) {
          if (isAssignment(stmt)) {
            varDefPositions.add(`${stmt.idLoc.start.line}:${stmt.idLoc.start.column}`);
          }
        }
      }

      // Iterate scanner tokens and map to semantic scopes
      for (const token of abcDocument.tokens) {
        let scope = mapAbctTTtoScope(token.type);
        if (scope === -1) continue; // Skip whitespace, punctuation, etc.

        // Special case: variable definitions get variable scope
        if (token.type === AbctTT.IDENTIFIER) {
          const posKey = `${token.line}:${token.column}`;
          if (varDefPositions.has(posKey)) {
            scope = standardTokenScopes.variable;
          }
        }

        builder.push(
          token.line, // Token positions are already 0-based
          token.column,
          token.lexeme.length,
          scope,
          0
        );
      }
    } else {
      // ABC and ABCx documents
      for (const token of abcDocument.tokens) {
        const scope = mapTTtoStandardScope(token.type);
        if (scope === -1) continue; // Skip whitespace, punctuation, etc.

        // Handle multi-line tokens by splitting them across lines
        if (token.lexeme.includes("\n")) {
          const lines = token.lexeme.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].length === 0) continue;
            builder.push(token.line + i, i === 0 ? token.position : 0, lines[i].length, scope, 0);
          }
        } else {
          builder.push(token.line, token.position, token.lexeme.length, scope, 0);
        }
      }
    }

    // Return only the data array, without resultId (kak-lsp compatibility)
    const built = builder.build();
    return { data: built.data };
  }

  /**
   * Handler for Formatting request
   *
   * Find the requested document and format it using the appropriate formatter.
   * For ABC/ABCx documents, uses {@link AbcFormatter}.
   * For ABCT documents, uses {@link AbctFormatter}.
   * Returns an array of {@link TextEdit}s.
   */
  onFormat(uri: string): HandlerResult<TextEdit[], void> {
    const abcDocument = this.abcDocuments.get(uri); // find doc in previously parsed docs
    if (!abcDocument || !abcDocument.tokens) {
      return [];
    }

    // Handle ABCT documents with their own formatter
    if (abcDocument instanceof AbctDocument) {
      if (!abcDocument.AST || abcDocument.diagnostics.length > 0) {
        return [];
      }
      const formatter = new AbctFormatter();
      const source = abcDocument.document.getText();
      const formatted = formatter.format(abcDocument.AST, source);
      const edit = TextEdit.replace(Range.create(Position.create(0, 0), Position.create(Number.MAX_VALUE, Number.MAX_VALUE)), formatted);
      return [edit];
    }

    // Handle ABC and ABCx documents - need hasCtx for ctx property access
    if (!hasCtx(abcDocument)) {
      return [];
    }
    if (abcDocument.ctx.errorReporter.hasErrors()) {
      return [];
    }

    const formatted = new AbcFormatter(abcDocument.ctx).formatFile(abcDocument.AST!);
    const edit = TextEdit.replace(Range.create(Position.create(0, 0), Position.create(Number.MAX_VALUE, Number.MAX_VALUE)), formatted);
    return [edit];
  }

  /**
   * Helper for onCompletion handler.
   * Use the uri to find the document and the character at line and char position.
   * @param uri
   * @param char
   * @param line
   * @returns string
   */
  findCharInDoc(uri: string, char: number, line: number) {
    const abcDocument = this.abcDocuments.get(uri); // find doc in previously parsed docs
    if (!abcDocument || !abcDocument.tokens) {
      return [];
    }
    const doc = abcDocument.document;
    const lineText = doc.getText().split("\n")[line];
    const charIndex = lineText.indexOf(String.fromCharCode(char));
    return lineText.charAt(char);
  }

  /**
   * Get preview content for any ABC-family document.
   * Handles the appropriate conversion based on file type:
   * - .abc: returns formatted content
   * - .abcl: converts to deferred style
   * - .abcx: converts to ABC (TODO: implement)
   */
  getPreviewContent(uri: string): string {
    const abcDocument = this.abcDocuments.get(uri);
    if (!abcDocument || !abcDocument.AST) {
      return "";
    }

    // ABCL files: convert to deferred style
    if (isAbclDocument(abcDocument)) {
      const deferredAst = convertFileToDeferred(abcDocument.AST, abcDocument.ctx);
      const formatter = new AbcFormatter(abcDocument.ctx);
      return formatter.stringify(deferredAst);
    }

    // ABCx files: convert to ABC
    if (isAbcxDocument(abcDocument)) {
      const formatter = new AbcFormatter(abcDocument.ctx);
      return formatter.stringify(abcDocument.AST);
    }

    // ABC files: return formatted content
    if (isAbcDocument(abcDocument)) {
      const formatter = new AbcFormatter(abcDocument.ctx);
      return formatter.stringify(abcDocument.AST);
    }

    return "";
  }
}
