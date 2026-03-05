/**
 * abc2midi command: Export ABC files to MIDI
 */

import { writeFileSync } from "fs";
import { abc2midi } from "abc-parser";
import { Command } from "commander";
import { readAbcFile, parseAbc, parseTuneNumbers } from "../utils/shared";

export const abc2midiCommand = new Command("abc2midi")
  .description("Export an ABC file to MIDI")
  .argument("<file>", "ABC file to export")
  .option("-o, --output <file>", "Output MIDI file path (writes to stdout if omitted)")
  .option("-t, --tune <numbers...>", "Export only the specified tunes by X:number (supports comma-separated, dash-separated or repeated flags)")
  .action((file: string, options: { output?: string; tune?: string | string[] }) => {
    if (file.endsWith(".abcx")) {
      console.error("Error: MIDI export is not supported for ABCx chord sheet files");
      process.exit(1);
    }

    const content = readAbcFile(file);
    const { ast, ctx } = parseAbc(content);

    if (ctx.errorReporter.hasErrors()) {
      const errors = ctx.errorReporter.getErrors();
      errors.forEach((err) => console.error(`Warning: ${err.message}`));
    }

    try {
      const tuneNumbers = parseTuneNumbers(options.tune);
      const midiBytes = abc2midi(ast, ctx, tuneNumbers.length > 0 ? { tuneNumbers } : undefined);

      if (options.output) {
        writeFileSync(options.output, midiBytes);
      } else {
        process.stdout.write(Buffer.from(midiBytes));
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });
