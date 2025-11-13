/**
 * Format command: Format ABC files with optional write-back
 */

import { Command } from "commander";
import { AbcFormatter } from "../../parse/index";
import { readAbcFile, writeFile, parseAbc, printDiagnostics } from "../utils/shared";

export const formatCommand = new Command("format")
  .description("Format an ABC file")
  .argument("<file>", "ABC file to format")
  .option("-w, --write", "Write formatted output back to the file")
  .action((file: string, options: { write?: boolean }) => {
    // Read the ABC file
    const content = readAbcFile(file);

    // Parse the ABC content
    const { ast, ctx } = parseAbc(content);

    // Check for parsing errors
    if (ctx.errorReporter.hasErrors()) {
      console.error("Cannot format file due to parsing errors:\n");
      printDiagnostics(ctx, file, content);
      process.exit(1);
    }

    // Format the ABC content
    if (!ast) {
      console.error("Failed to parse ABC file");
      process.exit(1);
    }

    const formatter = new AbcFormatter(ctx);
    const formattedContent = formatter.formatFile(ast);

    // Output the formatted content
    if (options.write) {
      writeFile(file, formattedContent);
      console.log(`Formatted ${file}`);
    } else {
      console.log(formattedContent);
    }
  });
