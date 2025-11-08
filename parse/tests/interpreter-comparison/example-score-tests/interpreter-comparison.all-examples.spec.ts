/**
 * interpreter-comparison.all-examples.spec.ts
 *
 * Comprehensive comparison tests for all .abc files in example_scores/
 * Because we want to verify that our interpreter matches abcjs output,
 * we test all available example files systematically.
 */

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { discoverAbcFiles } from "./file-discovery";
import { ComparisonResult } from "../comparison-utils";
import { runComparison } from "../test-helpers";

// ============================================================================
// Test Configuration
// ============================================================================

const EXAMPLE_SCORES_DIR = path.resolve(__dirname, "../../../../example_scores");

// Files that cause issues (infinite loops, crashes, etc.) and should be skipped
const EXCLUDED_FILES = [
  "visual/Cont_SheneiZeitim.abc",
  "visual/Cont_w2.abc",
  "visual/GovoriSeDaMeVaras.abc",
  //
  "visual/NationalChars.abc",
  "visual/V_HelleWasser.abc",
  "visual/abcplus_accidentals_201_and_202_and_203.abc",
  "visual/abcplus_change_of_staff_system.abc",
  "visual/abcplus_inline_font_change.abc",
  "visual/escaped-lyrics.abc",
];

// ============================================================================
// Failure Tracking
// ============================================================================

interface FailureReport {
  filePath: string;
  relativePath: string;
  comparisonResult: ComparisonResult;
  error?: string;
}

const failures: FailureReport[] = [];

// ============================================================================
// Test Suite
// ============================================================================

describe("Interpreter Comparison - All Example Files", function () {
  // Because we're processing many files, we need a longer timeout
  this.timeout(120000);

  let abcFiles: string[] = [];

  before(function () {
    // Discover all .abc files in the example_scores directory
    console.log(`\nDiscovering .abc files in ${EXAMPLE_SCORES_DIR}...`);
    abcFiles = discoverAbcFiles(EXAMPLE_SCORES_DIR);
    console.log(`Found ${abcFiles.length} .abc files\n`);

    if (abcFiles.length === 0) {
      throw new Error(`No .abc files found in ${EXAMPLE_SCORES_DIR}`);
    }
  });

  it("should produce matching output for all example files", function () {
    let processedCount = 0;
    let errorCount = 0;

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

        // Run comparison between both parsers
        const result = runComparison(content, { strict: false });

        // Because we want to collect all failures for analysis,
        // we don't throw immediately but collect the results
        if (!result.matches) {
          failures.push({
            filePath,
            relativePath,
            comparisonResult: result,
          });
        }
      } catch (error) {
        // Because parser crashes are possible, we catch them and record
        errorCount++;
        failures.push({
          filePath,
          relativePath,
          comparisonResult: {
            matches: false,
            differences: [],
            metadata: {
              yourParser: { tuneCount: 0, voiceCount: 0, lineCount: 0, elementCount: 0, errors: 1, warnings: 0 },
              abcjs: { tuneCount: 0, voiceCount: 0, lineCount: 0, elementCount: 0, errors: 0, warnings: 0 },
            },
            typeDiscrepancies: [],
          },
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`\n=== Test Summary ===`);
    console.log(`Total files processed: ${processedCount}`);
    console.log(`Passing: ${processedCount - failures.length}`);
    console.log(`Failing: ${failures.length}`);
    if (errorCount > 0) {
      console.log(`Parser errors: ${errorCount}`);
    }

    // If we have failures, print detailed report
    if (failures.length > 0) {
      console.log(`\n=== Failure Details ===\n`);

      for (const failure of failures) {
        console.log(`File: ${failure.relativePath}`);

        if (failure.error) {
          console.log(`  Error: ${failure.error}`);
        } else {
          console.log(`  Differences found: ${failure.comparisonResult.differences.length}`);

          // Show the first few differences for context
          const maxDiffsToShow = 3;
          const diffsToShow = failure.comparisonResult.differences.slice(0, maxDiffsToShow);

          for (const diff of diffsToShow) {
            console.log(`    [${diff.severity}] ${diff.path}`);
            console.log(`      Yours:  ${JSON.stringify(diff.yours)}`);
            console.log(`      abcjs:  ${JSON.stringify(diff.abcjs)}`);
            if (diff.message) {
              console.log(`      Note:   ${diff.message}`);
            }
          }

          if (failure.comparisonResult.differences.length > maxDiffsToShow) {
            console.log(`    ... and ${failure.comparisonResult.differences.length - maxDiffsToShow} more differences`);
          }
        }

        console.log("");
      }

      // Fail the test with a summary
      throw new Error(`${failures.length} out of ${processedCount} files failed comparison`);
    }
  });

  after(function () {
    // Clear failures for next run
    failures.length = 0;
  });
});
