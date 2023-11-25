import { Comment, Info_line, music_code, tune_body_code } from "./Expr";
import { isInline_field, isToken, isVoice } from "./helpers";
import { TokenType } from "./types";

type System = Array<Comment | Info_line | music_code>;

/**
 * voices: 
 * every time you encounter a voice, see where we are in the order of the voices.
 * info lines: are they a voice: if so, start a new voice
 * Every time a voice that is not the next expected in the order appears, start a new system.
*/
export class VoiceParser {
  private cts: tune_body_code[];
  private voices: string[];
  private current = 0;
  private systems: Array<System> = [];
  private curSystem: System = [];
  private lastVoice: string = "";
  constructor(cts: tune_body_code[], voices: string[]) {
    this.cts = cts;
    this.voices = voices;
  }

  parse() {
    while (!this.isAtEnd()) {
      if (isVoice(this.peek())) {
        if (this.isNewSystem()) {
          /**
           * create new system
           */
          this.systems.push(this.curSystem);
          this.curSystem = [];
        }
      }
      this.curSystem.push(this.peek());
      this.advance();
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
      let voice: string;
      if (isInline_field(cur)) {
        voice = cur.text.map(e => e.lexeme).join("");
      } else {
        voice = cur.value.map(e => e.lexeme).join("");
      }
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

  private check(type: TokenType) {
    if (this.isAtEnd()) {
      return false;
    }
    const e = this.peek();
    return isToken(e) && e.type === type;
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
    return this.cts[this.current];
  }
  private peekNext() {
    return this.cts[this.current + 1];
  }
  private previous() {
    return this.cts[this.current - 1];
  }
}