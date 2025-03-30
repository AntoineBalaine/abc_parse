import { exprIsInRange, getTokenRange, isNote, isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token } from "../parsers/scan2";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
  Directive,
  ErrorExpr,
  Expr,
  File_header,
  File_structure,
  Grace_group,
  Info_line,
  Inline_field,
  Lyric_section,
  MultiMeasureRest,
  Music_code,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tune,
  Tune_Body,
  Tune_header,
  Tuplet,
  Visitor,
  Voice_overlay,
  YSPACER,
} from "../types/Expr2";
import { Range } from "../types/types";
import { RangeVisitor } from "./RangeVisitor";

/**
 * Helper visitor class that collects expressions within a specified range.
 */

export class ExpressionCollector implements Visitor<void> {
  private collected: Array<Expr | Token> = [];
  private rangeVisitor: RangeVisitor;
  constructor(public ctx: ABCContext, private range: Range) {
    this.rangeVisitor = new RangeVisitor(ctx);
  }

  private isInRange(expr: Expr | Token): boolean {
    let exprRange: Range;
    if (isToken(expr)) {
      exprRange = getTokenRange(expr);
    } else {
      exprRange = expr.accept(this.rangeVisitor);
    }
    return exprIsInRange(this.range, exprRange);
  }

  getCollectedExpressions(): Array<Expr | Token> {
    return this.collected;
  }

  visitToken(token: Token): void {
    if (this.isInRange(token)) {
      this.collected.push(token);
    }
  }

  visitAnnotationExpr(expr: Annotation): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitDirectiveExpr(expr: Directive): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitBarLineExpr(expr: BarLine): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitChordExpr(expr: Chord): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    } else {
      expr.contents.forEach((content) => {
        if (isToken(content)) {
          this.visitToken(content);
        } else {
          content.accept(this);
        }
      });
    }
  }

  visitCommentExpr(expr: Comment): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitDecorationExpr(expr: Decoration): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitFileHeaderExpr(expr: File_header): void {
    // File header is typically not in the range of interest
  }

  visitFileStructureExpr(expr: File_structure): void {
    expr.contents.forEach((content) => {
      if (isToken(content)) {
        this.visitToken(content);
      } else {
        content.accept(this);
      }
    });
  }

  visitGraceGroupExpr(expr: Grace_group): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    } else {
      expr.notes.forEach((note) => {
        if (isNote(note)) {
          this.visitNoteExpr(note);
        } else {
          this.visitToken(note);
        }
      });
    }
  }

  visitInfoLineExpr(expr: Info_line): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitInlineFieldExpr(expr: Inline_field): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitLyricSectionExpr(expr: Lyric_section): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitMultiMeasureRestExpr(expr: MultiMeasureRest): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitMusicCodeExpr(expr: Music_code): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    } else {
      expr.contents.forEach((content) => {
        if (isToken(content)) {
          this.visitToken(content);
        } else {
          content.accept(this);
        }
      });
    }
  }

  visitNoteExpr(expr: Note): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitPitchExpr(expr: Pitch): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitRestExpr(expr: Rest): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitRhythmExpr(expr: Rhythm): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitSymbolExpr(expr: Symbol): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitTuneBodyExpr(expr: Tune_Body): void {
    expr.sequence.forEach((system) => {
      system.forEach((expr) => {
        if (isToken(expr)) {
          this.visitToken(expr);
        } else {
          expr.accept(this);
        }
      });
    });
  }

  visitTuneExpr(expr: Tune): void {
    if (expr.tune_body) {
      this.visitTuneBodyExpr(expr.tune_body);
    }
  }

  visitTuneHeaderExpr(expr: Tune_header): void {
    // Tune header is typically not in the range of interest
  }

  visitVoiceOverlayExpr(expr: Voice_overlay): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitYSpacerExpr(expr: YSPACER): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitBeamExpr(expr: Beam): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    } else {
      expr.contents.forEach((content) => {
        if (isToken(content)) {
          this.visitToken(content);
        } else {
          content.accept(this);
        }
      });
    }
  }

  visitTupletExpr(expr: Tuplet): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }

  visitErrorExpr(expr: ErrorExpr): void {
    if (this.isInRange(expr)) {
      this.collected.push(expr);
    }
  }
}
