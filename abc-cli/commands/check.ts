/**
 * Check command: Validate ABC files and print diagnostics
 */

import { Command } from "commander";
import { readAbcFile, parseAbc, printDiagnostics } from "../utils/shared";

export const checkCommand = new Command("check")
  .description("Check an ABC file for errors and warnings")
  .argument("<file>", "ABC file to check")
  .action((file: string) => {
    // Read the ABC file
    const content = readAbcFile(file);

    // Parse the ABC content
    const { ctx } = parseAbc(content);

    // Print diagnostics
    const hasErrors = printDiagnostics(ctx, file, content);

    if (hasErrors) {
      console.error("\n✗ File had errors");
      process.exit(1);
    }
  });
