/**
 * FileSystemProvider for ABCT evaluated output virtual documents
 *
 * This provider creates editable virtual documents that contain the evaluated
 * ABC output from ABCT files. When saved, changes are converted to ABC literal
 * patch expressions and appended to the source ABCT file.
 */
import * as vscode from "vscode";

/**
 * State for a single virtual document
 */
export interface DocumentState {
  /** The original evaluated ABC content (for diffing on save) */
  originalContent: string;
  /** The current content (may be modified by user) */
  currentContent: string;
  /** The source ABCT file URI string */
  sourceUri: string;
  /** The source expression to use in patches (last statement from ABCT) */
  sourceExpr: string;
  /** When this document was evaluated (Unix timestamp in ms) */
  evaluatedAt: number;
}

/**
 * URI scheme for ABCT evaluated output documents
 */
export const ABCT_EVAL_SCHEME = "abct-eval";

/**
 * FileSystemProvider for ABCT evaluated output virtual documents
 */
export class AbctEvalDocProvider implements vscode.FileSystemProvider {
  /** Storage for virtual document states, keyed by URI string */
  private documents = new Map<string, DocumentState>();

  /** Counter for ensuring unique URIs even when created in the same millisecond */
  private docCounter = 0;

  /** Event emitter for file change notifications */
  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  /**
   * Create a new virtual document for evaluated ABCT content
   *
   * @param sourceUri - The URI of the source ABCT file
   * @param content - The evaluated ABC content
   * @param sourceExpr - The source expression to use in patches
   * @returns The URI of the created virtual document
   */
  createDocument(sourceUri: vscode.Uri, content: string, sourceExpr: string): vscode.Uri {
    const timestamp = Date.now();
    const counter = this.docCounter++;
    // Encode the source URI in Base64 to avoid path separator issues
    const sourceUriBase64 = Buffer.from(sourceUri.toString()).toString("base64url");
    const docUri = vscode.Uri.parse(`${ABCT_EVAL_SCHEME}:/${sourceUriBase64}/${timestamp}-${counter}.abc`);

    const state: DocumentState = {
      originalContent: content,
      currentContent: content,
      sourceUri: sourceUri.toString(),
      sourceExpr,
      evaluatedAt: timestamp,
    };

    this.documents.set(docUri.toString(), state);
    return docUri;
  }

  /**
   * Get the state of a virtual document
   */
  getDocument(uri: vscode.Uri): DocumentState | undefined {
    return this.documents.get(uri.toString());
  }

  /**
   * Update a virtual document with new content
   * Used for auto-update when source ABCT changes.
   * Note: Silently does nothing if URI not found - this is intentional for
   * auto-update scenarios where the document may have been closed.
   */
  updateDocument(uri: vscode.Uri, newContent: string): void {
    const state = this.documents.get(uri.toString());
    if (state) {
      state.originalContent = newContent;
      state.currentContent = newContent;
      state.evaluatedAt = Date.now();
      // Notify VS Code of the change
      this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }
  }

  /**
   * Check if a document is dirty (has unsaved changes)
   */
  isDocumentDirty(uri: vscode.Uri): boolean {
    const state = this.documents.get(uri.toString());
    if (!state) return false;
    return state.originalContent !== state.currentContent;
  }

  /**
   * Get the source URI for a virtual document
   */
  getSourceUri(uri: vscode.Uri): vscode.Uri | undefined {
    const state = this.documents.get(uri.toString());
    if (!state) return undefined;
    return vscode.Uri.parse(state.sourceUri);
  }

  /**
   * Mark a document as saved (update original content to match current)
   */
  markAsSaved(uri: vscode.Uri): void {
    const state = this.documents.get(uri.toString());
    if (state) {
      state.originalContent = state.currentContent;
    }
  }

  /**
   * Remove a virtual document from storage
   */
  disposeDocument(uri: vscode.Uri): void {
    this.documents.delete(uri.toString());
  }

  /**
   * Clear all virtual documents
   */
  disposeAll(): void {
    this.documents.clear();
  }

  /**
   * Dispose of all resources held by this provider
   */
  dispose(): void {
    this.disposeAll();
    this._onDidChangeFile.dispose();
  }

  // --- FileSystemProvider implementation ---

  stat(uri: vscode.Uri): vscode.FileStat {
    const state = this.documents.get(uri.toString());
    if (!state) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return {
      type: vscode.FileType.File,
      ctime: state.evaluatedAt,
      mtime: Date.now(),
      size: Buffer.byteLength(state.currentContent, "utf8"),
    };
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const state = this.documents.get(uri.toString());
    if (!state) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return Buffer.from(state.currentContent, "utf8");
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, _options: { create: boolean; overwrite: boolean }): void {
    const state = this.documents.get(uri.toString());
    if (!state) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    state.currentContent = Buffer.from(content).toString("utf8");
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  watch(_uri: vscode.Uri): vscode.Disposable {
    // Not needed for our use case, return a no-op disposable
    return new vscode.Disposable(() => {});
  }

  // --- Unsupported operations ---

  readDirectory(_uri: vscode.Uri): [string, vscode.FileType][] {
    throw vscode.FileSystemError.NoPermissions("Read directory not supported");
  }

  createDirectory(_uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions("Create directory not supported");
  }

  delete(_uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions("Delete not supported");
  }

  rename(_oldUri: vscode.Uri, _newUri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions("Rename not supported");
  }
}
