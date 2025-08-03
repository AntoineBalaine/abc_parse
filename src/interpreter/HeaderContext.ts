import {
  KeySignature,
  Meter,
  ClefProperties,
  TempoProperties,
} from "../../abcjs-ast";
import {
  VoiceProperties,
  parseKey,
  parseMeter,
  parseNoteLength,
  parseTempo,
  parseTitle,
  parseComposer,
  parseOrigin,
} from "./InfoLineParser";
import { Directive, Info_line, Tune_header } from "../types/Expr2";
import { Rational } from "../Visitors/fmt2/rational";

export interface HeaderCtx {
  // Musical defaults
  defaultKey: KeySignature;
  defaultMeter: Meter;
  defaultNoteLength: Rational;
  defaultTempo: TempoProperties;
  defaultClef: ClefProperties;
  defaultVoiceProperties: VoiceProperties;

  // metadata
  title: string;
  composer: string;
  origin: string;
  transcription: string;
  history: string;
  book: string;
  group: string;
  language: string;
  notes: string;

  // User-defined symbols and macros (no recursive expansion, only used in tune bodies)
  userSymbols: Map<string, string>;
  macros: Map<string, string>;

  // Global formatting directives
  formatting: Map<string, string>;
}

/** Readonly version for scope stack */
export type ROHeadrCtx = Readonly<Partial<HeaderCtx>>;

function applyInfoLine(ctx: Partial<HeaderCtx>, infoLine: Info_line): void {
  const key = infoLine.key.lexeme.trim();

  switch (key) {
    case "K":
      if (ctx.defaultKey) {
        console.warn(`Duplicate K: directive in file header, using last value`);
      }
      ctx.defaultKey = parseKey(infoLine);
      break;
    case "M":
      if (ctx.defaultMeter) {
        console.warn(`Duplicate M: directive in file header, using last value`);
      }
      ctx.defaultMeter = parseMeter(infoLine);
      break;
    case "L":
      if (ctx.defaultNoteLength) {
        console.warn(`Duplicate L: directive in file header, using last value`);
      }
      ctx.defaultNoteLength = parseNoteLength(infoLine);
      break;
    case "Q":
      if (ctx.defaultTempo) {
        console.warn(`Duplicate Q: directive in file header, using last value`);
      }
      ctx.defaultTempo = parseTempo(infoLine);
      break;
    case "T":
      if (ctx.title) {
        console.warn(`Duplicate T: directive in file header, using last value`);
      }
      ctx.title = parseTitle(infoLine);
      break;
    case "C":
      if (ctx.composer) {
        console.warn(`Duplicate C: directive in file header, using last value`);
      }
      ctx.composer = parseComposer(infoLine);
      break;
    case "O":
      if (ctx.origin) {
        console.warn(`Duplicate O: directive in file header, using last value`);
      }
      ctx.origin = parseOrigin(infoLine);
      break;
    default:
      throw new Error("unimplemented");
  }
}

function applyDirective(
  context: Partial<HeaderCtx>,
  directive: Directive,
): void {
  const value: string = directive.token.lexeme;

  // Other formatting directives
  const directiveMatch = value.match(/^%%(\w+)(?:\s+(.+))?$/);
  if (!directiveMatch) return;
  const [, dir, directiveValue] = directiveMatch;
  console.warn(`Unknown directive: %%${directive}`);
  if (!context.formatting) {
    context.formatting = new Map();
  }
  context.formatting.set(dir, directiveValue);
  throw new Error("unimplemented");
}

/** Info_line | Comment | Macro_decl | User_symbol_decl | Directive*/
export function tuneHead(header: Tune_header): Partial<HeaderCtx> {
  const headCtx: Partial<HeaderCtx> = {};
  for (const info_line of header.info_lines) {
    if (info_line instanceof Info_line) {
      applyInfoLine(headCtx, info_line);
    } else if (info_line instanceof Directive) {
      applyDirective(headCtx, info_line);
    } else {
      throw new Error("unimplemented");
    }
  }

  return headCtx;
}
