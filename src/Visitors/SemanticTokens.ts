import { isNote, isToken, mergeTokens } from "../helpers";
import { ABCContext } from "../parsers/Context";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
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
  music_code,
  ErrorExpr,
} from "../types/Expr";
import { Token } from "../types/token";
import { TokenType } from "../types/types";

/**
 * Use this visitor to retrieve semantic tokens
 * that are used for syntax highlighting.
 *
 * Always parse from the top of the tree,
 * which is from the {@link File_structure} expression.
 *
 * eg:
 * ```typescript
 * const analyzer = new TokensVisitor();
 * analyzer.analyze(this.AST);
 * this.tokens = analyzer.tokens;
 * ```
 */
export class TokensVisitor implements Visitor<void> {
  public tokens: Array<Token> = [];
  public ctx: ABCContext;
  constructor(ctx: ABCContext) {
    this.ctx = ctx;
  }

  analyze(file_structure: File_structure) {
    file_structure.accept(this);
    return this;
  }

  visitFileStructureExpr(file_structure: File_structure): void {
    const { file_header, tune } = file_structure;
    if (file_header) {
      file_header.accept(this);
    }
    tune.forEach((tune) => {
      const { tune_header, tune_body } = tune;
      if (!tune_body) {
        // TODO: don't return when missing body.
        return;
      }
      tune_header.accept(this);
      tune_body.accept(this);
    });
  }
  visitFileHeaderExpr(file_header: File_header) {
    this.tokens.push(mergeTokens(file_header?.tokens, this.ctx));
  }
  visitTuneHeaderExpr(tune_header: Tune_header): void {
    tune_header?.info_lines.forEach((info_line) => {
      info_line.accept(this);
    });
  }
  visitTuneBodyExpr(tune_body: Tune_Body): void {
    tune_body?.sequence.forEach((system) => {
      system.forEach((element) => {
        if (isToken(element)) {
          this.tokens.push(element);
        } else {
          element.accept(this);
        }
      });
    });
  }
  visitBeamExpr(expr: Beam): void {
    expr.contents.forEach((content) => {
      if (isToken(content)) {
        this.tokens.push(content);
      } else {
        content.accept(this);
      }
    });
  }
  visitMusicCodeExpr(element: Music_code) {
    element.contents.forEach((content: music_code) => {
      if (isToken(content)) {
        this.tokens.push(content);
      } else {
        content.accept(this);
      }
    });
  }
  visitBarLineExpr(expr: BarLine) {
    return [expr.barline, expr.repeatNumbers]
      .filter((e): e is Token[] => !!e)
      .flatMap((e) => e)
      .forEach((e) => this.tokens.push(e));
  }
  visitAnnotationExpr(content: Annotation) {
    this.tokens.push(content.text);
  }
  visitNoteExpr(content: Note) {
    if (content.pitch instanceof Rest) {
      this.tokens.push(content.pitch.rest);
    } else {
      content.pitch.accept(this);
    }
    if (content.rhythm) {
      content.rhythm.accept(this);
    }
    if (content.tie) {
      this.tokens.push(content.tie);
    }
  }
  visitRhythmExpr(rhythm: Rhythm) {
    const { numerator, separator, denominator, broken } = rhythm;
    const list = [numerator, separator, denominator, broken].filter((e): e is Token => !!e);
    list.forEach((element) => {
      this.tokens.push(element);
    });
  }
  visitPitchExpr(pitch: Pitch) {
    if (pitch.alteration) {
      this.tokens.push(pitch.alteration);
    }
    this.tokens.push(pitch.noteLetter);
    if (pitch.octave) {
      this.tokens.push(pitch.octave);
    }
  }
  visitInfoLineExpr(element: Info_line) {
    const { key, value, metadata } = element;
    this.tokens.push(key);
    this.tokens.push(mergeTokens(value, this.ctx));
    if (metadata) {
      this.tokens.push(mergeTokens(value, this.ctx));
    }
  }
  visitCommentExpr(element: Comment) {
    this.tokens.push(element.token);
  }
  visitChordExpr(e: Chord) {
    e.contents.forEach((content) => {
      if (isToken(content)) {
        this.tokens.push(content);
      } else {
        content.accept(this);
      }
    });
    if (e.rhythm) {
      e.rhythm.accept(this);
    }
    if (e.tie) {
      this.tokens.push(e.tie);
    }
  }
  visitDecorationExpr(e: Decoration) {
    this.tokens.push(e.decoration);
  }
  visitGraceGroupExpr(e: Grace_group) {
    e.notes.forEach((e) => {
      if (isNote(e)) {
        e.accept(this);
      } else {
        this.tokens.push(e);
      }
    });
  }
  visitInlineFieldExpr(e: Inline_field) {
    this.tokens.push(e.field);
    e.text
      .map((element) => {
        element.type = TokenType.STRING;
        return element;
      })
      .forEach((element) => {
        this.tokens.push(element);
      });
  }
  visitLyricSectionExpr(e: Lyric_section) {
    e.info_lines.forEach((e) => {
      e.accept(this);
    });
  }
  visitMultiMeasureRestExpr(e: MultiMeasureRest) {
    this.tokens.push(e.rest);
    e.length && this.tokens.push(e.length);
  }
  visitRestExpr(e: Rest) {
    this.tokens.push(e.rest);
  }
  visitSymbolExpr(e: Symbol) {
    this.tokens.push(e.symbol);
  }
  visitTuneExpr(e: Tune) {
    e.tune_header.accept(this);
    if (e.tune_body) {
      e.tune_body.accept(this);
    }
  }
  visitVoiceOverlayExpr(expr: Voice_overlay) {
    expr.contents.forEach((element) => {
      this.tokens.push(element);
    });
  }
  visitYSpacerExpr(e: YSPACER) {
    this.tokens.push(e.ySpacer);
    e.rhythm && e.rhythm.accept(this);
  }

  visitTupletExpr(expr: Tuplet) {
    let { p, q, r } = expr;
    return [p, q, r]
      .filter((e): e is Token => !!e)
      .forEach((e) => {
        this.tokens.push(e);
      });
  }

  visitErrorExpr(expr: ErrorExpr) {
    expr.tokens.forEach((element) => {
      this.tokens.push(element);
    });
  }
}
