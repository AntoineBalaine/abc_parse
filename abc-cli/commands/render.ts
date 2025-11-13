/**
 * Render command: Render ABC files to SVG
 */

import { Command } from "commander";
import { readAbcFile, writeFile } from "../utils/shared";
// @ts-expect-error - Importing from compiled output (relative to output location)
import { renderAbcToSvg } from "../../abc-lsp-server/svg-renderer";
import { basename, dirname, join } from "path";

export const renderCommand = new Command("render")
  .description("Render an ABC file to SVG")
  .argument("<file>", "ABC file to render")
  .option("-o, --output <path>", "Output directory or file path")
  .option("--staffwidth <number>", "Width of the staff in pixels", "700")
  .option("--scale <number>", "Scale factor for the output", "1.0")
  .action((file: string, options: { output?: string; staffwidth?: string; scale?: string }) => {
    // Read the ABC file
    const content = readAbcFile(file);

    // Render to SVG
    const staffwidth = parseInt(options.staffwidth || "700", 10);
    const scale = parseFloat(options.scale || "1.0");

    try {
      const result = renderAbcToSvg(content, {
        staffwidth,
        scale,
      });

      if (result.metadata.warnings) {
        result.metadata.warnings.forEach((warning: string) => {
          console.warn(`Warning: ${warning}`);
        });
      }

      // Determine output path
      const baseName = basename(file, ".abc");
      const outputDir = options.output || dirname(file);

      // Write SVG files
      result.svgs.forEach((svg: string, index: number) => {
        const outputFileName = result.svgs.length === 1 ? `${baseName}.svg` : `${baseName}-${index + 1}.svg`;

        const outputPath = join(outputDir, outputFileName);
        writeFile(outputPath, svg);
        console.log(`Rendered: ${outputPath}`);
      });

      // console.log(`\n✓ Rendered ${result.metadata.tuneCount} tune(s) to ${result.svgs.length} SVG file(s)`);
    } catch (error: any) {
      console.error(`Error rendering SVG: ${error.message}`);
      process.exit(1);
    }
  });
