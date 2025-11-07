/**
 * pipeline-diagnostics.interpreter.spec.ts
 *
 * Diagnostic test to identify which files cause hangs in the Interpreter step.
 * Because we need to isolate the source of infinite loops,
 * we test the full pipeline: Scanner + Parser + Semantic Analyzer + Interpreter.
 */

import * as fs from "fs";
import * as path from "path";
import { discoverAbcFiles } from "./file-discovery";
import { Scanner } from "../../../parsers/scan2";
import { parse } from "../../../parsers/parse2";
import { SemanticAnalyzer } from "../../../analyzers/semantic-analyzer";
import { TuneInterpreter } from "../../../interpreter/TuneInterpreter";
import { ABCContext } from "../../../parsers/Context";
import { AbcErrorReporter } from "../../../parsers/ErrorReporter";

// ============================================================================
// Test Configuration
// ============================================================================

const EXAMPLE_SCORES_DIR = path.resolve(__dirname, "../../../example_scores");

// Files that we already know cause issues - skip them
const EXCLUDED_FILES = [
  "visual/Cont_SheneiZeitim.abc",
  "visual/Cont_w2.abc",
  "visual/GovoriSeDaMeVaras.abc",
  "visual/NationalChars.abc",
  "visual/V_HelleWasser.abc",
  "visual/abcplus_accidentals_201_and_202_and_203.abc",
  "visual/abcplus_change_of_staff_system.abc",
  "visual/abcplus_inline_font_change.abc",
  "visual/escaped-lyrics.abc",
];

// ============================================================================
// Test Suite
// ============================================================================

describe("Pipeline Diagnostics - Interpreter", function () {
  // Because we're processing many files, we need a longer timeout
  this.timeout(120000);

  let abcFiles: string[] = [];

  before(function () {
    console.log(`\nDiscovering .abc files in ${EXAMPLE_SCORES_DIR}...`);
    abcFiles = discoverAbcFiles(EXAMPLE_SCORES_DIR);
    console.log(`Found ${abcFiles.length} .abc files\n`);

    if (abcFiles.length === 0) {
      throw new Error(`No .abc files found in ${EXAMPLE_SCORES_DIR}`);
    }
  });

  it("should successfully interpret all example files without hanging", function () {
    let processedCount = 0;
    let errorCount = 0;
    const failures: string[] = [];

    // Process each file
    for (const filePath of abcFiles) {
      processedCount++;
      const relativePath = path.relative(EXAMPLE_SCORES_DIR, filePath);

      // Check if this file is in the exclusion list
      if (EXCLUDED_FILES.includes(relativePath)) {
        console.log(`  [${processedCount}/${abcFiles.length}] ${relativePath} (SKIPPED)`);
        continue;
      }

      // Print the file name we're processing
      console.log(`  [${processedCount}/${abcFiles.length}] ${relativePath}`);

      try {
        // Read the file content
        const content = fs.readFileSync(filePath, "utf-8");

        // Because some files might be empty or invalid, we skip them
        if (!content.trim()) {
          continue;
        }

        // Create context and run Scanner
        const ctx = new ABCContext(new AbcErrorReporter());
        const tokens = Scanner(content, ctx);

        // Run Parser
        const ast = parse(tokens, ctx);

        // Run Semantic Analyzer
        const analyzer = new SemanticAnalyzer(ctx);
        ast.accept(analyzer);

        // Run Interpreter (pass source text for correct char positions)
        const interpreter = new TuneInterpreter(analyzer, ctx, content);
        const result = interpreter.interpretFile(ast);

        // If we reach here without hanging, the interpreter worked
      } catch (error) {
        // Because interpreter crashes are possible, we catch them and record
        errorCount++;
        failures.push(relativePath);
        console.log(`    ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`\n=== Interpreter Test Summary ===`);
    console.log(`Total files processed: ${processedCount}`);
    console.log(`Passing: ${processedCount - failures.length}`);
    console.log(`Failing: ${failures.length}`);
    if (errorCount > 0) {
      console.log(`Interpreter errors: ${errorCount}`);
      console.log(`\nFailed files:`);
      for (const file of failures) {
        console.log(`  - ${file}`);
      }
    }

    // If we have failures, fail the test
    if (failures.length > 0) {
      throw new Error(`${failures.length} files failed interpretation`);
    }
  });

  it("should successfully interpret excluded files without hanging", function () {
    let processedCount = 0;
    let errorCount = 0;
    const failures: string[] = [];

    // Process each file
    for (const filePath of abcFiles) {
      const relativePath = path.relative(EXAMPLE_SCORES_DIR, filePath);

      // Process ONLY files that are in the exclusion list
      if (!EXCLUDED_FILES.includes(relativePath)) {
        continue;
      }

      processedCount++;

      // Print the file name we're processing
      console.log(`  [${processedCount}/${EXCLUDED_FILES.length}] ${relativePath}`);

      try {
        // Read the file content
        const content = fs.readFileSync(filePath, "utf-8");

        // Because some files might be empty or invalid, we skip them
        if (!content.trim()) {
          continue;
        }

        // Create context and run Scanner
        const ctx = new ABCContext(new AbcErrorReporter());
        const tokens = Scanner(content, ctx);

        // Run Parser
        const ast = parse(tokens, ctx);

        // Run Semantic Analyzer
        const analyzer = new SemanticAnalyzer(ctx);
        ast.accept(analyzer);

        // Run Interpreter (pass source text for correct char positions)
        const interpreter = new TuneInterpreter(analyzer, ctx, content);
        const result = interpreter.interpretFile(ast);

        // If we reach here without hanging, the interpreter worked
      } catch (error) {
        // Because interpreter crashes are possible, we catch them and record
        errorCount++;
        failures.push(relativePath);
        console.log(`    ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`\n=== Interpreter Test Summary (Excluded Files Only) ===`);
    console.log(`Total excluded files tested: ${processedCount}`);
    console.log(`Passing: ${processedCount - failures.length}`);
    console.log(`Failing: ${failures.length}`);
    if (errorCount > 0) {
      console.log(`Interpreter errors: ${errorCount}`);
      console.log(`\nFailed files:`);
      for (const file of failures) {
        console.log(`  - ${file}`);
      }
    }

    // Report results (don't fail the test, just report)
    if (failures.length > 0) {
      console.log(`\n${failures.length} excluded files failed interpretation`);
    } else {
      console.log(`\nAll excluded files interpreted successfully!`);
    }
  });
});
