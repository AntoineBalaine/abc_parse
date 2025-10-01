/**
 * Semantic Analyzer Visitor
 *
 * Pure function forwarding visitor that delegates semantic analysis
 * to specialized analyzer functions. Maintains semantic data map
 * and error reporting through context.
 */

import { InfoLineUnion, Visitor } from "../types/Expr2";
import { DirectiveSemanticData } from "../types/directive-specs";
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
import { analyzeDirective } from "./directive-analyzer";
import { analyzeInfoLine } from "./info-line-analyzer";

/**
 * Unified semantic data type combining directive and info line analysis results
 */
export type SemanticData = DirectiveSemanticData | InfoLineUnion;

/**
 * Main semantic analyzer visitor
 */
export class SemanticAnalyzer implements Visitor<SemanticData | null> {
  data: Map<number, SemanticData>;
  ctx: ABCContext;

  constructor(abcContext: ABCContext) {
    this.ctx = abcContext;
    this.data = new Map<number, SemanticData>();
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

  visitDirectiveExpr(expr: Directive): SemanticData | null {
    const directiveName = expr.key?.lexeme;
    if (!directiveName) {
      this.report("Directive missing name", expr.id);
      return null;
    }

    // Delegate to the main directive analyzer
    const result = analyzeDirective(expr, this);

    // Store the result in the data map if successful
    if (result !== null) {
      this.data.set(expr.id, result);
    }

    return result;
  }

  // ============================================================================
  // Main info line analysis method (function forwarding)
  // ============================================================================

  visitInfoLineExpr(expr: Info_line): SemanticData | null {
    const infoLineKey = expr.key?.lexeme;
    if (!infoLineKey) {
      this.report("Info line missing key", expr.id);
      return null;
    }

    // Delegate to the info line analyzer
    const result = analyzeInfoLine(expr, this);

    // Store the result in the data map if successful
    if (result !== null) {
      this.data.set(expr.id, result);
    }

    return result;
  }

  // ============================================================================
  // Visitor interface implementation (pass-through for non-directive expressions)
  // ============================================================================

  visitToken(token: Token): SemanticData | null {
    return null;
  }

  visitAnnotationExpr(expr: Annotation): SemanticData | null {
    return null;
  }

  visitBarLineExpr(expr: BarLine): SemanticData | null {
    return null;
  }

  visitChordExpr(expr: Chord): SemanticData | null {
    return null;
  }

  visitCommentExpr(expr: Comment): SemanticData | null {
    return null;
  }

  visitDecorationExpr(expr: Decoration): SemanticData | null {
    return null;
  }

  visitFileHeaderExpr(expr: File_header): SemanticData | null {
    // Process any directives in the file header
    for (const item of expr.contents) {
      if (item instanceof Directive) {
        item.accept(this);
      }
    }
    return null;
  }

  visitFileStructureExpr(expr: File_structure): SemanticData | null {
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

  visitGraceGroupExpr(expr: Grace_group): SemanticData | null {
    return null;
  }

  visitInlineFieldExpr(expr: Inline_field): SemanticData | null {
    return null;
  }

  visitLyricLineExpr(expr: Lyric_line): SemanticData | null {
    return null;
  }

  visitLyricSectionExpr(expr: Lyric_section): SemanticData | null {
    return null;
  }

  visitMacroDeclExpr(expr: Macro_decl): SemanticData | null {
    return null;
  }

  visitMacroInvocationExpr(expr: Macro_invocation): SemanticData | null {
    return null;
  }

  visitMultiMeasureRestExpr(expr: MultiMeasureRest): SemanticData | null {
    return null;
  }

  visitMusicCodeExpr(expr: Music_code): SemanticData | null {
    return null;
  }

  visitNoteExpr(expr: Note): SemanticData | null {
    return null;
  }

  visitPitchExpr(expr: Pitch): SemanticData | null {
    return null;
  }

  visitRestExpr(expr: Rest): SemanticData | null {
    return null;
  }

  visitRhythmExpr(expr: Rhythm): SemanticData | null {
    return null;
  }

  visitSymbolExpr(expr: Symbol): SemanticData | null {
    return null;
  }

  visitTuneBodyExpr(expr: Tune_Body): SemanticData | null {
    // Process all systems in the tune body
    for (const system of expr.sequence) {
      for (const item of system) {
        if (item instanceof Directive) {
          item.accept(this);
        } else if (item instanceof Info_line) {
          item.accept(this);
        }
      }
    }
    return null;
  }

  visitTuneExpr(expr: Tune): SemanticData | null {
    // Process tune header
    expr.tune_header.accept(this);

    // Process tune body if present
    if (expr.tune_body) {
      expr.tune_body.accept(this);
    }
    return null;
  }

  visitTuneHeaderExpr(expr: Tune_header): SemanticData | null {
    // Process all info lines and directives in the header
    for (const item of expr.info_lines) {
      if (item instanceof Directive) {
        item.accept(this);
      } else if (item instanceof Info_line) {
        item.accept(this);
      }
    }
    return null;
  }

  visitUserSymbolDeclExpr(expr: User_symbol_decl): SemanticData | null {
    return null;
  }

  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): SemanticData | null {
    return null;
  }

  visitYSpacerExpr(expr: YSPACER): SemanticData | null {
    return null;
  }

  visitBeamExpr(expr: Beam): SemanticData | null {
    return null;
  }

  visitVoiceOverlayExpr(expr: Voice_overlay): SemanticData | null {
    return null;
  }

  visitTupletExpr(expr: Tuplet): SemanticData | null {
    return null;
  }

  visitErrorExpr(expr: ErrorExpr): SemanticData | null {
    return null;
  }

  visitKV(expr: KV): SemanticData | null {
    return null;
  }

  visitBinary(expr: Binary): SemanticData | null {
    return null;
  }

  visitGrouping(expr: Grouping): SemanticData | null {
    return null;
  }

  visitAbsolutePitch(expr: AbsolutePitch): SemanticData | null {
    return null;
  }

  visitRationalExpr(expr: Rational): SemanticData | null {
    return null;
  }

  visitMeasurementExpr(expr: Measurement): SemanticData | null {
    return null;
  }
}
