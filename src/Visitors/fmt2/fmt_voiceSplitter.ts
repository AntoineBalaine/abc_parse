import { isToken } from "../../helpers";
import { TT } from "../../parsers/scan2";
import { System, tune_body_code } from "../../types/Expr2";

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
      } else if (isToken(node) && node.type === TT.EOL) {
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

  private peek(): tune_body_code {
    return this.system[this.current];
  }

  private peekNext(): tune_body_code | undefined {
    return this.system[this.current + 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.system.length;
  }

  private isVoiceOverlayMarker(): boolean {
    const current = this.peek();
    const next = this.peekNext();

    return isToken(current) && next !== undefined && isToken(next) && current.type === TT.AMPERSAND && next.type === TT.VOICE_OVRLAY;
  }
}

export function toVoices(system: System): System[] | null {
  return new VoiceSplitter(system).toVoices();
}
