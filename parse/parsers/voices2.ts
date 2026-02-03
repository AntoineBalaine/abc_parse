import { isBarLine, isComment, isInfo_line, isMusicCode, isMusicExpr, isToken, isVoiceMarker } from "../helpers";
import { Info_line, Inline_field, System, tune_body_code } from "../types/Expr2";
import { Token, TT } from "./scan2";

export type VoiceSequenceMap = Map<string, tune_body_code[] | null>;

export type LinearParseResult = {
  prefix: tune_body_code[];
  systems: VoiceSequenceMap[];
};

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
 * Context for linear-style voice parsing.
 * This context is separate from VoiceCtx because it tracks map-based state
 * for the linear-to-deferred conversion.
 */
export class LinearVoiceCtx {
  elements: tune_body_code[];
  voices: string[];
  current: number;
  systems: VoiceSequenceMap[];
  curSystem: VoiceSequenceMap;
  lastVoice: string;
  curVoiceSequence: tune_body_code[];
  prefix: tune_body_code[];

  constructor(elements: tune_body_code[], vxls: string[]) {
    this.elements = elements;
    this.voices = vxls;
    this.current = 0;
    this.systems = [];
    this.curSystem = new Map();
    this.lastVoice = "";
    this.curVoiceSequence = [];
    this.prefix = [];
  }

  peek(): tune_body_code {
    return this.elements[this.current];
  }

  advance(): tune_body_code {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.elements[this.current - 1];
  }

  isAtEnd(): boolean {
    return this.current >= this.elements.length || (isToken(this.elements[this.current]) && (this.elements[this.current] as Token).type === TT.EOF);
  }

  initMap(): void {
    this.curSystem = new Map();
    for (const v of this.voices) {
      this.curSystem.set(v, null);
    }
  }

  saveVxSeq(): void {
    if (this.lastVoice === "") return;

    const existing = this.curSystem.get(this.lastVoice);
    if (existing) {
      existing.push(...this.curVoiceSequence);
    } else {
      this.curSystem.set(this.lastVoice, this.curVoiceSequence);
    }
    this.curVoiceSequence = [];
  }

  pushSystem(): void {
    if (this.curSystem.size > 0) {
      this.systems.push(this.curSystem);
    }
    this.initMap();
  }
}

/**
 * Extract the voice ID from a voice marker.
 *
 * Voice markers can contain metadata (clef, name, etc.) after the ID.
 * Examples:
 *   V:Tenor clef=treble name="Tenor Voice" -> extracts "Tenor"
 *   V:1 -> extracts "1"
 *   [V:S1 stem=up] -> extracts "S1"
 *
 * We extract only the first token that is not whitespace and not the header itself.
 */
export function extractVoiceId(expr: Info_line | Inline_field): string {
  if (expr instanceof Inline_field) {
    // For inline fields like [V:Tenor clef=treble], extract just the ID
    // Skip any leading WS tokens and the INF_HDR token (which the parser includes in text)
    const firstToken = expr.text.find((t) => isToken(t) && t.type !== TT.WS && t.type !== TT.INF_HDR);
    if (firstToken && isToken(firstToken)) {
      return firstToken.lexeme.trim();
    }
    return "";
  } else {
    // For info lines like V:Tenor clef=treble, the ID is the first non-WS token in value
    // Skip any leading WS tokens
    const firstToken = expr.value.find((t) => isToken(t) && t.type !== TT.WS);
    if (firstToken && isToken(firstToken)) {
      return firstToken.lexeme.trim();
    }
    return "";
  }
}

/**
 * Count unique voice IDs found in the elements by scanning for voice markers.
 * This allows detecting voices declared in the tune body even if they weren't
 * declared in the tune header.
 */
export function countVoicesInElements(elements: tune_body_code[]): number {
  const voiceIds = new Set<string>();
  for (const element of elements) {
    if (isVoiceMarker(element)) {
      const voiceId = extractVoiceId(element as Info_line | Inline_field);
      if (voiceId) {
        voiceIds.add(voiceId);
      }
    }
  }
  return voiceIds.size;
}

/**
 * Check whether this is a new system.
 * If we start a new system, update this.lastVoice to the current voice.
 *
 * How the check is made:
 * Check the voice of the last entry in the current system.
 * If the current voice is not after the index of the last voice in this.voices, start a new system.
 *
 * @param ctx - The voice parsing context
 * @param linear - When true, enables dynamic voice discovery (voices are added to ctx.voices as encountered)
 */
export function isNewSystem(ctx: VoiceCtx | LinearVoiceCtx): boolean {
  let result = false;
  const current = ctx.peek();

  if (isVoiceMarker(current)) {
    const voice = extractVoiceId(current);

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
 * Parse elements when there are multiple voices.
 *
 * When ctx is a LinearVoiceCtx, this function populates the map-based structure
 * for linear-to-deferred conversion. At each voice boundary, it saves the current
 * voice sequence to the map. At each system boundary, it pushes the current map.
 */
export function parseVoices(ctx: LinearVoiceCtx): VoiceSequenceMap[] {
  let foundFirstVoice = false;
  let atLineStart = false;
  let sawMusicSinceVoiceMarker = false;

  while (!ctx.isAtEnd() && ctx.peek() !== undefined) {
    const expr = ctx.peek();

    // Handle content before first voice marker
    if (!foundFirstVoice) {
      if (isVoiceMarker(expr)) {
        foundFirstVoice = true;
        ctx.initMap();
        ctx.curVoiceSequence = [];
        const voice = extractVoiceId(expr);
        ctx.lastVoice = voice;

        ctx.curVoiceSequence.push(expr);
        ctx.advance();
        atLineStart = false;
      } else if (isToken(expr) && expr.type === TT.EOL) {
        ctx.prefix.push(expr);

        ctx.advance();
        atLineStart = true;
      } else {
        ctx.prefix.push(expr);

        ctx.advance();
        atLineStart = false;
      }
      continue;
    }

    // Handle EOL
    if (isToken(expr) && expr.type === TT.EOL) {
      ctx.curVoiceSequence.push(expr);

      ctx.advance();
      atLineStart = true;
      continue;
    }

    // Handle content after first voice marker
    if (isVoiceMarker(expr)) {
      ctx.saveVxSeq();

      // Check for system boundary
      if (isNewSystem(ctx)) {
        ctx.pushSystem();
      }

      // Always update lastVoice to the new voice
      ctx.lastVoice = extractVoiceId(expr);
      ctx.curVoiceSequence.push(expr);

      atLineStart = false;
      sawMusicSinceVoiceMarker = false;
      ctx.advance();
      continue;
    }

    // Check for implicit system boundary in linear mode
    if (atLineStart && sawMusicSinceVoiceMarker && isMusicExpr(expr)) {
      const currentVoiceIndex = ctx.voices.indexOf(ctx.lastVoice);
      if (currentVoiceIndex >= 0) {
        ctx.saveVxSeq();
        ctx.pushSystem();
        ctx.curVoiceSequence = [];
      }
      atLineStart = false;
      sawMusicSinceVoiceMarker = true;
    } else if (isMusicExpr(expr)) {
      sawMusicSinceVoiceMarker = true;
      atLineStart = false;
    } else if (!isToken(expr) || (expr.type !== TT.WS && expr.type !== TT.EOL)) {
      atLineStart = false;
    }

    ctx.curVoiceSequence.push(expr);
    ctx.advance();
  }

  ctx.saveVxSeq();
  if (ctx.curSystem.size > 0) {
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
    state.currentVoiceId = extractVoiceId(expr);
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
 * Build systems from linear-style ABC input by detecting system boundaries.
 *
 * System boundaries are detected when:
 * 1. A voice marker appears with a lower index than the previous voice (voice order reversal)
 * 2. A new line of music continues without a voice marker (implicit continuation)
 *
 * This function replicates the boundary detection logic from parseVoices(), but instead of
 * building a VoiceSequenceMap[], it returns System[] where each system contains elements
 * in their original input order.
 *
 * @param elements - The flat array of tune body elements
 * @param voices - The voice IDs from the tune header, in declaration order (may be mutated if new voices are discovered)
 * @returns Array of systems, where each system is an array of elements in input order
 */
export function buildLinearSystems(elements: tune_body_code[], voices: string[]): System[] {
  const systems: System[] = [];
  let currentSystem: System = [];
  let lastVoice = "";
  let atLineStart = false;
  let sawMusicSinceVoiceMarker = false;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    // Handle EOL tokens
    if (isToken(element) && element.type === TT.EOL) {
      currentSystem.push(element);
      atLineStart = true;
      continue;
    }

    // Handle voice markers
    if (isVoiceMarker(element)) {
      const voiceId = extractVoiceId(element as Info_line | Inline_field);

      if (lastVoice === "") {
        // First voice marker - no boundary check needed
        lastVoice = voiceId;
        // Handle dynamically discovered first voice
        if (voices.indexOf(voiceId) === -1) {
          voices.push(voiceId);
        }
      } else {
        const lastVoiceIndex = voices.indexOf(lastVoice);
        let currentVoiceIndex = voices.indexOf(voiceId);

        // Handle dynamically discovered voice
        if (currentVoiceIndex === -1) {
          voices.push(voiceId);
          currentVoiceIndex = voices.length - 1;
        }

        // Voice order reversal - start new system
        if (lastVoiceIndex > currentVoiceIndex) {
          systems.push(currentSystem);
          currentSystem = [];
        }

        lastVoice = voiceId;
      }

      currentSystem.push(element);
      atLineStart = false;
      sawMusicSinceVoiceMarker = false;
      continue;
    }

    // Check for implicit system boundary (new music line without voice marker)
    // This matches parseVoices() lines 314-326
    // Guard: only create boundary if we have a valid lastVoice
    if (atLineStart && sawMusicSinceVoiceMarker && isMusicExpr(element)) {
      const lastVoiceIndex = voices.indexOf(lastVoice);
      if (lastVoiceIndex >= 0) {
        systems.push(currentSystem);
        currentSystem = [];
      }
      atLineStart = false;
      sawMusicSinceVoiceMarker = true;
    } else if (isMusicExpr(element)) {
      sawMusicSinceVoiceMarker = true;
      atLineStart = false;
    } else if (!isToken(element) || (element.type !== TT.WS && element.type !== TT.EOL)) {
      atLineStart = false;
    }

    currentSystem.push(element);
  }

  // Don't forget last system
  if (currentSystem.length > 0) {
    systems.push(currentSystem);
  }

  return systems;
}

/**
 * Parse music elements into systems
 *
 * @param elements - The music elements to parse
 * @param voices - The list of voice identifiers from the tune header
 * @param linear - When true, uses linear-style parsing where voice markers indicate system breaks.
 *                 In linear mode, voices are discovered dynamically and a voice marker appearing
 *                 before a previously encountered voice starts a new system.
 */
export function parseSystemsWithVoices(elements: tune_body_code[], voices: string[] = [], linear: boolean = false): System[] {
  if (linear) {
    const voicesCopy = [...voices]; // Don't mutate the original
    return buildLinearSystems(elements, voicesCopy);
  }

  const ctx = new VoiceCtx(elements, voices);

  // Check both header-declared voices and voices found in the tune body,
  // because users may declare voices only via V: markers without header declarations.
  const voiceCount = Math.max(voices.length, countVoicesInElements(elements));
  if (voiceCount < 2) {
    return parseNoVoices(ctx);
  } else {
    const lines = splitIntoLines(elements);
    return parseVoicesWithBarOverlap(lines);
  }
}
