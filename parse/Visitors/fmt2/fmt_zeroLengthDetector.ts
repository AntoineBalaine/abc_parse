import { isToken } from "../../helpers";
import { Token } from "../../parsers/scan2";
import {
  AbsolutePitch,
  Annotation,
  BarLine,
  Beam,
  Binary,
  Chord,
  ChordSymbol,
  Comment,
  Decoration,
  Directive,
  ErrorExpr,
  File_header,
  File_structure,
  Grace_group,
  Grouping,
  Info_line,
  Inline_field,
  KV,
  Line_continuation,
  Lyric_line,
  Lyric_section,
  Macro_decl,
  Macro_invocation,
  Measurement,
  MultiMeasureRest,
  Music_code,
  Note,
  Pitch,
  Rational,
  Rest,
  Rhythm,
  Symbol,
  SystemBreak,
  Tune,
  Tune_Body,
  Tune_header,
  Tuplet,
  Unary,
  User_symbol_decl,
  User_symbol_invocation,
  Visitor,
  Voice_overlay,
  YSPACER,
} from "../../types/Expr2";

/**
 * Visitor that detects zero-length notes (notes with rhythm "0") in a tune body.
 * Returns true as soon as a zero-length note is found, allowing early termination.
 * This is used to determine whether the context interpreter needs to be run
 * before multi-voice alignment.
 */
export class ZeroLengthNoteDetector implements Visitor<boolean> {
  visitToken(_token: Token): boolean {
    return false;
  }

  visitNoteExpr(expr: Note): boolean {
    if (expr.rhythm?.numerator?.lexeme === "0") return true;
    return false;
  }

  visitChordExpr(expr: Chord): boolean {
    if (expr.rhythm?.numerator?.lexeme === "0") return true;
    for (const item of expr.contents) {
      if (!isToken(item) && item.accept(this)) return true;
    }
    return false;
  }

  visitRestExpr(expr: Rest): boolean {
    if (expr.rhythm?.numerator?.lexeme === "0") return true;
    return false;
  }

  visitTuneBodyExpr(expr: Tune_Body): boolean {
    for (const system of expr.sequence) {
      for (const item of system) {
        if (!isToken(item) && item.accept(this)) return true;
      }
    }
    return false;
  }

  visitMusicCodeExpr(expr: Music_code): boolean {
    for (const item of expr.contents) {
      if (!isToken(item) && item.accept(this)) return true;
    }
    return false;
  }

  visitBeamExpr(expr: Beam): boolean {
    for (const item of expr.contents) {
      if (!isToken(item) && item.accept(this)) return true;
    }
    return false;
  }

  visitTupletExpr(_expr: Tuplet): boolean {
    // Tuplet only contains parameters (p, q, r), not notes
    // The notes affected by the tuplet are siblings in Music_code
    return false;
  }

  visitGraceGroupExpr(expr: Grace_group): boolean {
    for (const item of expr.notes) {
      if (!isToken(item) && item.accept(this)) return true;
    }
    return false;
  }

  visitVoiceOverlayExpr(_expr: Voice_overlay): boolean {
    // Voice_overlay only contains tokens (the & symbol)
    return false;
  }

  // All other visit methods return false (no zero-length notes possible)
  visitAnnotationExpr(_expr: Annotation): boolean {
    return false;
  }
  visitBarLineExpr(_expr: BarLine): boolean {
    return false;
  }
  visitCommentExpr(_expr: Comment): boolean {
    return false;
  }
  visitDecorationExpr(_expr: Decoration): boolean {
    return false;
  }
  visitDirectiveExpr(_expr: Directive): boolean {
    return false;
  }
  visitSystemBreakExpr(_expr: SystemBreak): boolean {
    return false;
  }
  visitFileHeaderExpr(_expr: File_header): boolean {
    return false;
  }
  visitFileStructureExpr(_expr: File_structure): boolean {
    return false;
  }
  visitInfoLineExpr(_expr: Info_line): boolean {
    return false;
  }
  visitInlineFieldExpr(_expr: Inline_field): boolean {
    return false;
  }
  visitTuneExpr(_expr: Tune): boolean {
    return false;
  }
  visitTuneHeaderExpr(_expr: Tune_header): boolean {
    return false;
  }
  visitPitchExpr(_expr: Pitch): boolean {
    return false;
  }
  visitRhythmExpr(_expr: Rhythm): boolean {
    return false;
  }
  visitLineContinuationExpr(_expr: Line_continuation): boolean {
    return false;
  }
  visitMacroInvocationExpr(_expr: Macro_invocation): boolean {
    return false;
  }
  visitMacroDeclExpr(_expr: Macro_decl): boolean {
    return false;
  }
  visitUserSymbolDeclExpr(_expr: User_symbol_decl): boolean {
    return false;
  }
  visitUserSymbolInvocationExpr(_expr: User_symbol_invocation): boolean {
    return false;
  }
  visitLyricLineExpr(_expr: Lyric_line): boolean {
    return false;
  }
  visitLyricSectionExpr(_expr: Lyric_section): boolean {
    return false;
  }
  visitSymbolExpr(_expr: Symbol): boolean {
    return false;
  }
  visitChordSymbolExpr(_expr: ChordSymbol): boolean {
    return false;
  }
  visitErrorExpr(_expr: ErrorExpr): boolean {
    return false;
  }
  visitKV(_expr: KV): boolean {
    return false;
  }
  visitBinary(_expr: Binary): boolean {
    return false;
  }
  visitGrouping(_expr: Grouping): boolean {
    return false;
  }
  visitAbsolutePitch(_expr: AbsolutePitch): boolean {
    return false;
  }
  visitRationalExpr(_expr: Rational): boolean {
    return false;
  }
  visitMeasurementExpr(_expr: Measurement): boolean {
    return false;
  }
  visitUnary(_expr: Unary): boolean {
    return false;
  }
  visitMultiMeasureRestExpr(_expr: MultiMeasureRest): boolean {
    return false;
  }
  visitYSpacerExpr(_expr: YSPACER): boolean {
    return false;
  }
}
