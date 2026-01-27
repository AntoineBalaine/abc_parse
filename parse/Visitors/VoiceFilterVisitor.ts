/**
 * Voice Filter Visitor
 *
 * Filters voices from ABC AST based on %%abcls show/hide directives.
 * Similar to AbcxToAbcConverter, this operates on the AST and returns a filtered AST.
 *
 * Architecture:
 *   1. VoiceFilterCollector: Traverses AST to collect %%abcls directives and determine filter state
 *   2. VoiceFilterVisitor: Filters the AST based on collected filter state
 *   3. filterVoiceInAst: Main entry point that runs both passes
 *
 * Scoping rules:
 *   - File header directives → default filter for all tunes
 *   - Tune header directives → override for that specific tune
 *   - "Last wins" within each scope
 *
 * Filter behavior:
 *   - mode: "show" → only include specified voices
 *   - mode: "hide" → exclude specified voices
 *   - mode: null → no filtering (pass through all)
 */

import { ABCContext } from "../parsers/Context";
import { Token } from "../parsers/scan2";
import {
  Directive,
  File_header,
  File_structure,
  Info_line,
  Inline_field,
  Tune,
  Tune_Body,
  Tune_header,
  tune_body_code,
  Voice_overlay,
  System,
} from "../types/Expr2";
import { analyzeDirective } from "../analyzers/directive-analyzer";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { AbclsDirectiveData } from "../types/directive-specs";

/**
 * Filter state for a single scope (file or tune)
 */
export interface VoiceFilterState {
  mode: "show" | "hide" | null;
  voiceIds: Set<string>;
}

/**
 * Context containing filter states for file and per-tune overrides
 */
export interface FilterContext {
  fileDefault: VoiceFilterState;
  tuneOverrides: Map<number, VoiceFilterState>;
}

/**
 * Creates an empty filter state (no filtering)
 */
function createEmptyFilterState(): VoiceFilterState {
  return { mode: null, voiceIds: new Set() };
}

/**
 * Determines if a voice is included based on filter state
 */
function voiceIsIncluded(voiceId: string, state: VoiceFilterState): boolean {
  if (state.mode === null) {
    return true;
  }
  if (state.mode === "show") {
    return state.voiceIds.has(voiceId);
  }
  if (state.mode === "hide") {
    return !state.voiceIds.has(voiceId);
  }
  return true;
}

/**
 * Extracts voice ID from a V: info line or [V:id] inline field
 *
 * For Info_line V:melody clef=treble, the structure is:
 *   key: "V:", value: ["melody", "clef=treble"]
 *
 * For Inline_field [V:melody], the structure is:
 *   field: "V:", text: ["V:", "melody"]
 *   (note: text[0] duplicates the field key)
 */
function extractVoiceId(line: Info_line | Inline_field): string | null {
  if (line instanceof Info_line) {
    const key = line.key.lexeme.trim().toUpperCase();
    if (key === "V:") {
      // Voice ID is the first token in the value array
      if (line.value.length > 0) {
        return line.value[0].lexeme.trim();
      }
    }
  } else if (line instanceof Inline_field) {
    const key = line.field.lexeme.trim().toUpperCase();
    if (key === "V:") {
      // Because text[0] duplicates the field key "V:", we start at index 1
      if (line.text.length > 1) {
        return line.text[1].lexeme.trim();
      } else if (line.text.length === 1) {
        // Handle case where text only has the ID (different parser versions)
        const firstToken = line.text[0].lexeme.trim();
        // If it's the V: key, there's no voice ID
        if (firstToken.toUpperCase() === "V:" || firstToken.toUpperCase() === "V") {
          return null;
        }
        return firstToken;
      }
    }
  }
  return null;
}

/**
 * Checks if a directive is an abcls directive and extracts its data
 */
function extractAbclsData(directive: Directive, analyzer: SemanticAnalyzer): AbclsDirectiveData | null {
  if (directive.key.lexeme.toLowerCase() !== "abcls") {
    return null;
  }
  const result = analyzeDirective(directive, analyzer);
  if (result && result.type === "abcls") {
    return result.data as AbclsDirectiveData;
  }
  return null;
}

/**
 * Pass 1: Collects %%abcls directives from the AST and builds FilterContext
 */
export class VoiceFilterCollector {
  context: ABCContext;
  analyzer: SemanticAnalyzer;
  filterContext: FilterContext;

  constructor(context: ABCContext) {
    this.context = context;
    this.analyzer = new SemanticAnalyzer(context);
    this.filterContext = {
      fileDefault: createEmptyFilterState(),
      tuneOverrides: new Map(),
    };
  }

  collect(ast: File_structure): FilterContext {
    // Collect from file header
    if (ast.file_header) {
      this.collectFromFileHeader(ast.file_header);
    }

    // Collect from each tune
    for (let i = 0; i < ast.contents.length; i++) {
      const item = ast.contents[i];
      if (item instanceof Tune) {
        this.collectFromTune(item, i);
      }
    }

    return this.filterContext;
  }

  collectFromFileHeader(header: File_header): void {
    for (const item of header.contents) {
      if (item instanceof Directive) {
        const data = extractAbclsData(item, this.analyzer);
        if (data) {
          // "Last wins" - overwrite any previous file-level directive
          this.filterContext.fileDefault = {
            mode: data.mode,
            voiceIds: new Set(data.voiceIds),
          };
        }
      }
    }
  }

  collectFromTune(tune: Tune, tuneIndex: number): void {
    let tuneState: VoiceFilterState | null = null;

    // Collect from tune header
    for (const item of tune.tune_header.info_lines) {
      if (item instanceof Directive) {
        const data = extractAbclsData(item, this.analyzer);
        if (data) {
          // "Last wins" - overwrite any previous tune-level directive
          tuneState = {
            mode: data.mode,
            voiceIds: new Set(data.voiceIds),
          };
        }
      }
    }

    if (tuneState) {
      this.filterContext.tuneOverrides.set(tuneIndex, tuneState);
    }
  }
}

/**
 * Pass 2: Filters the AST based on collected FilterContext
 */
export class VoiceFilterVisitor {
  context: ABCContext;
  filterContext: FilterContext;

  constructor(context: ABCContext, filterContext: FilterContext) {
    this.context = context;
    this.filterContext = filterContext;
  }

  filter(ast: File_structure): File_structure {
    // Filter file header
    const filteredFileHeader = ast.file_header
      ? this.filterFileHeader(ast.file_header)
      : null;

    // Filter tunes
    const filteredContents: Array<Tune | Token> = [];
    for (let i = 0; i < ast.contents.length; i++) {
      const item = ast.contents[i];
      if (item instanceof Tune) {
        filteredContents.push(this.filterTune(item, i));
      } else {
        filteredContents.push(item);
      }
    }

    return new File_structure(
      this.context.generateId(),
      filteredFileHeader,
      filteredContents
    );
  }

  getFilterState(tuneIndex: number): VoiceFilterState {
    // Tune override takes precedence over file default
    const tuneOverride = this.filterContext.tuneOverrides.get(tuneIndex);
    if (tuneOverride) {
      return tuneOverride;
    }
    return this.filterContext.fileDefault;
  }

  filterFileHeader(header: File_header): File_header {
    // Remove %%abcls directives from file header
    const filteredContents = header.contents.filter(item => {
      if (item instanceof Directive && item.key.lexeme.toLowerCase() === "abcls") {
        return false;
      }
      return true;
    });

    return new File_header(this.context.generateId(), filteredContents);
  }

  filterTune(tune: Tune, tuneIndex: number): Tune {
    const filterState = this.getFilterState(tuneIndex);

    // Filter tune header
    const filteredHeader = this.filterTuneHeader(tune.tune_header, filterState);

    // Filter tune body
    const filteredBody = tune.tune_body
      ? this.filterTuneBody(tune.tune_body, filterState)
      : undefined;

    return new Tune(this.context.generateId(), filteredHeader, filteredBody || null);
  }

  filterTuneHeader(header: Tune_header, filterState: VoiceFilterState): Tune_header {
    // If no filtering, still remove %%abcls directives
    const filteredInfoLines: typeof header.info_lines = [];

    for (const item of header.info_lines) {
      // Remove %%abcls directives
      if (item instanceof Directive && item.key.lexeme.toLowerCase() === "abcls") {
        continue;
      }

      // Filter V: info lines based on voice filter state
      if (item instanceof Info_line) {
        const voiceId = extractVoiceId(item);
        if (voiceId !== null) {
          if (!voiceIsIncluded(voiceId, filterState)) {
            continue;
          }
        }
      }

      filteredInfoLines.push(item);
    }

    // Update voices array to only include filtered voices
    const filteredVoices = header.voices.filter(voiceId =>
      voiceIsIncluded(voiceId, filterState)
    );

    return new Tune_header(this.context.generateId(), filteredInfoLines, filteredVoices);
  }

  filterTuneBody(body: Tune_Body, filterState: VoiceFilterState): Tune_Body {
    // If no filtering, return body as-is
    if (filterState.mode === null) {
      return body;
    }

    const filteredSequence: System[] = [];

    // Because we need to track the current voice state while processing the body,
    // we use an empty string for content before any explicit voice switch.
    // This means that when using "show" mode, content before any V: or [V:] will be
    // filtered out unless "" is in the voice list (which it won't be).
    // The state must carry across systems because a V: declaration in one system
    // applies to content in subsequent systems until another V: is encountered.
    let currentVoice: string = "";
    let currentVoiceIncluded = voiceIsIncluded(currentVoice, filterState);

    for (const system of body.sequence) {
      const result = this.filterSystem(system, filterState, currentVoice, currentVoiceIncluded);
      currentVoice = result.currentVoice;
      currentVoiceIncluded = result.currentVoiceIncluded;
      // Only add non-empty systems
      if (result.filteredElements.length > 0) {
        filteredSequence.push(result.filteredElements);
      }
    }

    return new Tune_Body(this.context.generateId(), filteredSequence);
  }

  filterSystem(
    system: System,
    filterState: VoiceFilterState,
    currentVoice: string,
    currentVoiceIncluded: boolean
  ): { filteredElements: System; currentVoice: string; currentVoiceIncluded: boolean } {
    const filteredElements: tune_body_code[] = [];

    for (const element of system) {
      // Check for voice switches
      if (element instanceof Info_line) {
        const voiceId = extractVoiceId(element);
        if (voiceId !== null) {
          currentVoice = voiceId;
          currentVoiceIncluded = voiceIsIncluded(currentVoice, filterState);
          // Include the V: line only if the voice is included
          if (currentVoiceIncluded) {
            filteredElements.push(element);
          }
          continue;
        }
      }

      // Check for inline voice field [V:id]
      if (element instanceof Inline_field) {
        const voiceId = extractVoiceId(element);
        if (voiceId !== null) {
          currentVoice = voiceId;
          currentVoiceIncluded = voiceIsIncluded(currentVoice, filterState);
          // Include the inline field only if the voice is included
          if (currentVoiceIncluded) {
            filteredElements.push(element);
          }
          continue;
        }
      }

      // Handle voice overlays: remove if parent voice is excluded
      if (element instanceof Voice_overlay) {
        if (currentVoiceIncluded) {
          filteredElements.push(element);
        }
        continue;
      }

      // Include other elements only if current voice is included
      if (currentVoiceIncluded) {
        filteredElements.push(element);
      }
    }

    return { filteredElements, currentVoice, currentVoiceIncluded };
  }
}

/**
 * Main entry point: filters voices from ABC AST based on %%abcls directives
 *
 * @param ast The ABC file AST
 * @param context The ABC context for generating new node IDs
 * @returns A new AST with voices filtered according to %%abcls directives
 */
export function filterVoiceInAst(ast: File_structure, context: ABCContext): File_structure {
  // Pass 1: Collect directives and build filter context
  const collector = new VoiceFilterCollector(context);
  const filterContext = collector.collect(ast);

  // Pass 2: Filter the AST (will also remove %%abcls directives regardless of filtering mode)
  const visitor = new VoiceFilterVisitor(context, filterContext);
  return visitor.filter(ast);
}

/**
 * Convenience function to filter voices from an ABC string directly.
 *
 * Because this function parses, filters, and re-formats the ABC content,
 * it's suitable for use in rendering pipelines where the input is a string.
 *
 * Usage:
 *   const filteredAbc = filterVoicesInAbc(abcString, context);
 *
 * @param abc The ABC notation string to filter
 * @param context The ABC context for parsing and generating new node IDs
 * @returns The filtered ABC string with voices filtered according to %%abcls directives
 */
export function filterVoicesInAbc(abc: string, context: ABCContext): string {
  // Avoid circular dependency by using dynamic require
  const { Scanner } = require("../parsers/scan2");
  const { parse } = require("../parsers/parse2");
  const { AbcFormatter } = require("./Formatter2");

  // Parse the ABC string
  const tokens = Scanner(abc, context);
  const ast = parse(tokens, context);

  // Filter the AST
  const filteredAst = filterVoiceInAst(ast, context);

  // Convert back to string
  const formatter = new AbcFormatter(context);
  return formatter.stringify(filteredAst);
}
