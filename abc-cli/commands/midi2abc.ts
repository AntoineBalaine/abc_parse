import { readFileSync, writeFileSync } from "fs";
import { midi2abc } from "abc-midi";
import type { ConversionOptions } from "abc-midi";
import { Command } from "commander";

export const midi2abcCommand = new Command("midi2abc")
  .description("Convert a MIDI file to ABC notation")
  .argument("<file>", "MIDI file to convert (.mid or .midi)")
  .option("-o, --output <file>", "Output ABC file path (writes to stdout if omitted)")
  .option("--title <title>", "Set the title (T: field)")
  .option("--composer <composer>", "Set the composer (C: field)")
  .action((file: string, options: { output?: string; title?: string; composer?: string }) => {
    if (!file.endsWith(".mid") && !file.endsWith(".midi")) {
      console.error("Error: input file must have a .mid or .midi extension");
      process.exit(1);
    }

    let midiBytes: Buffer;
    try {
      midiBytes = readFileSync(file);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: could not read file: ${msg}`);
      process.exit(1);
    }

    const conversionOptions: ConversionOptions = {};
    if (options.title) conversionOptions.title = options.title;
    if (options.composer) conversionOptions.composer = options.composer;

    try {
      const abcString = midi2abc(new Uint8Array(midiBytes), conversionOptions);
      if (options.output) {
        writeFileSync(options.output, abcString);
      } else {
        process.stdout.write(abcString);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });
