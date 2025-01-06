import { isInline_field, isToken, isVoiceMarker } from "../helpers";
import { Info_line, Inline_field, tune_body_code } from "../types/Expr";
import { System, TokenType } from "../types/types";

/**
 * Voices:
 * A class to be used by the {@link Parser} when parsing
 * a multi-voice or multi-instrument tune.
 *
 * Voices takes an array of {@link tune_body_code} expressions and tokens,
 * an array of names of each voice/instrument in the score,
 * and finds where the system breaks are.
 * eg:
 * ```typescript
 *  let tune_body_expr: Array<tune_body_code>; // after the parser gathers all the expressions in the tune's body
 *  let voices: Array<string>; // the legend that lists the names of each voice/instrument in the score
 *  const systems = new VoiceParser(tune_body_expr, voices).parse();
 *  return new Tune_Body(systems);
 * ```
 * VoiceParser returns a tune_body_code array,
 * where each entry is a `System`.
 *
 * Under-the-hood's logic:
 * Every time `VoiceParser` encounters a voice, see where we are in the order of the voices.
 * If `VoiceParser` finds Info lines: are they a voice indicator: if so, start a new voice.
 * Every time a voice that is not the next expected in the order appears, start a new system.
 */
export class VoiceParser {
  private tune_body: tune_body_code[];
  private voices: string[];
  private current = 0;
  private systems: Array<System> = [];
  private curSystem: System | undefined;
  private lastVoice: string = "";
  constructor(tune_body: tune_body_code[], voices: string[] = []) {
    this.tune_body = tune_body;
    this.voices = voices;
  }

  parse() {
    if (this.voices.length < 2) {
      return this.parseNoVoices();
    } else {
      return this.parseVoices();
    }
  }

  parseNoVoices() {
    /**
     * create new system at each new line of music
     */
    this.curSystem = [];
    while (!this.isAtEnd() && this.peek() !== undefined) {
      const expr = this.peek();
      if (isToken(expr) && (expr.type === TokenType.EOL || expr.type === TokenType.EOF)) {
        if (this.curSystem) {
          // in practice, this condition is useless since the function initializes curSystem
          this.curSystem.push(expr);
          this.systems.push(this.curSystem);
        }
        this.advance();
        this.curSystem = [];
      } else {
        this.curSystem && this.curSystem.push(expr);
        this.advance();
      }
    }
    if (this.curSystem && this.curSystem.length) {
      this.systems.push(this.curSystem);
    }
    return this.systems;
  }

  parseVoices() {
    // let foundFirstVoice = false;
    // while (!this.isAtEnd() && this.peek() !== undefined && !foundFirstVoice) {
    //   const expr = this.peek();
    //   if (isVoiceMarker(expr)) {
    //     foundFirstVoice = true;
    //     if (this.curSystem) {
    //       this.systems.push(this.curSystem);
    //     }
    //     this.curSystem = [];
    //     // this.lastVoice = this.stringifyVoice(expr);
    //   } else if (isToken(expr) && expr.type === TokenType.EOL) {
    //     // If we have a current line, push it as its own system
    //     if (this.curSystem && this.curSystem.length) {
    //       this.systems.push(this.curSystem);
    //       this.curSystem = [];
    //     }
    //     this.advance();
    //   } else {
    //     // Start collecting a new line if needed
    //     if (!this.curSystem) {
    //       this.curSystem = [];
    //     }
    //     this.curSystem.push(expr);
    //     this.advance();
    //   }
    // }
    while (!this.isAtEnd() && this.peek() !== undefined) {
      const expr = this.peek();
      if (isVoiceMarker(expr)) {
        if (this.isNewSystem()) {
          /**
           * create new system
           */
          if (this.curSystem) {
            this.systems.push(this.curSystem);
          }
          this.curSystem = [];
        } else {
          this.lastVoice = this.stringifyVoice(expr);
        }
      }
      this.curSystem && this.curSystem.push(this.peek());
      this.advance();
    }
    if (this.curSystem && this.curSystem.length) {
      this.systems.push(this.curSystem);
    }
    return this.systems;
  }

  /**
   * Check whether this is a new system.
   * If we start a new system, update this.lastVoice to the current voice.
   *
   * How the check is made:
   * Check the voice of the last entry in the current system.
   if the current voice is not after the index of the last voice in this.voices, start a new system.
  */
  private isNewSystem() {
    let rv = false;
    const cur = this.peek();
    if (isVoiceMarker(cur)) {
      let voice = this.stringifyVoice(cur);
      if (this.lastVoice === "") {
        rv = true;
      } else {
        const lastVoiceIndex = this.voices.indexOf(this.lastVoice);
        const currentVoiceIndex = this.voices.indexOf(voice);
        if (lastVoiceIndex > currentVoiceIndex) {
          rv = true;
        }
      }
      if (rv) {
        this.lastVoice = voice;
      }
    }
    return rv;
  }

  /**
   * todo stringify inline fields when creating them
   */
  private stringifyVoice(expr: Inline_field | Info_line) {
    let voice: string;
    if (isInline_field(expr)) {
      voice = expr.text
        .map((e) => e.lexeme)
        .join("")
        .trim();
    } else {
      voice = expr.value
        .map((e) => e.lexeme)
        .join("")
        .trim();
    }
    return voice;
  }

  private advance() {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }
  private isAtEnd(): boolean {
    const e = this.peek();
    return isToken(e) && e.type === TokenType.EOF;
  }
  private peek() {
    return this.tune_body[this.current];
  }
  private previous() {
    return this.tune_body[this.current - 1];
  }
}
