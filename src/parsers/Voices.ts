import { isInline_field, isToken, isVoice } from "../helpers";
import { Info_line, Inline_field, tune_body_code } from "../types/Expr";
import { System, TokenType } from "../types/types";

/**
 * voices: 
 * every time you encounter a voice, see where we are in the order of the voices.
 * info lines: are they a voice: if so, start a new voice
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
    if (this.voices.length === 0) {
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
        if (this.curSystem) { // in practice, this condition is useless since the function initializes curSystem
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
    while (!this.isAtEnd() && this.peek() !== undefined) {
      const expr = this.peek();
      if (isVoice(expr)) {
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
    if (isVoice(cur)) {
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
      voice = expr.text.map(e => e.lexeme).join("").trim();
    } else {
      voice = expr.value.map(e => e.lexeme).join("").trim();
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