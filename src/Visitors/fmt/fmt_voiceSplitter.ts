import { isToken } from "../../helpers";
import { Comment, Expr, Info_line, music_code } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";

class VoiceSplitter {
  private current = 0;
  private system: System;
  private currentVoice: System = [];
  private voices: System[] = [];

  constructor(system: System) {
    this.system = system;
  }

  toVoices(): System[] | null {
    let currentVoice: System = [];

    while (!this.isAtEnd()) {
      let node = this.system[this.current];

      if (this.isVoiceOverlayMarker()) {
        this.addNode(); // &
        this.addNode(); // \<EOL>
        this.voices.push([...currentVoice]);
        currentVoice = [];
      } else if (isToken(node) && node.type === TokenType.EOL) {
        this.voices.push([...currentVoice]);
        currentVoice = [];
        this.addNode();
      } else {
        this.addNode();
      }
    }

    // Don't forget last voice
    if (currentVoice.length > 0) {
      this.voices.push(currentVoice);
    }

    return this.voices.length > 0 ? this.voices : null;
  }

  private addNode(): void {
    this.currentVoice.push(this.peek());
    this.advance();
  }
  private advance(): void {
    this.current++;
  }

  private peek(): Comment | Info_line | music_code {
    return this.system[this.current];
  }

  private peekNext(): Expr | Token | undefined {
    return this.system[this.current + 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.system.length;
  }

  private isVoiceOverlayMarker(): boolean {
    const current = this.peek();
    const next = this.peekNext();

    return (
      isToken(current) &&
      isToken(next) &&
      current.type === TokenType.AMPERSAND &&
      next.type === TokenType.ANTISLASH_EOL
    );
  }
}

export function toVoices(system: System): System[] | null {
  return new VoiceSplitter(system).toVoices();
}
