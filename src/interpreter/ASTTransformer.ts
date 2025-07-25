import {
  Visitor,
  Tune,
  Tune_header,
  Tune_Body,
  Info_line,
  File_structure,
  File_header,
  Comment,
  Directive,
  Music_code,
  Note,
  Rest,
  Chord,
  BarLine,
  Grace_group,
  Decoration,
  Symbol,
  Beam,
  Tuplet,
  Annotation,
  Inline_field,
  MultiMeasureRest,
  YSPACER,
  Voice_overlay,
  Macro_decl,
  Macro_invocation,
  User_symbol_decl,
  User_symbol_invocation,
  Lyric_line,
  Lyric_section,
  Pitch,
  Rhythm,
  ErrorExpr
} from "../types/Expr2";
import { Token } from "../parsers/scan2";
import { ABCContext } from "../parsers/Context";
import {
  Tune as ABCJSTune,
  MusicLine,
  Staff,
  VoiceElement,
  NoteElement,
  BarElement,
  MediaType,
} from "../../abcjs-ast";
import {
  InterpreterContext,
  createInterpreterContext,
  setDefaultKey,
  setDefaultMeter,
  setCurrentVoice,
  addVoice,
  getCurrentVoice,
  nextMeasure
} from "./InterpreterContext";
import {
  parseKey,
  parseMeter,
  parseNoteLength,
  parseVoice,
  parseTempo,
  parseTitle,
  parseComposer,
  parseOrigin,
  parseGeneric
} from "./InfoLineParser";

export class ASTTransformer implements Visitor<any> {
  ctx: ABCContext;
  private interpreterCtx: InterpreterContext;

  constructor(ctx: ABCContext) {
    this.ctx = ctx;
    this.interpreterCtx = createInterpreterContext();
  }

  // Transform the top-level file structure
  visitFileStructureExpr(expr: File_structure): ABCJSTune[] {
    const tunes: ABCJSTune[] = [];

    // Process file header if present
    if (expr.file_header) {
      this.visitFileHeaderExpr(expr.file_header);
    }

    // Process each tune
    for (const content of expr.contents) {
      if (content instanceof Tune) {
        const abcjsTune = this.visitTuneExpr(content);
        if (abcjsTune) {
          tunes.push(abcjsTune);
        }
      }
      // Skip non-tune tokens (comments, etc.)
    }

    return tunes;
  }

  visitFileHeaderExpr(expr: File_header): void {
    // Process file-level directives and info lines
    for (const content of expr.contents) {
      if (content instanceof Info_line) {
        this.processFileHeaderInfoLine(content);
      } else if (content instanceof Directive) {
        this.visitDirectiveExpr(content);
      }
      // Skip other content types for now
    }
  }

  visitTuneExpr(expr: Tune): ABCJSTune | null {
    // Reset context for each tune
    this.interpreterCtx = createInterpreterContext();

    // Process tune header
    this.visitTuneHeaderExpr(expr.tune_header);

    // Process tune body if present
    const lines: MusicLine[] = [];
    if (expr.tune_body) {
      const musicLines = this.visitTuneBodyExpr(expr.tune_body);
      lines.push(...musicLines);
    }

    // Build the ABCJS tune
    const tune: ABCJSTune = {
      version: "1.0",
      media: MediaType.Screen,
      metaText: this.interpreterCtx.metaText,
      metaTextInfo: {}, // TODO: Add character position info
      formatting: this.interpreterCtx.formatting,
      lines: lines,
      staffNum: this.interpreterCtx.voices.size,
      voiceNum: this.interpreterCtx.voices.size,
      lineNum: lines.length,
      visualTranspose: this.interpreterCtx.visualTranspose,

      // Required methods (placeholder implementations)
      getBeatLength: () => 0.25,
      getPickupLength: () => 0,
      getBarLength: () => 1,
      getTotalTime: () => 0,
      getTotalBeats: () => 0,
      millisecondsPerMeasure: () => 1000,
      getBeatsPerMeasure: () => 4,
      getMeter: () => this.interpreterCtx.defaultMeter || { type: 'common_time' },
      getMeterFraction: () => ({ num: 4, den: 4 }),
      getKeySignature: () => this.interpreterCtx.defaultKey,
      getElementFromChar: () => null,
      getBpm: () => 120,
      setTiming: () => [],
      setUpAudio: () => null,
      deline: () => null,
      findSelectableElement: () => null,
      getSelectableArray: () => []
    };

    return tune;
  }

  visitTuneHeaderExpr(expr: Tune_header): void {
    // Process info lines in tune header
    for (const line of expr.info_lines) {
      if (line instanceof Info_line) {
        this.processTuneHeaderInfoLine(line);
      } else if (line instanceof Comment) {
        // Skip comments
      } else if (line instanceof Directive) {
        this.visitDirectiveExpr(line);
      } else if (line instanceof Macro_decl) {
        this.visitMacroDeclExpr(line);
      } else if (line instanceof User_symbol_decl) {
        this.visitUserSymbolDeclExpr(line);
      }
    }

    // If no voices were explicitly defined, create a default voice
    if (this.interpreterCtx.voices.size === 0) {
      addVoice(this.interpreterCtx, "default", {});
      setCurrentVoice(this.interpreterCtx, "default");
    }
  }

  visitTuneBodyExpr(expr: Tune_Body): MusicLine[] {
    const lines: MusicLine[] = [];

    // Process each system (line of music)
    for (const system of expr.sequence) {
      const staffs = this.processSystem(system);
      if (staffs.length > 0) {
        lines.push({ staff: staffs });
      }
    }

    return lines;
  }

  // Process info lines
  private processFileHeaderInfoLine(infoLine: Info_line): void {
    const key = infoLine.key.lexeme;

    // File-level info lines typically set defaults
    switch (key) {
      case 'L':
        this.interpreterCtx.defaultNoteLength = parseNoteLength(infoLine);
        break;
      default:
        // Store other file-level metadata
        const generic = parseGeneric(infoLine);
        this.interpreterCtx.formatting[generic.key] = generic.value;
        break;
    }
  }

  private processTuneHeaderInfoLine(infoLine: Info_line): void {
    const key = infoLine.key.lexeme;

    switch (key) {
      case 'K':
        const keySignature = parseKey(infoLine);
        setDefaultKey(this.interpreterCtx, keySignature);
        break;

      case 'M':
        const meter = parseMeter(infoLine);
        setDefaultMeter(this.interpreterCtx, meter);
        break;

      case 'L':
        this.interpreterCtx.defaultNoteLength = parseNoteLength(infoLine);
        break;

      case 'V':
        const { id, properties } = parseVoice(infoLine);
        addVoice(this.interpreterCtx, id, properties);
        setCurrentVoice(this.interpreterCtx, id);
        break;

      case 'Q':
        this.interpreterCtx.defaultTempo = parseTempo(infoLine);
        this.interpreterCtx.metaText.tempo = this.interpreterCtx.defaultTempo;
        break;

      case 'T':
        this.interpreterCtx.metaText.title = parseTitle(infoLine);
        break;

      case 'C':
        this.interpreterCtx.metaText.composer = parseComposer(infoLine);
        break;

      case 'O':
        this.interpreterCtx.metaText.origin = parseOrigin(infoLine);
        break;

      default:
        // Store other metadata
        const generic = parseGeneric(infoLine);
        (this.interpreterCtx.metaText as any)[generic.key] = generic.value;
        break;
    }
  }

  private processSystem(system: any[]): Staff[] {
    // For now, create a single staff with all voices
    // TODO: Implement proper multi-staff handling
    const voices: VoiceElement[][] = [];

    // Process each voice in the system
    const voiceElements: VoiceElement[] = [];

    for (const element of system) {
      if (element instanceof Music_code) {
        const musicElements = this.visitMusicCodeExpr(element);
        voiceElements.push(...musicElements);
      } else if (element instanceof Info_line) {
        // Handle inline info lines (key changes, etc.)
        this.processInlineInfoLine(element);
      } else if (element instanceof Comment) {
        // Skip comments in music
      }
      // TODO: Handle other system element types
    }

    if (voiceElements.length > 0) {
      voices.push(voiceElements);
    }

    // Create staff for current voice or default
    const currentVoice = getCurrentVoice(this.interpreterCtx);
    if (currentVoice) {
      const staff: Staff = {
        clef: currentVoice.currentClef,
        key: currentVoice.currentKey,
        meter: currentVoice.currentMeter,
        workingClef: currentVoice.currentClef,
        voices: voices,
        title: currentVoice.properties.name ? [currentVoice.properties.name] : []
      };

      return [staff];
    }

    return [];
  }

  private processInlineInfoLine(infoLine: Info_line): void {
    // Handle key changes, voice switches, etc. within music
    const key = infoLine.key.lexeme;

    switch (key) {
      case 'V':
        const { id } = parseVoice(infoLine);
        if (this.interpreterCtx.voices.has(id)) {
          setCurrentVoice(this.interpreterCtx, id);
        }
        break;

      case 'K':
        const keySignature = parseKey(infoLine);
        const currentVoice = getCurrentVoice(this.interpreterCtx);
        if (currentVoice) {
          currentVoice.currentKey = keySignature;
        }
        break;
    }
  }

  visitMusicCodeExpr(expr: Music_code): VoiceElement[] {
    const elements: VoiceElement[] = [];

    for (const content of expr.contents) {
      if (content instanceof Note) {
        const noteElement = this.visitNoteExpr(content);
        if (noteElement) elements.push(noteElement);
      } else if (content instanceof Rest) {
        const restElement = this.visitRestExpr(content);
        if (restElement) elements.push(restElement);
      } else if (content instanceof BarLine) {
        const barElement = this.visitBarLineExpr(content);
        if (barElement) {
          elements.push(barElement);
          nextMeasure(this.interpreterCtx);
        }
      } else if (content instanceof Chord) {
        const chordElement = this.visitChordExpr(content);
        if (chordElement) elements.push(chordElement);
      }
      // TODO: Handle other music code types
    }

    return elements;
  }

  visitNoteExpr(expr: Note): NoteElement | null {
    // Convert your Note to ABCJS NoteElement
    const pitchElement = this.visitPitchExpr(expr.pitch);
    if (!pitchElement) return null;

    const noteElement: NoteElement = {
      el_type: 'note',
      startChar: 0, // TODO: Get from token position
      endChar: 0,   // TODO: Get from token position
      duration: this.calculateNoteDuration(expr.rhythm),
      pitches: [pitchElement]
    };

    return noteElement;
  }

  visitRestExpr(expr: Rest): NoteElement | null {
    const restElement: NoteElement = {
      el_type: 'note',
      startChar: 0, // TODO: Get from token position
      endChar: 0,   // TODO: Get from token position
      duration: this.calculateNoteDuration(expr.rhythm),
      rest: { type: 'normal' }
    };

    return restElement;
  }

  visitBarLineExpr(expr: BarLine): BarElement | null {
    // Determine bar type from tokens
    const barType = this.determineBarType(expr.barline);

    const barElement: BarElement = {
      el_type: 'bar',
      startChar: 0, // TODO: Get from token position
      endChar: 0,   // TODO: Get from token position
      type: barType
    };

    return barElement;
  }

  visitChordExpr(expr: Chord): NoteElement | null {
    const pitches = [];

    for (const content of expr.contents) {
      if (content instanceof Note) {
        const pitchElement = this.visitPitchExpr(content.pitch);
        if (pitchElement) {
          pitches.push(pitchElement);
        }
      }
    }

    if (pitches.length === 0) return null;

    const chordElement: NoteElement = {
      el_type: 'note',
      startChar: 0, // TODO: Get from token position
      endChar: 0,   // TODO: Get from token position
      duration: this.calculateNoteDuration(expr.rhythm),
      pitches: pitches
    };

    return chordElement;
  }

  visitPitchExpr(expr: Pitch): any {
    // Convert your Pitch to ABCJS pitch format
    const noteLetter = expr.noteLetter.lexeme;
    const accidental = expr.alteration?.lexeme;
    const octave = expr.octave?.lexeme;

    // Calculate pitch number and vertical position
    // This is a simplified implementation
    const basePitch = this.getBasePitch(noteLetter);
    const pitch = basePitch + (octave ? this.getOctaveOffset(octave) : 0);

    return {
      pitch: pitch,
      name: (accidental || '') + noteLetter,
      verticalPos: this.calculateVerticalPos(noteLetter, octave),
      accidental: accidental ? this.convertAccidental(accidental) : undefined
    };
  }

  // Helper methods
  private calculateNoteDuration(rhythm?: Rhythm): number {
    if (!rhythm) {
      // Use default note length
      return this.interpreterCtx.defaultNoteLength.numerator / this.interpreterCtx.defaultNoteLength.denominator;
    }

    // TODO: Calculate duration from rhythm
    return 0.25; // Placeholder
  }

  private determineBarType(barTokens: Token[]): string {
    const barString = barTokens.map(t => t.lexeme).join('');

    // Map ABC bar notations to ABCJS bar types
    switch (barString) {
      case '|': return 'bar_thin';
      case '||': return 'bar_thin_thin';
      case '|:': return 'bar_left_repeat';
      case ':|': return 'bar_right_repeat';
      case '::': return 'bar_dbl_repeat';
      default: return 'bar_thin';
    }
  }

  private getBasePitch(noteLetter: string): number {
    const pitches: { [key: string]: number } = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
      'c': 12, 'd': 14, 'e': 16, 'f': 17, 'g': 19, 'a': 21, 'b': 23
    };
    return pitches[noteLetter] || 0;
  }

  private getOctaveOffset(octave: string): number {
    // Handle octave indicators like ', ,, etc.
    if (octave.includes(',')) {
      return -12 * octave.length;
    } else if (octave.includes("'")) {
      return 12 * octave.length;
    }
    return 0;
  }

  private calculateVerticalPos(noteLetter: string, octave?: string): number {
    // Simplified vertical position calculation
    const basePos = this.getBasePitch(noteLetter);
    const octaveOffset = octave ? this.getOctaveOffset(octave) : 0;
    return Math.floor((basePos + octaveOffset) / 2);
  }

  private convertAccidental(accidental: string): string {
    switch (accidental) {
      case '^': return 'sharp';
      case '_': return 'flat';
      case '=': return 'natural';
      case '^^': return 'dblsharp';
      case '__': return 'dblflat';
      default: return 'natural';
    }
  }

  // Placeholder implementations for other visitor methods
  visitTokenExpr(token: Token): any { return null; }
  visitAnnotationExpr(expr: Annotation): any { return null; }
  visitCommentExpr(expr: Comment): any { return null; }
  visitDirectiveExpr(expr: Directive): any { return null; }
  visitDecorationExpr(expr: Decoration): any { return null; }
  visitGraceGroupExpr(expr: Grace_group): any { return null; }
  visitInfoLineExpr(expr: Info_line): any { return null; }
  visitInlineFieldExpr(expr: Inline_field): any { return null; }
  visitLyricLineExpr(expr: Lyric_line): any { return null; }
  visitLyricSectionExpr(expr: Lyric_section): any { return null; }
  visitMacroDeclExpr(expr: Macro_decl): any { return null; }
  visitMacroInvocationExpr(expr: Macro_invocation): any { return null; }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): any { return null; }
  visitRhythmExpr(expr: Rhythm): any { return null; }
  visitSymbolExpr(expr: Symbol): any { return null; }
  visitUserSymbolDeclExpr(expr: User_symbol_decl): any { return null; }
  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): any { return null; }
  visitYSpacerExpr(expr: YSPACER): any { return null; }
  visitBeamExpr(expr: Beam): any { return null; }
  visitVoiceOverlayExpr(expr: Voice_overlay): any { return null; }
  visitTupletExpr(expr: Tuplet): any { return null; }
  visitErrorExpr(expr: ErrorExpr): any { return null; }
  visitToken(token: Token): any { return null; }
}
