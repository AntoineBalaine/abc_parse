import { isToken } from "../../helpers";
import { System, TokenType } from "../../types/types";

class VoiceSplitter {
  private current = 0;
  private system: System;

  constructor(system: System) {
    this.system = system;
  }

  toVoices(): System[] | null {
    let voices: System[] = [];
    let voice: System = [];

    while (!this.isAtEnd()) {
      let node = this.system[this.current];
      if (
        (isToken(node) && this.isVoiceOverlayMarker()) ||
        (isToken(node) && node.type == TokenType.EOL)
      ) {
        voices.push(voice);
        voice = [];
      } else {
        voice.push(node);
        this.current += 1;
      }
    }
    return voices;
  }
  private isAtEnd(): boolean {
    return this.current >= this.system.length;
  }
  private isVoiceOverlayMarker(): boolean {
    if (this.current + 1 >= this.system.length) {
      return false;
    }

    const current = this.system[this.current];
    const next = this.system[this.current + 1];

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
