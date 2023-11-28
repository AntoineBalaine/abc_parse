import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
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
  Nth_repeat,
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
} from "../Expr";
import { isBarLine, isBeam, isToken, isWS } from "../helpers";
import { Token } from "../token";
import { System, TokenType } from "../types";
import { Formatter_Bar, Formatter_LineWithBars, GroupBarsInLines, convertVoiceInfoLinesToInlineInfos, splitSystemLines } from './Formatter_helpers';

export class AbcFormatter implements Visitor<string> {
  /**
   * use this flag to indicate if we just want to stringify the tree, without pretty-printing
   */
  no_format: boolean = false;
  format(expr: Expr) {
    this.no_format = false;
    return expr.accept(this);
  }
  stringify(expr: Expr) {
    this.no_format = true;
    const fmt = expr.accept(this);
    this.no_format = false;
    return fmt;
  }
  visitAnnotationExpr(expr: Annotation) {
    return expr.text.lexeme;
  }
  visitBarLineExpr(expr: BarLine) {
    return expr.barline.lexeme;
  }
  visitBeamExpr(expr: Beam): string {
    let fmt = expr.contents.map((content) => {
      if (content instanceof Token) {
        return content.lexeme;
      } else {
        return content.accept(this);
      }
    }).join("");
    return fmt;
  }
  visitChordExpr(expr: Chord): string {
    const str = expr.contents
      .map((content): string => {
        if (content instanceof Token) {
          return content.lexeme;
        } else {
          return content.accept(this);
        }
      })
      .join("");
    if (expr.rhythm) {
      return `[${str}]${expr.rhythm.accept(this)}`;
    } else {
      return `[${str}]`;
    }
  }
  visitCommentExpr(expr: Comment) {
    return expr.text;
  }
  visitDecorationExpr(expr: Decoration) {
    return expr.decoration.lexeme;
  }
  visitFileHeaderExpr(expr: File_header) {
    //TODO should I return tokens here as well?
    return expr.text;
  }
  visitFileStructureExpr(expr: File_structure) {
    let formattedFile = "";
    if (expr.file_header) {
      formattedFile += expr.file_header.accept(this);
    }
    const formattedTunes = expr.tune.map((tune): string => {
      return tune.accept(this);
    });
    return (
      formattedFile + formattedTunes.join(formattedFile.length > 0 ? "\n" : "")
    );
  }
  visitGraceGroupExpr(expr: Grace_group): string {
    const fmt = expr.notes
      .map((note) => {
        return note.accept(this);
      })
      .join("");
    // TODO implement accaciatura formatting
    if (expr.isAccacciatura) {
      return `{/${fmt}}`;
    } else {
      return `{${fmt}}`;
    }
  }
  visitInfoLineExpr(expr: Info_line) {
    const { key, value } = expr;
    const formattedVal = value.map((val) => val.lexeme).join("");
    return `${key.lexeme}${formattedVal}\n`;
  }
  visitInlineFieldExpr(expr: Inline_field) {
    // TODO fix Inline_field parsing (numbers causing issue)
    const { field, text } = expr;
    const formattedText = text.map((val) => val.lexeme).join("");
    return `[${field.lexeme}${formattedText}]`;
  }
  visitLyricSectionExpr(expr: Lyric_section) {
    return expr.info_lines
      .map((info_line): string => {
        return info_line.accept(this);
      })
      .join("\n");
  }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest) {
    return `${expr.rest.lexeme}${expr.length ? expr.length.lexeme : ""}`; // TODO do I need the bar lines?
  }
  visitMusicCodeExpr(expr: Music_code): string {
    return expr.contents
      .map((content) => {
        if (content instanceof Token) {
          return content.lexeme;
        } else {
          return content.accept(this);
        }
      })
      .join("");
  }
  visitNoteExpr(expr: Note) {
    let formattedNote = "";
    formattedNote += expr.pitch.accept(this);
    if (expr.rhythm) {
      formattedNote += expr.rhythm.accept(this);
    }
    if (expr.tie) {
      formattedNote += "-";
    }
    return formattedNote;
  }
  visitNthRepeatExpr(expr: Nth_repeat) {
    return expr.repeat.lexeme;
  }
  visitPitchExpr(expr: Pitch) {
    let formatted = "";
    if (expr.alteration) {
      formatted += expr.alteration.lexeme;
    }
    formatted += expr.noteLetter.lexeme;
    if (expr.octave) {
      formatted += expr.octave.lexeme;
    }
    return formatted;
  }
  visitRestExpr(expr: Rest) {
    return expr.rest.lexeme;
  }
  visitRhythmExpr(expr: Rhythm) {
    let formatted = "";
    if (this.no_format) {
      const { numerator, separator, denominator, broken } = expr;
      return [numerator, separator, denominator, broken].map((e) => (e?.lexeme || "")).join("");
    }
    if (expr.numerator) {
      formatted += expr.numerator.lexeme;
    }
    if (expr.separator) {
      // in case we have expr like <pitch>///
      if (expr.separator.lexeme.length > 1 && !expr.denominator) {
        // count the separators.
        const numDivisions = expr.separator.lexeme.length;
        let count = 1;
        for (let i = 0; i < numDivisions; i++) {
          count = count * 2;
        }
        formatted += `/${count}`;
      } else if (expr.separator.lexeme === "/" && expr.denominator && expr.denominator.lexeme === "2") {
        formatted += "/";
        expr.denominator = undefined;
      } else {
        // for now, don't handle mix of multiple slashes and a denominator
        formatted += expr.separator.lexeme;
      }
    }
    if (expr.denominator) {
      formatted += expr.denominator.lexeme;
    }
    if (expr.broken) {
      formatted += expr.broken.lexeme;
    }
    return formatted;
  }
  visitSymbolExpr(expr: Symbol) {
    return `!${expr.symbol.lexeme}!`;
  }
  visitTuneBodyExpr(expr: Tune_Body): string {
    /*     return expr.sequence
          .map((system) => {
            return this.formatSystem(system);
          }).join(""); */
    return expr.sequence
      .map((system) => {
        return system.map((expr, idx, arr) => {
          /**
           * if we're just printing as is, return the lexeme of the token
           */
          if (this.no_format) {
            return isToken(expr) ? expr.lexeme : expr.accept(this);
          }
          if (isToken(expr)) {
            if (expr.type === TokenType.WHITESPACE) {
              return "";

            } else if (!isWS(expr)) {
              if (expr.type === TokenType.LEFTPAREN) {
                return expr.lexeme;
              } else {
                return expr.lexeme + " ";
              }
            } else {
              return expr.lexeme;
            }
          } else {
            const fmt = expr.accept(this);
            const nextExpr = arr[idx + 1];
            if ((isBeam(expr) && isToken(nextExpr) && nextExpr.type === TokenType.RIGHT_PAREN)
          /**
           * TODO add this: for now this is causing issue in parsing:
           * Last expr before EOL doesn't get correctly parsed if it's not a WS.
           *  || (onlyWSTillEnd(idx + 1, arr)) */) {
              return fmt;
            } else if (
              isToken(nextExpr) &&
              (nextExpr.type === TokenType.EOL
                || nextExpr.type === TokenType.EOF
                || nextExpr.type === TokenType.ANTISLASH_EOL)) {
              return fmt;
            } else {
              return fmt + " ";
            }
          }
        }).join("");
      })
      .join("");
  }
  visitTuneExpr(expr: Tune) {
    let formatted = "";
    formatted += expr.tune_header.accept(this);
    if (expr.tune_body) {
      formatted += expr.tune_body.accept(this);
    }
    return formatted;
  }
  visitTuneHeaderExpr(expr: Tune_header) {
    return expr.info_lines
      .map((infoLine): string => infoLine.accept(this))
      .join("");
  }

  visitVoiceOverlayExpr(expr: Voice_overlay) {
    return expr.contents
      .map((token): string => (token.lexeme))
      .join("");
  }
  visitYSpacerExpr(expr: YSPACER) {
    let formatted = expr.ySpacer.lexeme;
    if (expr.number) {
      formatted += expr.number.lexeme;
    }
    return formatted;
  }
  visitTupletExpr(expr: Tuplet) {
    let { p, q, r } = expr;
    return [p, q, r]
      .filter((e): e is Token => !!e)
      .map((token): string => (token.lexeme))
      .join("");
  }

  /**
  * ensure every bar is the same length,
  * and that every line starts at the same char after the inline voice indication
  * */
  formatSystem(system: System) {
    const lines = splitSystemLines(convertVoiceInfoLinesToInlineInfos(system));
    const fmtLines = this.addWSToLines(lines);
    return fmtLines.map((line) => {
      return line.map((expr, idx, arr) => {
        /**
         * if we're just printing as is, return the lexeme of the token
         */
        if (this.no_format) {
          return isToken(expr) ? expr.lexeme : expr.accept(this);
        }
        if (isToken(expr)) {
          if (expr.type === TokenType.WHITESPACE) {
            return "";

          } else if (expr.type === TokenType.WHITESPACE_FORMATTER) {
            return " ";
          } else if (!isWS(expr)) {
            if (expr.type === TokenType.LEFTPAREN) {
              return expr.lexeme;
            } else {
              return expr.lexeme + " ";
            }
          } else {
            return expr.lexeme;
          }
        } else {
          const fmt = expr.accept(this);
          const nextExpr = arr[idx + 1];
          if ((isBeam(expr) && isToken(nextExpr) && nextExpr.type === TokenType.RIGHT_PAREN)
          /**
           * TODO add this: for now this is causing issue in parsing:
           * Last expr before EOL doesn't get correctly parsed if it's not a WS.
           *  || (onlyWSTillEnd(idx + 1, arr)) */) {
            return fmt;
          } else if (
            isToken(nextExpr) &&
            (nextExpr.type === TokenType.EOL
              || nextExpr.type === TokenType.EOF
              || nextExpr.type === TokenType.ANTISLASH_EOL)) {
            return fmt;
          } else {
            return fmt + " ";
          }
        }
      }).join("");

    }).join("");
  }


  /**
  * find all the inline voice indicators `[V:1]`
  * stringify them and find the longest string.
  * 
  * Then, iterate the array of lines:
  * at each time you encounter an inlineVoice, 
  * if it's shorter that the longest string,
  * insert as many WS as the diff btw longestSring and lengthOfInlineVoice;
  * */
  addWSToLines(lines: Array<Array<Comment | Info_line | music_code>>) {
    const linesIntoBars = lines.map(GroupBarsInLines);

    const linesWithStr: Array<Formatter_LineWithBars> = linesIntoBars.map(line => {
      return line.map(bar => {
        const str = bar.map(expr => {
          if (isToken(expr)) {
            if (expr.type === TokenType.WHITESPACE) {
              return "";
            } else {
              return expr.lexeme;
            }
          } else {
            return expr.accept(this);
          }
        }).join("");
        return {
          str,
          bar
        };
      });
    });
    let largestBarCount = linesWithStr.reduce((acc, bars) => {
      if (bars.length > acc) {
        acc = bars.length;
      }
      return acc;
    }, 0);

    for (let barIdx = 0; barIdx < largestBarCount; barIdx++) {
      /**
       * Get each line's bar at BarIdx, and find the longest one.
       */
      const longestBarAtBarIdx = linesWithStr.reduce((longestBar, curLine) => {
        const curBar = curLine[barIdx];
        if (curBar) {
          if (curBar.str.length > longestBar) {
            longestBar = curBar.str.length;
          }
        }
        return longestBar;
      }, 0);

      /**
       * insert WS tokens at every line at every bar that is shorter than longestBarAtBarIdx
       */
      for (let lineIdx = 0; lineIdx < linesWithStr.length; lineIdx++) {
        const curLine = linesWithStr[lineIdx];
        const curBar = curLine[barIdx];
        if (curBar) {
          if (curBar.str.length < longestBarAtBarIdx) {
            let diff = longestBarAtBarIdx - curBar.str.length;

            for (let WScount = 0; WScount < diff; WScount++) {
              const wsToken = new Token(TokenType.WHITESPACE_FORMATTER, " ", null, -1, -1);
              //Should this be replaced by a special token?
              let curBar = linesIntoBars[lineIdx][barIdx];
              if (isBarLine(curBar[curBar.length - 1])) {
                linesIntoBars[lineIdx][barIdx].splice(curBar.length - 1, 0, wsToken);
              } else {
                linesIntoBars[lineIdx][barIdx].push(wsToken);
              }
            }
          }
        }
      }


    }
    return linesIntoBars.flat();
  }

  /**
   * Add the stringified version of a bar 
   * structure goes:
   * Lines
   *  Bars
   *   Expr
   */
  stringifyBarsInLines(line: Array<Array<Expr | Token>>): Array<Formatter_Bar> {
    return line.map(bar => {
      const str = bar.map(expr => {
        if (isToken(expr)) {
          if (expr.type === TokenType.WHITESPACE) {
            return "";
          } else {
            return expr.lexeme;
          }
        } else {
          return expr.accept(this);
        }
      }).join("");
      return {
        str,
        bar
      };
    });
  }
}
