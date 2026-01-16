/**
 * Render command: Render ABC files to SVG
 */

import { Command } from "commander";
import { readAbcFile } from "../utils/shared";
import { renderAbcToSvg } from "../../abc-lsp-server/src/svg-renderer";
import { Scanner, parse, ABCContext, AbcFormatter, Tune, Info_line } from "../../parse/index";

/**
 * Because the X: info line stores its value as an array of tokens,
 * we need to extract the number from the first token.
 */
function getXNumber(tune: Tune): number | null {
  const infoLines = tune.tune_header.info_lines.filter((item): item is Info_line => item instanceof Info_line);

  const xInfoLine = infoLines.find((line) => line.key.lexeme.trim() === "X:");

  if (xInfoLine && xInfoLine.value.length > 0) {
    const xNumber = parseInt(xInfoLine.value[0].lexeme, 10);
    return isNaN(xNumber) ? null : xNumber;
  }

  return null;
}

/**
 * Because we support both comma-separated values and repeated flags,
 * we need to parse all tune numbers from the input.
 */
function parseTuneNumbers(tuneOptions: string | string[] | undefined): number[] {
  if (!tuneOptions) {
    return [];
  }

  // Because Commander.js provides either a string or an array of strings,
  // we need to handle both cases.
  const values = Array.isArray(tuneOptions) ? tuneOptions : [tuneOptions];

  const numbers: number[] = [];
  for (const value of values) {
    // Because the user can provide comma-separated values,
    // we need to split on commas.
    const parts = value
      .split(/[,-]/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
  }

  return numbers;
}

export const renderCommand = new Command("render")
  .description("Render an ABC file to SVG")
  .argument("<file>", "ABC file to render")
  .option("-t, --tune <numbers...>", "Render only the specified tunes by X:number (supports comma-separated, dash-separated or repeated flags)")
  .option("--ignore-parse-errors", "Continue rendering even if the ABC file has parsing errors")
  .option("--ignore-missing-tunes", "Continue rendering even if some requested tunes are not found")
  .action((file: string, options: { tune?: string | string[]; ignoreParseErrors?: boolean; ignoreMissingTunes?: boolean }) => {
    // Read the ABC file
    const content = readAbcFile(file);

    try {
      // Parse tune numbers if specified
      const requestedTunes = parseTuneNumbers(options.tune);

      let contentToRender = content;

      // Because we need to filter tunes by their X: number,
      // we must parse the file and filter before rendering.
      if (requestedTunes.length > 0) {
        const ctx = new ABCContext();
        const tokens = Scanner(content, ctx);
        const ast = parse(tokens, ctx);

        // Because parsing might fail, we need to check for errors.
        if (ctx.errorReporter.hasErrors()) {
          const errors = ctx.errorReporter.getErrors();
          if (options.ignoreParseErrors) {
            console.error("Warning: ABC file has parsing errors (ignoring):");
            errors.forEach((err) => console.error(`  ${err}`));
          } else {
            console.error("Error parsing ABC file:");
            errors.forEach((err) => console.error(`  ${err}`));
            process.exit(1);
          }
        }

        // Because the AST contents can include non-tune items,
        // we need to filter for only Tune objects.
        const allTunes = ast.contents.filter((item): item is Tune => item instanceof Tune);

        // Because we want only specific tunes, we filter by X: number.
        const filteredTunes = allTunes.filter((tune) => {
          const xNumber = getXNumber(tune);
          return xNumber !== null && requestedTunes.includes(xNumber);
        });

        // Because the user might request non-existent tune numbers,
        // we need to report missing tunes.
        if (filteredTunes.length === 0) {
          const availableXNumbers = allTunes.map((t) => getXNumber(t)).filter((x): x is number => x !== null);
          if (options.ignoreMissingTunes) {
            console.error(`Warning: None of the requested tunes (${requestedTunes.join(", ")}) found (ignoring).`);
            console.error(`Available tunes: ${availableXNumbers.join(", ")}`);
            // Because we're ignoring missing tunes and no tunes were found,
            // we fall back to rendering the original content.
            contentToRender = content;
          } else {
            console.error(`Error: None of the requested tunes (${requestedTunes.join(", ")}) found.`);
            console.error(`Available tunes: ${availableXNumbers.join(", ")}`);
            process.exit(1);
          }
        } else {
          // Because we want to warn about partially missing tunes,
          // we check which requested tunes were found.
          const foundXNumbers = filteredTunes.map((t) => getXNumber(t)).filter((x): x is number => x !== null);
          const missingTunes = requestedTunes.filter((x) => !foundXNumbers.includes(x));
          if (missingTunes.length > 0) {
            console.error(`Warning: Tunes not found: \n${missingTunes.join("\n")}`);
          }

          // Because we need to convert the filtered tunes back to ABC notation,
          // we use the formatter with stringify (without formatting).
          const formatter = new AbcFormatter(ctx);
          const tuneStrings = filteredTunes.map((tune) => formatter.stringify(tune, true));
          contentToRender = tuneStrings.join("\n\n");
        }
      }

      // Render the content (either filtered or original)
      const result = renderAbcToSvg(contentToRender);

      // Output warnings to stderr
      if (result.metadata.warnings) {
        result.metadata.warnings.forEach((warning: string) => {
          console.error(`Warning: ${warning}`);
        });
      }

      // Because we want all tunes rendered as a single output,
      // we concatenate all SVGs.
      const svgOutput = result.svgs.join("\n");

      // Output to stdout
      console.log(svgOutput);
    } catch (error: any) {
      console.error(`Error rendering SVG: ${error.message}`);
      process.exit(1);
    }
  });
