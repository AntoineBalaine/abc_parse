/**
 * ABCx Parser - Parses ABCx chord sheet notation into AST
 *
 * ABCx is a simplified subset of ABC notation for chord sheet transcriptions.
 * The parser produces the same AST types as the ABC parser, with the addition
 * of ChordSymbol expressions for chord names.
 *
 * This parser reuses the ParseCtx class and shared parser functions from parse2.ts
 * to avoid code duplication.
 */

import {
  ChordSymbol,
  Expr,
  File_header,
  File_structure,
  Info_line,
  MultiMeasureRest,
  System,
  Tune,
  Tune_Body,
  tune_body_code,
  Tune_header,
  Comment,
} from "../types/Expr2";
import { ABCContext } from "./Context";
import { parseDirective } from "./infoLines/parseDirective";
import { Token, TT } from "./scan2";
import {
  ParseCtx,
  prsComment,
  prsInfoLine,
  parseBarline,
  parseAnnotation,
  parseInlineField,
  parseInvalidToken,
  isTuneStart,
  isTune,
} from "./parse2";

/**
 * Main ABCx parser function
 */
export function parseAbcx(tokens: Token[], abcContext: ABCContext): File_structure {
  const ctx = new ParseCtx(tokens, abcContext);
  const seq: Array<Tune | Token> = [];
  const fileHeader = parseAbcxFileHeader(ctx);

  while (!ctx.isAtEnd()) {
    const cur = ctx.peek();

    if (isTune(ctx)) {
      parseAbcxTune(ctx, seq);
      continue;
    }

    switch (cur.type) {
      case TT.SCT_BRK:
        ctx.advance();
        continue;
      case TT.FREE_TXT:
        seq.push(ctx.advance());
        continue;
      case TT.INVALID:
        seq.push(ctx.advance());
        continue;
      default:
        ctx.report("parser: unexpected token");
        seq.push(ctx.advance());
    }
  }

  return new File_structure(ctx.abcContext.generateId(), fileHeader, seq);
}

// isTuneStart and isTune are imported from parse2.ts to avoid code duplication

/**
 * Parse ABCx file header
 */
function parseAbcxFileHeader(ctx: ParseCtx): File_header | null {
  // Check if there's a tune start before section break
  let pos = ctx.current;
  let tok = ctx.tokens[pos];

  while (!(pos >= ctx.tokens.length || tok.type === TT.EOF)) {
    if (isTuneStart(tok)) return null;
    if (tok.type === TT.SCT_BRK) break;
    pos += 1;
    tok = ctx.tokens[pos];
  }

  const contents: Array<Expr | Token> = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    if (prsComment(ctx, contents)) continue;
    if (parseDirective(ctx, contents)) continue;
    if (prsInfoLine(ctx, contents)) continue;
    if (ctx.check(TT.EOL)) {
      ctx.advance();
      continue;
    }
    if (ctx.check(TT.FREE_TXT)) {
      contents.push(ctx.advance());
      continue;
    }
    ctx.advance();
  }

  return new File_header(ctx.abcContext.generateId(), contents);
}

/**
 * Parse an ABCx tune (header + body)
 */
function parseAbcxTune(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Tune {
  const tuneHeader = parseAbcxTuneHeader(ctx);
  const tuneBody = parseAbcxBody(ctx);

  const tune = new Tune(ctx.abcContext.generateId(), tuneHeader, tuneBody);
  if (prnt_arr) prnt_arr.push(tune);
  return tune;
}

/**
 * Parse ABCx tune header
 */
function parseAbcxTuneHeader(ctx: ParseCtx): Tune_header {
  const infoLines: Array<Expr> = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    if (prsComment(ctx, infoLines)) continue;
    if (parseDirective(ctx, infoLines)) continue;
    if (prsInfoLine(ctx, infoLines)) {
      const info_line = infoLines[infoLines.length - 1] as Info_line;
      // Break on K: (key) line which ends the header
      if (info_line.key.lexeme.trim() === "K:") break;
      continue;
    }

    if (ctx.check(TT.EOL)) {
      ctx.advance();
      continue;
    }

    // Break on music content (chord symbols, barlines)
    if (ctx.check(TT.CHORD_SYMBOL) || ctx.check(TT.BARLINE)) {
      break;
    }

    break;
  }

  ctx.match(TT.EOL);
  return new Tune_header(ctx.abcContext.generateId(), infoLines as Array<Info_line | Comment>, []);
}

/**
 * Parse ABCx tune body
 */
function parseAbcxBody(ctx: ParseCtx): Tune_Body | null {
  const elements: Array<tune_body_code> = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    if (prsComment(ctx, elements)) continue;
    if (parseDirective(ctx, elements)) continue;
    if (prsInfoLine(ctx, elements)) continue;
    if (parseAbcxMusicCode(ctx, elements)) continue;

    elements.push(ctx.advance());
  }

  // ABCx doesn't support multi-voice, so voices list is empty
  return new Tune_Body(ctx.abcContext.generateId(), parseAbcxSystems(elements), []);
}

/**
 * Parse ABCx music code (chord symbols, barlines, annotations, rests)
 */
function parseAbcxMusicCode(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Array<Expr | Token> | null {
  const elements: Array<Expr | Token> = [];

  while (
    !ctx.isAtEnd() &&
    !ctx.check(TT.EOL) &&
    !ctx.check(TT.COMMENT) &&
    !ctx.check(TT.INF_HDR) &&
    !ctx.check(TT.SCT_BRK)
  ) {
    // WS tokens pass through - the formatter handles whitespace
    if (ctx.check(TT.WS)) {
      elements.push(ctx.advance());
      continue;
    }

    const element =
      parseAbcxChordSymbol(ctx, elements) ||
      parseBarline(ctx, elements) ||
      parseAnnotation(ctx, elements) ||
      parseInlineField(ctx, elements) ||
      parseAbcxMultiMeasureRest(ctx, elements) ||
      parseInvalidToken(ctx, elements);

    if (element) continue;
    break;
  }

  if (elements.length > 0) {
    if (prnt_arr) {
      elements.forEach((e) => prnt_arr.push(e));
    }
    return elements;
  }

  return null;
}

/**
 * Parse a chord symbol (e.g., Am7, Cmaj7#11, Bb/D)
 */
function parseAbcxChordSymbol(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): ChordSymbol | null {
  if (!ctx.match(TT.CHORD_SYMBOL)) {
    return null;
  }

  const chordSymbol = new ChordSymbol(ctx.abcContext.generateId(), ctx.previous());
  prnt_arr && prnt_arr.push(chordSymbol);
  return chordSymbol;
}

/**
 * Parse a multi-measure rest (Z or Z followed by number)
 */
function parseAbcxMultiMeasureRest(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): MultiMeasureRest | null {
  if (!ctx.match(TT.REST)) {
    return null;
  }

  const restToken = ctx.previous();

  // Check if it's a multi-measure rest (Z)
  if (!/^[Z]/.test(restToken.lexeme)) {
    // Rewind - ABCx doesn't support regular rests
    ctx.current--;
    return null;
  }

  // Extract length from the rest token if present (e.g., Z4 -> length is 4)
  const lengthMatch = /^Z([0-9]+)$/.exec(restToken.lexeme);
  let lengthToken: Token | undefined;

  if (lengthMatch) {
    // Create a synthetic token for the length
    // The length is embedded in the REST token
  }

  const mmRest = new MultiMeasureRest(ctx.abcContext.generateId(), restToken, lengthToken);
  prnt_arr && prnt_arr.push(mmRest);
  return mmRest;
}

// prsInfoLine and parseInvalidToken are imported from parse2.ts to avoid code duplication

/**
 * Group ABCx elements into systems (one system per line)
 * EOL tokens are included at the end of each system (matching regular ABC parser behavior)
 */
function parseAbcxSystems(elements: tune_body_code[]): System[] {
  const systems: System[] = [];
  let currentSystem: System = [];

  for (const element of elements) {
    if (element instanceof Token && element.type === TT.EOL) {
      // Include the EOL token at the end of the system (like regular ABC parser)
      currentSystem.push(element);
      if (currentSystem.length > 0) {
        systems.push(currentSystem);
        currentSystem = [];
      }
    } else {
      currentSystem.push(element);
    }
  }

  // Don't forget the last system
  if (currentSystem.length > 0) {
    systems.push(currentSystem);
  }

  return systems;
}
