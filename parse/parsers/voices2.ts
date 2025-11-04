import { isBarLine, isComment, isInfo_line, isMusicCode, isMusicExpr, isToken, isVoiceMarker } from "../helpers";
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
 * Split elements into lines at EOL boundaries
 */
export function splitIntoLines(elements: tune_body_code[]): tune_body_code[][] {
  const lines: tune_body_code[][] = [];
  let currentLine: tune_body_code[] = [];

  for (const element of elements) {
    if (isToken(element) && element.type === TT.EOL) {
      currentLine.push(element); // include EOL in the line
      lines.push(currentLine);
      currentLine = [];
    } else {
      currentLine.push(element);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Check if a line contains only comments or info lines (no music code)
 */
function isCommentOrInfoLine(line: tune_body_code[]): boolean {
  return line.every((expr) => {
    if (isToken(expr) && (expr.type === TT.EOL || expr.type === TT.WS)) {
      return true;
    }
    return isComment(expr) || isInfo_line(expr);
  });
}

/**
 * Helper to process an expression for bar mapping
 */
function processExprForBarMapping(
  expr: tune_body_code,
  state: {
    currentVoiceId: string;
    barCounters: Map<string, number>;
    lineStartBar: number | null;
    lineEndBar: number | null;
  }
): void {
  // Voice marker at beginning of line changes current voice
  if (isVoiceMarker(expr)) {
    state.currentVoiceId = stringifyVoice(expr);
    if (!state.barCounters.has(state.currentVoiceId)) {
      state.barCounters.set(state.currentVoiceId, 0);
    }
  }

  if (isBarLine(expr)) {
    const currentBar = state.barCounters.get(state.currentVoiceId) || 0;
    state.barCounters.set(state.currentVoiceId, currentBar + 1);
  }

  // Mark first music expression
  if (isMusicExpr(expr) && state.lineStartBar === null) {
    state.lineStartBar = state.barCounters.get(state.currentVoiceId) || 0;
  }

  // Update last music expression continuously
  if (isMusicExpr(expr)) {
    state.lineEndBar = state.barCounters.get(state.currentVoiceId) || 0;
  }
}

/**
 * Build bar number maps from lines
 * Returns a map: lineIndex -> {start: barNumber, end: barNumber, voice: voiceId}
 */
export function buildBarMapsFromLines(lines: tune_body_code[][]): Map<number, { start: number; end: number; voice: string }> {
  let currentVoiceId = "n/a";
  const barCounters = new Map<string, number>();
  const lineToBarRange = new Map<number, { start: number; end: number; voice: string }>();

  // Initialize bar counter for n/a voice
  barCounters.set("n/a", 0);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let lineStartBar: number | null = null;
    let lineEndBar: number | null = null;

    const state = {
      currentVoiceId,
      barCounters,
      lineStartBar,
      lineEndBar,
    };

    for (const expr of line) {
      // Process the expression itself
      processExprForBarMapping(expr, state);

      // If it's a Music_code container, also process its contents
      if (isMusicCode(expr)) {
        for (const child of expr.contents) {
          processExprForBarMapping(child, state);
        }
      }
    }

    // Update the shared state
    currentVoiceId = state.currentVoiceId;
    lineStartBar = state.lineStartBar;
    lineEndBar = state.lineEndBar;

    // Store the range for this line (if it has music)
    if (lineStartBar !== null && lineEndBar !== null) {
      lineToBarRange.set(lineIdx, {
        start: lineStartBar,
        end: lineEndBar,
        voice: state.currentVoiceId,
      });
    }
  }

  return lineToBarRange;
}

/**
 * Check if two bar ranges overlap
 */
function rangesOverlap(range1: { start: number; end: number } | null, range2: { start: number; end: number } | null): boolean {
  if (!range1 || !range2) {
    return false;
  }
  return range1.start <= range2.end && range2.start <= range1.end;
}

/**
 * Parse elements with multiple voices using bar overlap detection
 */
function parseVoicesWithBarOverlap(lines: tune_body_code[][]): System[] {
  const lineToBarRange = buildBarMapsFromLines(lines);
  const systems: System[] = [];
  let currentSystem: tune_body_code[] = [];
  let currentSystemStartLineIdx: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isCommentOrInfoLine(line)) {
      // if (currentSystem.length === 0) {
      //   systems.push(line);
      // } else {
      // }
      currentSystem.push(...line);
      continue;
    }

    const lineRange = lineToBarRange.get(i);

    // Line has no music, just add it to current system
    if (!lineRange) {
      currentSystem.push(...line);
      continue;
    }

    // First line with music starts the first system
    if (currentSystemStartLineIdx === null) {
      currentSystem.push(...line);
      currentSystemStartLineIdx = i;
      continue;
    }

    // Find the bar range of the current system by scanning all lines in it
    let systemMinBar = Infinity;
    let systemMaxBar = -Infinity;
    for (let j = currentSystemStartLineIdx || 0; j < i; j++) {
      const range = lineToBarRange.get(j);
      if (range) {
        systemMinBar = Math.min(systemMinBar, range.start);
        systemMaxBar = Math.max(systemMaxBar, range.end);
      }
    }

    const systemRange = systemMinBar !== Infinity ? { start: systemMinBar, end: systemMaxBar } : null;

    if (rangesOverlap(lineRange, systemRange)) {
      currentSystem.push(...line);
    } else {
      systems.push(currentSystem);
      currentSystem = [...line];
      currentSystemStartLineIdx = i;
    }
  }

  if (currentSystem.length > 0) {
    systems.push(currentSystem);
  }

  return systems;
}

/**
 * Parse music elements into systems
 */
export function parseSystemsWithVoices(elements: tune_body_code[], voices: string[] = []): System[] {
  const ctx = new VoiceCtx(elements, voices);

  if (voices.length < 2) {
    return parseNoVoices(ctx);
  } else {
    const lines = splitIntoLines(elements);
    return parseVoicesWithBarOverlap(lines);
  }
}
