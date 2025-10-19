import { isToken, isVoiceMarker } from "../helpers";
import { Info_line, Inline_field, System, tune_body_code } from "../types/Expr2";
import { Token, TT } from "./scan2";

/**
 * Context for voice parsing operations
 */
export class VoiceCtx {
  elements: tune_body_code[];
  voices: string[];
  current: number;
  systems: System[];
  curSystem: System | undefined;
  lastVoice: string;

  constructor(elements: tune_body_code[], voices: string[] = []) {
    this.elements = elements;
    this.voices = voices;
    this.current = 0;
    this.systems = [];
    this.curSystem = undefined;
    this.lastVoice = "";
  }

  /**
   * Get the current element without advancing
   */
  peek(): tune_body_code {
    return this.elements[this.current];
  }

  /**
   * Get the previous element
   */
  previous(): tune_body_code {
    return this.elements[this.current - 1];
  }

  /**
   * Advance to the next element and return the previous one
   */
  advance(): tune_body_code {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  /**
   * Check if we've reached the end of the elements
   */
  isAtEnd(): boolean {
    return this.current >= this.elements.length || (isToken(this.elements[this.current]) && (this.elements[this.current] as Token).type === TT.EOF);
  }
}

/**
 * Extract the voice name from a voice marker
 */
export function stringifyVoice(expr: Info_line | Inline_field): string {
  if (expr instanceof Inline_field) {
    return expr.text
      .map((e) => e.lexeme)
      .join("")
      .trim();
  } else {
    return expr.value
      .map((e) => e.lexeme)
      .join("")
      .trim();
  }
}

/**
 * Check whether this is a new system.
 * If we start a new system, update this.lastVoice to the current voice.
 *
 * How the check is made:
 * Check the voice of the last entry in the current system.
 if the current voice is not after the index of the last voice in this.voices, start a new system.
*/
export function isNewSystem(ctx: VoiceCtx): boolean {
  let result = false;
  const current = ctx.peek();

  if (isVoiceMarker(current)) {
    const voice = stringifyVoice(current);

    if (ctx.lastVoice === "") {
      result = true;
    } else {
      const lastVoiceIndex = ctx.voices.indexOf(ctx.lastVoice);
      const currentVoiceIndex = ctx.voices.indexOf(voice);
      if (lastVoiceIndex > currentVoiceIndex) {
        result = true;
      }
    }
    if (result) {
      ctx.lastVoice = voice;
    }
  }

  return result;
}

/**
 * Parse elements when there are no voices or only one voice
 */
export function parseNoVoices(ctx: VoiceCtx): System[] {
  ctx.curSystem = [];

  while (!ctx.isAtEnd() && ctx.peek() !== undefined) {
    const expr = ctx.peek();

    if (isToken(expr) && (expr.type === TT.EOL || expr.type === TT.EOF)) {
      if (ctx.curSystem) {
        ctx.curSystem.push(expr);
        ctx.systems.push(ctx.curSystem);
      }
      ctx.advance();
      ctx.curSystem = [];
    } else {
      ctx.curSystem && ctx.curSystem.push(expr);
      ctx.advance();
    }
  }

  if (ctx.curSystem && ctx.curSystem.length) {
    ctx.systems.push(ctx.curSystem);
  }

  return ctx.systems;
}

/**
 * Parse elements when there are multiple voices
 */
export function parseVoices(ctx: VoiceCtx): System[] {
  let foundFirstVoice = false;

  while (!ctx.isAtEnd() && ctx.peek() !== undefined) {
    const expr = ctx.peek();

    // Handle content before first voice marker
    if (!foundFirstVoice) {
      if (isVoiceMarker(expr)) {
        // End of pre-voice content
        foundFirstVoice = true;
        if (ctx.curSystem && ctx.curSystem.length) {
          ctx.systems.push(ctx.curSystem);
        }
        ctx.curSystem = [];
        ctx.lastVoice = stringifyVoice(expr);
        ctx.curSystem.push(expr);
        ctx.advance();
      } else if (isToken(expr) && expr.type === TT.EOL) {
        // End of current unmarked line
        if (ctx.curSystem && ctx.curSystem.length) {
          ctx.curSystem.push(expr);
          ctx.systems.push(ctx.curSystem);
          ctx.curSystem = [];
        }
        ctx.advance();
      } else {
        // Collect content in current unmarked line
        if (!ctx.curSystem) {
          ctx.curSystem = [];
        }
        ctx.curSystem.push(expr);
        ctx.advance();
      }
      continue; // Skip the voice-based processing
    }

    // Handle content after first voice marker
    if (isVoiceMarker(expr)) {
      if (isNewSystem(ctx)) {
        if (ctx.curSystem) {
          ctx.systems.push(ctx.curSystem);
        }
        ctx.curSystem = [];
        ctx.lastVoice = stringifyVoice(expr);
      } else {
        ctx.lastVoice = stringifyVoice(expr);
      }
    }

    if (ctx.curSystem) {
      ctx.curSystem.push(expr);
    } else {
      ctx.curSystem = [expr];
    }
    ctx.advance();
  }

  // Don't forget last system
  if (ctx.curSystem && ctx.curSystem.length) {
    ctx.systems.push(ctx.curSystem);
  }

  return ctx.systems;
}

/**
 * Parse music elements into systems
 */
export function parseSystemsWithVoices(elements: tune_body_code[], voices: string[] = []): System[] {
  const ctx = new VoiceCtx(elements, voices);

  if (voices.length < 2) {
    return parseNoVoices(ctx);
  } else {
    return parseVoices(ctx);
  }
}
