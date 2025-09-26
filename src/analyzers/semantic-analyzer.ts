/**
 * Semantic Analyzer Visitor
 *
 * Pure function forwarding visitor that delegates semantic analysis
 * to specialized analyzer functions. Maintains semantic data map
 * and error reporting through context.
 */

import { Visitor } from "../types/Expr2";
import { DirectiveSemanticData, FontDirectiveNames } from "../types/directive-specs";
import { ABCContext } from "../parsers/Context";
import {
  Directive,
  Annotation,
  BarLine,
  Chord,
  Comment,
  Decoration,
  File_header,
  File_structure,
  Grace_group,
  Info_line,
  Inline_field,
  Lyric_line,
  Lyric_section,
  Macro_decl,
  Macro_invocation,
  MultiMeasureRest,
  Music_code,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tune_Body,
  Tune,
  Tune_header,
  User_symbol_decl,
  User_symbol_invocation,
  YSPACER,
  Beam,
  Voice_overlay,
  Tuplet,
  ErrorExpr,
  KV,
  Binary,
  Grouping,
  AbsolutePitch,
  Rational,
  Measurement,
} from "../types/Expr2";
import { Token } from "../parsers/scan2";

// Import analyzer functions
import { analyzeFontDirective } from "./font-analyzer";

/**
 * Main semantic analyzer visitor
 */
export class SemanticAnalyzer implements Visitor<DirectiveSemanticData | null> {
  data: Map<number, DirectiveSemanticData>;
  ctx: ABCContext;

  constructor(abcContext: ABCContext) {
    this.ctx = abcContext;
    this.data = new Map<number, DirectiveSemanticData>();
  }

  report(message: string, exprId: number, token?: any) {
    // TODO: Implement error reporting
    // For now, just log to console
    // this.ctx.errorReporter.
    console.error(`Semantic Error [${exprId}]: ${message}`, token);
  }

  // ============================================================================
  // Main directive analysis method (function forwarding)
  // ============================================================================

  visitDirectiveExpr(expr: Directive): DirectiveSemanticData | null {
    const directiveName = expr.key?.lexeme;
    if (!directiveName) {
      this.report("Directive missing name", expr.id);
      return null;
    }

    // Function forwarding - delegate to specific analyzer functions
    if (FontDirectiveNames.includes(directiveName)) {
      return analyzeFontDirective(expr, this);
    }

    // TODO: Add other directive type handlers here
    // if (isMeasurementDirectiveName(directiveName)) {
    //   return analyzeMeasurementDirective(expr, this.context);
    // }
    // if (isMidiDirectiveName(directiveName)) {
    //   return analyzeMidiDirective(expr, this.context);
    // }
    // if (isBooleanDirectiveName(directiveName)) {
    //   return analyzeBooleanDirective(expr, this.context);
    // }

    // For now, unhandled directives are ignored
    this.report(`Unhandled directive type: ${directiveName}`, expr.id, expr.key);
    return null;
  }

  // ============================================================================
  // Visitor interface implementation (pass-through for non-directive expressions)
  // ============================================================================

  visitToken(token: Token): DirectiveSemanticData | null {
    return null;
  }

  visitAnnotationExpr(expr: Annotation): DirectiveSemanticData | null {
    return null;
  }

  visitBarLineExpr(expr: BarLine): DirectiveSemanticData | null {
    return null;
  }

  visitChordExpr(expr: Chord): DirectiveSemanticData | null {
    return null;
  }

  visitCommentExpr(expr: Comment): DirectiveSemanticData | null {
    return null;
  }

  visitDecorationExpr(expr: Decoration): DirectiveSemanticData | null {
    return null;
  }

  visitFileHeaderExpr(expr: File_header): DirectiveSemanticData | null {
    // Process any directives in the file header
    for (const item of expr.contents) {
      if (item instanceof Directive) {
        item.accept(this);
      }
    }
    return null;
  }

  visitFileStructureExpr(expr: File_structure): DirectiveSemanticData | null {
    // Process file header if present
    if (expr.file_header) {
      expr.file_header.accept(this);
    }

    // Process all tunes
    for (const item of expr.contents) {
      if (item instanceof Tune) {
        item.accept(this);
      }
    }
    return null;
  }

  visitGraceGroupExpr(expr: Grace_group): DirectiveSemanticData | null {
    return null;
  }

  visitInfoLineExpr(expr: Info_line): DirectiveSemanticData | null {
    return null;
  }

  visitInlineFieldExpr(expr: Inline_field): DirectiveSemanticData | null {
    return null;
  }

  visitLyricLineExpr(expr: Lyric_line): DirectiveSemanticData | null {
    return null;
  }

  visitLyricSectionExpr(expr: Lyric_section): DirectiveSemanticData | null {
    return null;
  }

  visitMacroDeclExpr(expr: Macro_decl): DirectiveSemanticData | null {
    return null;
  }

  visitMacroInvocationExpr(expr: Macro_invocation): DirectiveSemanticData | null {
    return null;
  }

  visitMultiMeasureRestExpr(expr: MultiMeasureRest): DirectiveSemanticData | null {
    return null;
  }

  visitMusicCodeExpr(expr: Music_code): DirectiveSemanticData | null {
    return null;
  }

  visitNoteExpr(expr: Note): DirectiveSemanticData | null {
    return null;
  }

  visitPitchExpr(expr: Pitch): DirectiveSemanticData | null {
    return null;
  }

  visitRestExpr(expr: Rest): DirectiveSemanticData | null {
    return null;
  }

  visitRhythmExpr(expr: Rhythm): DirectiveSemanticData | null {
    return null;
  }

  visitSymbolExpr(expr: Symbol): DirectiveSemanticData | null {
    return null;
  }

  visitTuneBodyExpr(expr: Tune_Body): DirectiveSemanticData | null {
    // Process all systems in the tune body
    for (const system of expr.sequence) {
      for (const item of system) {
        if (item instanceof Directive) {
          item.accept(this);
        }
      }
    }
    return null;
  }

  visitTuneExpr(expr: Tune): DirectiveSemanticData | null {
    // Process tune header
    expr.tune_header.accept(this);

    // Process tune body if present
    if (expr.tune_body) {
      expr.tune_body.accept(this);
    }
    return null;
  }

  visitTuneHeaderExpr(expr: Tune_header): DirectiveSemanticData | null {
    // Process all info lines and directives in the header
    for (const item of expr.info_lines) {
      if (item instanceof Directive) {
        item.accept(this);
      }
    }
    return null;
  }

  visitUserSymbolDeclExpr(expr: User_symbol_decl): DirectiveSemanticData | null {
    return null;
  }

  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): DirectiveSemanticData | null {
    return null;
  }

  visitYSpacerExpr(expr: YSPACER): DirectiveSemanticData | null {
    return null;
  }

  visitBeamExpr(expr: Beam): DirectiveSemanticData | null {
    return null;
  }

  visitVoiceOverlayExpr(expr: Voice_overlay): DirectiveSemanticData | null {
    return null;
  }

  visitTupletExpr(expr: Tuplet): DirectiveSemanticData | null {
    return null;
  }

  visitErrorExpr(expr: ErrorExpr): DirectiveSemanticData | null {
    return null;
  }

  visitKV(expr: KV): DirectiveSemanticData | null {
    return null;
  }

  visitBinary(expr: Binary): DirectiveSemanticData | null {
    return null;
  }

  visitGrouping(expr: Grouping): DirectiveSemanticData | null {
    return null;
  }

  visitAbsolutePitch(expr: AbsolutePitch): DirectiveSemanticData | null {
    return null;
  }

  visitRationalExpr(expr: Rational): DirectiveSemanticData | null {
    return null;
  }

  visitMeasurementExpr(expr: Measurement): DirectiveSemanticData | null {
    return null;
  }
}
