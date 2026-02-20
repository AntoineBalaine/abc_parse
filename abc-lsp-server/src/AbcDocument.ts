import { ABCContext, File_structure, parse, RangeVisitor, Scanner, Token, SemanticAnalyzer } from "abc-parser";
import { ContextInterpreter, DocumentSnapshots } from "abc-parser/interpreter/ContextInterpreter";
import { ChordPosition, ChordPositionCollector } from "abc-parser/interpreter/ChordPositionCollector";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { mapAbcErrorsToDiagnostics, mapAbcWarningsToDiagnostics } from "./server_helpers";

/**
 * AbcDocument stores an Abc `TextDocument`'s diagnostics, tokens, and AST.
 *
 * Method `analyze()` returns an array of semantic tokens, or `void` in case of failure.
 */
export class AbcDocument {
  public diagnostics: Diagnostic[] = [];
  public tokens: Token[] = [];
  public AST: File_structure | null = null;
  public ctx = new ABCContext();
  public rangeVisitor = new RangeVisitor();
  public snapshots: DocumentSnapshots | null = null;
  public snapshotsHaveAccidentals: boolean = false;
  public chordPositions: ChordPosition[] | null = null;
  constructor(public document: TextDocument) {}

  /**
   * Gets the document snapshots, computing them lazily on first access.
   * Returns null if the AST is not available (parse failure).
   *
   * @param snapshotAccidentals When true, snapshots include measure accidentals.
   *   This is expensive and should only be enabled for transforms that need it
   *   (e.g., harmonizeVoicing). Default: false.
   */
  getSnapshots(snapshotAccidentals: boolean = false): DocumentSnapshots | null {
    // Snapshots with accidentals are a superset, so they serve both cases.
    // If we need accidentals but don't have them, we upgrade the cache.
    const needsRecompute = this.snapshots === null || (snapshotAccidentals && !this.snapshotsHaveAccidentals);
    if (!needsRecompute) {
      return this.snapshots;
    }
    if (!this.AST) {
      return null;
    }
    const analyzer = new SemanticAnalyzer(this.ctx);
    this.AST.accept(analyzer);
    const interpreter = new ContextInterpreter();
    this.snapshots = interpreter.interpret(this.AST, analyzer.data, this.ctx, { snapshotAccidentals });
    this.snapshotsHaveAccidentals = snapshotAccidentals;
    return this.snapshots;
  }

  /**
   * Gets chord positions for voice leading analysis, computing lazily on first access.
   * Returns null if the AST is not available (parse failure).
   */
  getChordPositions(): ChordPosition[] | null {
    if (this.chordPositions !== null) {
      return this.chordPositions;
    }
    if (!this.AST) {
      return null;
    }

    // Run SemanticAnalyzer (required for voice properties)
    const analyzer = new SemanticAnalyzer(this.ctx);
    this.AST.accept(analyzer);

    // Collect chord positions
    const collector = new ChordPositionCollector(analyzer.data);
    this.chordPositions = collector.collect(this.AST);
    return this.chordPositions;
  }

  /**
   * Return an array of tokens, or void in case of failure.
   * `analyze()` parses the document,
   * stores the AST,
   * stores any diagnostics,
   * and stores the semantic tokens used for highlighting.
   *
   * @returns an array of semantic tokens or void.
   */
  analyze() {
    const source = String.raw`${this.document.getText()}`;

    this.ctx.reset();
    this.diagnostics = [];
    this.tokens = [];
    this.snapshots = null;
    this.snapshotsHaveAccidentals = false;
    this.chordPositions = null;

    this.tokens = Scanner(source, this.ctx);
    this.AST = parse(this.tokens, this.ctx);
    const errs = mapAbcErrorsToDiagnostics(this.ctx.errorReporter.getErrors(), this.rangeVisitor);
    const warnings = mapAbcWarningsToDiagnostics(this.ctx.errorReporter.getWarnings(), this.rangeVisitor);
    this.diagnostics = errs.concat(warnings);

    if (!this.AST) {
      return;
    }

    return this.tokens;
  }
}
