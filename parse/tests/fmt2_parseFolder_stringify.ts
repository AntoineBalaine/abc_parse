import fs from "fs";
import path from "path";
import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { AbcFormatter } from "../Visitors/Formatter2";
  // Helper function to remove any whitespace differences that aren't semantically meaningful
  function normalizeWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/[ \t]+$/gm, "") // Remove trailing whitespace on lines
      .trim(); // Remove leading/trailing whitespace
  }

  // Helper to process a single file and check stringify output
  function testStringifyFile(filePath: string): { success: boolean; error?: string } {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const ctx = new ABCContext();
      const tokens = Scanner(content, ctx);

      // Skip files that can't be parsed
      if (ctx.errorReporter.hasErrors()) {
        return {
          success: false,
          error: `Parse errors in ${filePath}: ${ctx.errorReporter.getErrors().length} errors`,
        };
      }

      const parseCtx = new ParseCtx(tokens, ctx);
      const ast = parseTune(parseCtx);
      if (!ast) {
        return {
          success: false,
          error: `Failed to parse ${filePath}`,
        };
      }

      const formatter = new AbcFormatter(ctx);
      const stringified = formatter.stringify(ast);

      // Compare normalized content to account for trivial whitespace differences
      const normalizedOriginal = normalizeWhitespace(content);
      const normalizedStringified = normalizeWhitespace(stringified);

      if (normalizedOriginal !== normalizedStringified) {
        return {
          success: false,
          error: `Stringify modified content in ${filePath}`,
        };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Error processing ${filePath}: ${err}`,
      };
    }
  }

  // Main recursive folder processor
  function processDirectory(directoryPath: string): {
    total: number;
    passed: number;
    failed: number;
    errors: Array<string>;
  } {
    const result = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [] as string[],
    };

    function walkDir(currentPath: string) {
      const files = fs.readdirSync(currentPath);

      files.forEach((file) => {
        const filePath = path.join(currentPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (path.extname(file) === ".abc") {
          result.total++;
          const testResult = testStringifyFile(filePath);

          if (testResult.success) {
            result.passed++;
          } else {
            result.failed++;
            if (testResult.error) {
              result.errors.push(testResult.error);
            }
          }
        }
      });
    }

    walkDir(directoryPath);
    return result;
  }
describe("Formatter2: StringifyFolder", function () {


  it("should not modify source when stringifying ABC files", function () {
    // Skip if no test directory is provided
    const testDir = process.env.ABC_TEST_DIR;
    if (!testDir) {
      this.skip();
      return;
    }

    // Set a longer timeout for processing many files
    this.timeout(30000);

    const results = processDirectory(testDir);

    // Log summary
    console.log(`Processed ${results.total} ABC files`);
    console.log(`- ${results.passed} files passed (stringify preserved content)`);
    console.log(`- ${results.failed} files failed`);

    if (results.errors.length > 0) {
      console.log("\nErrors:");
      results.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
      });
    }

    // Assert that all files pass
    assert.equal(results.failed, 0, `${results.failed} files were modified by stringify`);
  });

  it("should be skipped if no test directory is provided", function () {
    if (!process.env.ABC_TEST_DIR) {
      this.skip();
    }
  });
});
