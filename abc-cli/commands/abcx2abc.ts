/**
 * ABCx to ABC conversion command
 *
 * Converts ABCx chord sheet notation to standard ABC notation
 */

import { Command } from "commander";
import { ABCContext, ScannerAbcx, parseAbcx, AbcxToAbcConverter, AbcFormatter } from "../../parse/index";
import { readAbcFile, writeFile, printDiagnostics } from "../utils/shared";

/**
 * Parse ABCx content and return the AST and context
 */
function parseAbcxContent(content: string) {
  const ctx = new ABCContext();
  const tokens = ScannerAbcx(content, ctx);
  const ast = parseAbcx(tokens, ctx);

  return { ast, ctx, tokens };
}

export const abcx2abcCommand = new Command("abcx2abc")
  .description("Convert ABCx chord sheet to ABC notation")
  .argument("<file>", "ABCx file to convert")
  .option("-o, --output <file>", "Write output to file instead of stdout")
  .action((file: string, options: { output?: string }) => {
    // Read the ABCx file
    const content = readAbcFile(file);

    // Parse the ABCx content
    const { ast, ctx } = parseAbcxContent(content);

    // Check for parsing errors
    if (ctx.errorReporter.hasErrors()) {
      console.error("Cannot convert file due to parsing errors:\n");
      printDiagnostics(ctx, file, content);
      process.exit(1);
    }

    if (!ast) {
      console.error("Failed to parse ABCx file");
      process.exit(1);
    }

    // Convert ABCx AST to ABC AST, then format to string
    const converter = new AbcxToAbcConverter(ctx);
    const abcAst = converter.convert(ast);
    const formatter = new AbcFormatter(ctx);
    const abcContent = formatter.stringify(abcAst);

    // Output the converted content
    if (options.output) {
      writeFile(options.output, abcContent);
      console.log(`Converted ${file} -> ${options.output}`);
    } else {
      console.log(abcContent);
    }
  });
