import { isVoiceMarker } from "../helpers";
import { Token, TT } from "../parsers/scan2";
import { extractVoiceId } from "../parsers/voices2";
import {
  Visitor,
  Info_line,
  Inline_field,
  BarLine,
  Tune_Body,
  Annotation,
  Chord,
  Comment,
  Directive,
  Decoration,
  SystemBreak,
  File_header,
  File_structure,
  Grace_group,
  Lyric_line,
  Lyric_section,
  Macro_decl,
  Macro_invocation,
  MultiMeasureRest,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tune,
  Tune_header,
  User_symbol_decl,
  User_symbol_invocation,
  YSPACER,
  Beam,
  Voice_overlay,
  Line_continuation,
  Tuplet,
  ErrorExpr,
  KV,
  Binary,
  Unary,
  Grouping,
  AbsolutePitch,
  Rational,
  Measurement,
  ChordSymbol,
} from "../types/Expr2";

interface VoiceBarState {
  barCount: number;
  hasContent: boolean;
}

export interface BarEntry {
  barNumber: number;
  closingNodeId: number;
}

/** Maps voice ID to a map of bar number -> BarEntry */
export type BarMap = Map<string, Map<number, BarEntry>>;

export class BarMapVisitor implements Visitor<void> {
  barMap: BarMap;
  voices: Map<string, VoiceBarState>;
  currentVoiceId: string;
  lastNodeId: number | null;

  constructor(startingVoiceId: string) {
    this.barMap = new Map();
    this.voices = new Map();
    this.currentVoiceId = startingVoiceId;
    this.lastNodeId = null;
    this.ensureVoice(startingVoiceId);
  }

  /**
   * Creates the voice's state if it does not already exist. The bar map
   * entry for the voice is created but left empty -- bar entries are only
   * added when a bar is closed (in closeCurrentBar), so the bar map
   * never contains entries with placeholder values.
   */
  ensureVoice(voiceId: string): void {
    if (!this.voices.has(voiceId)) {
      this.voices.set(voiceId, { barCount: 0, hasContent: false });
      this.barMap.set(voiceId, new Map());
    }
  }

  /**
   * Closes the current bar for the active voice. Creates the bar entry
   * with the given closingNodeId, increments the bar counter, and resets
   * hasContent to false.
   */
  closeCurrentBar(closingNodeId: number): void {
    const voiceState = this.voices.get(this.currentVoiceId)!;
    const voiceEntries = this.barMap.get(this.currentVoiceId)!;

    voiceEntries.set(voiceState.barCount, {
      barNumber: voiceState.barCount,
      closingNodeId,
    });

    voiceState.barCount++;
    voiceState.hasContent = false;
  }

  /**
   * Marks that the current bar has received meaningful content.
   * lastNodeId is shared across voices but safe: between any two voice
   * switches, all content belongs to a single voice, so lastNodeId
   * always reflects the current voice's last content when read.
   */
  markContent(nodeId: number): void {
    const voiceState = this.voices.get(this.currentVoiceId)!;
    voiceState.hasContent = true;
    this.lastNodeId = nodeId;
  }

  /**
   * Switches the active voice when a voice marker is encountered.
   * If the outgoing voice's current bar has content, it is closed with
   * the last seen node ID as the closing anchor.
   */
  switchVoice(expr: Info_line | Inline_field): void {
    if (!isVoiceMarker(expr)) return;

    const voiceId = extractVoiceId(expr);
    if (voiceId === "") return;

    // Close the outgoing voice's bar if it has content
    const outgoingState = this.voices.get(this.currentVoiceId)!;
    if (outgoingState.hasContent && this.lastNodeId !== null) {
      this.closeCurrentBar(this.lastNodeId);
    }

    this.currentVoiceId = voiceId;
    this.ensureVoice(voiceId);
  }

  /**
   * Called after all elements have been visited. Closes the final bar
   * for the active voice if it has content.
   */
  finalize(): void {
    const voiceState = this.voices.get(this.currentVoiceId)!;
    if (voiceState.hasContent && this.lastNodeId !== null) {
      this.closeCurrentBar(this.lastNodeId);
    }
  }

  // ================================================================
  // Active visitor methods
  // ================================================================

  visitInfoLineExpr(expr: Info_line): void {
    if (expr.key.lexeme === "V:") {
      this.switchVoice(expr);
    } else {
      this.markContent(expr.id);
    }
  }

  visitInlineFieldExpr(expr: Inline_field): void {
    if (expr.field.lexeme === "V:") {
      this.switchVoice(expr);
    } else {
      this.markContent(expr.id);
    }
  }

  /**
   * A barline always closes the current bar and opens the next,
   * regardless of hasContent.
   */
  visitBarLineExpr(expr: BarLine): void {
    this.closeCurrentBar(expr.id);
  }

  /**
   * An EOL token closes the current bar only if hasContent is true.
   * This prevents spurious empty bars when a barline is followed by
   * whitespace and an EOL. Whitespace and other token types are
   * intentionally ignored because they are not meaningful bar content.
   */
  visitToken(token: Token): void {
    if (token.type === TT.EOL) {
      const voiceState = this.voices.get(this.currentVoiceId)!;
      if (voiceState.hasContent) {
        this.closeCurrentBar(this.lastNodeId!);
      }
    }
  }

  // ================================================================
  // Container expressions (must recurse into children)
  // ================================================================

  /**
   * Tune_Body contains the system arrays. We iterate each system's
   * elements and accept them so that the visitor reaches barlines,
   * info lines, etc. Tokens (like EOL) are also visited because they
   * can be bar boundaries.
   */
  visitTuneBodyExpr(expr: Tune_Body): void {
    for (const system of expr.sequence) {
      for (const element of system) {
        if (element instanceof Token) {
          this.visitToken(element);
        } else {
          element.accept(this);
        }
      }
    }
  }

  // ================================================================
  // Content-bearing expressions (toggle hasContent)
  // ================================================================

  visitNoteExpr(expr: Note): void {
    this.markContent(expr.id);
  }
  visitRestExpr(expr: Rest): void {
    this.markContent(expr.id);
  }
  visitChordExpr(expr: Chord): void {
    this.markContent(expr.id);
  }
  visitBeamExpr(expr: Beam): void {
    this.markContent(expr.id);
  }
  visitTupletExpr(expr: Tuplet): void {
    this.markContent(expr.id);
  }
  visitGraceGroupExpr(expr: Grace_group): void {
    this.markContent(expr.id);
  }
  visitDecorationExpr(expr: Decoration): void {
    this.markContent(expr.id);
  }
  visitAnnotationExpr(expr: Annotation): void {
    this.markContent(expr.id);
  }
  visitCommentExpr(expr: Comment): void {
    this.markContent(expr.id);
  }
  visitSymbolExpr(expr: Symbol): void {
    this.markContent(expr.id);
  }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): void {
    this.markContent(expr.id);
  }
  visitYSpacerExpr(expr: YSPACER): void {
    this.markContent(expr.id);
  }
  visitChordSymbolExpr(expr: ChordSymbol): void {
    this.markContent(expr.id);
  }
  visitDirectiveExpr(expr: Directive): void {
    this.markContent(expr.id);
  }
  visitVoiceOverlayExpr(expr: Voice_overlay): void {
    this.markContent(expr.id);
  }
  visitLyricLineExpr(expr: Lyric_line): void {
    this.markContent(expr.id);
  }
  visitLyricSectionExpr(expr: Lyric_section): void {
    this.markContent(expr.id);
  }
  visitMacroDeclExpr(expr: Macro_decl): void {
    this.markContent(expr.id);
  }
  visitMacroInvocationExpr(expr: Macro_invocation): void {
    this.markContent(expr.id);
  }
  visitUserSymbolDeclExpr(expr: User_symbol_decl): void {
    this.markContent(expr.id);
  }
  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): void {
    this.markContent(expr.id);
  }
  visitErrorExpr(expr: ErrorExpr): void {
    this.markContent(expr.id);
  }

  // ================================================================
  // No-op stubs (structural nodes or unreachable from this entry point)
  // ================================================================

  visitFileStructureExpr(_expr: File_structure): void {}
  visitFileHeaderExpr(_expr: File_header): void {}
  visitTuneExpr(_expr: Tune): void {}
  visitTuneHeaderExpr(_expr: Tune_header): void {}
  visitSystemBreakExpr(_expr: SystemBreak): void {}
  visitLineContinuationExpr(_expr: Line_continuation): void {}
  visitPitchExpr(_expr: Pitch): void {}
  visitRhythmExpr(_expr: Rhythm): void {}
  visitKV(_expr: KV): void {}
  visitBinary(_expr: Binary): void {}
  visitGrouping(_expr: Grouping): void {}
  visitAbsolutePitch(_expr: AbsolutePitch): void {}
  visitRationalExpr(_expr: Rational): void {}
  visitMeasurementExpr(_expr: Measurement): void {}
  visitUnary(_expr: Unary): void {}
}

/**
 * Builds a bar map from a Tune_Body AST using the visitor pattern.
 * The visitor traverses all systems, tracking voice switches and
 * recording bar entries when bars are closed by barlines, EOL tokens,
 * voice markers, or the end of the stream.
 */
export function buildBarMap(tuneBody: Tune_Body, startingVoiceId: string): BarMap {
  const visitor = new BarMapVisitor(startingVoiceId);
  tuneBody.accept(visitor);
  visitor.finalize();
  return visitor.barMap;
}
