import { convertFileToDeferred, ABCContext, Token, File_structure, Tune, Info_line, AbcFormatter } from "abc-parser";
import * as abcjs from "abcjs";

export interface Abc2MidiOptions {
  tuneNumbers?: number[];
}

/**
 * Because the X: info line stores its value as an array of tokens,
 * we need to extract the number from the first token.
 */
export function getXNumber(tune: Tune): number | null {
  const infoLines = tune.tune_header.info_lines.filter((item): item is Info_line => item instanceof Info_line);

  const xInfoLine = infoLines.find((line) => line.key.lexeme.trim() === "X:");

  if (xInfoLine && xInfoLine.value.length > 0) {
    const xNumber = parseInt(xInfoLine.value[0].lexeme, 10);
    return isNaN(xNumber) ? null : xNumber;
  }

  return null;
}

/**
 * Converts an ABC AST to MIDI binary data by preprocessing the AST
 * (filtering tunes, converting linear-style tunes to deferred style),
 * stringifying, and passing the result to abcjs's getMidiFile.
 */
export function abc2midi(ast: File_structure, ctx: ABCContext, options?: Abc2MidiOptions): Uint8Array {
  const allTunes = ast.contents.filter((item): item is Tune => item instanceof Tune);

  let tunes: Tune[];
  if (options?.tuneNumbers && options.tuneNumbers.length > 0) {
    const requested = new Set(options.tuneNumbers);
    tunes = allTunes.filter((tune) => {
      const xNum = getXNumber(tune);
      return xNum !== null && requested.has(xNum);
    });
    if (tunes.length === 0) {
      throw new Error("No tunes matched the specified X: numbers");
    }
  } else {
    tunes = allTunes;
  }

  const tuneSet = new Set(tunes);
  const filteredContents = ast.contents.filter((item) => item instanceof Token || tuneSet.has(item as Tune));
  const filteredAst = new File_structure(ctx.generateId(), ast.file_header, filteredContents, ast.linear, ast.formatterConfig);

  const convertedAst = filteredAst.linear ? convertFileToDeferred(filteredAst, ctx) : filteredAst;
  const formatter = new AbcFormatter(ctx);
  const abcString = formatter.stringify(convertedAst);

  // getMidiFile returns an array of Uint8Array (one per tune book entry),
  // but all tunes in the input string are merged into a single MIDI file.
  const result = abcjs.synth.getMidiFile(abcString, {
    midiOutputType: "binary",
  }) as Uint8Array[];
  if (!result || !Array.isArray(result) || result.length === 0) {
    throw new Error("MIDI generation failed: abcjs returned no data");
  }

  return result[0];
}
