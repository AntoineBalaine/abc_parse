// abc_parse/src/tests/parseFolder.ts
import fs from "fs";
import path from "path";
import { isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { AbcError, AbcErrorReporter } from "../parsers/ErrorReporter";
import { Scanner } from "../parsers/scan2";

function formatError(error: AbcError, sourceContent: string): string {
  const lines = sourceContent.split("\n");
  if (isToken(error.token)) {
    const errorLine = lines[error.token?.line];
    const position = error.token?.position;

    return [``, errorLine, " ".repeat(position) + "^", " ".repeat(position) + `${error.message} - line ${error.token.line + 1}:${position + 1}`].join(
      "\n"
    );
  } else {
    return "";
  }
}

/**
 * Uses scan2 instead of the old-version parser.
 */
export function processFile2(filePath: string, errorLog: string[]): boolean {
  try {
    const ctx = new ABCContext();
    const content = fs.readFileSync(filePath, "utf-8");

    const reporter = new AbcErrorReporter();
    const tokens = Scanner(content, ctx);
    if (tokens.length === 0) {
      // Log parsing failure but don't throw
      errorLog.push(`\nFile: ${filePath}`);
      errorLog.push("-".repeat(80));
      errorLog.push("Failed to parse file structure");
      if (reporter.hasErrors()) {
        const errors = reporter.getErrors();
        errors.forEach((error) => {
          errorLog.push(JSON.stringify(error));
        });
      }
      return true;
    } else if (reporter.hasErrors()) {
      // Log errors from successful parse
      errorLog.push(`\nFile: ${filePath}`);
      errorLog.push("-".repeat(80));
      const errors = reporter.getErrors();
      errors.forEach((error) => {
        errorLog.push(formatError(error, content));
      });
      return true;
    }
    return false;
  } catch (err) {
    // Log any other errors
    console.error(`Error processing file ${filePath}:`, err);
    errorLog.push(`\nFile: ${filePath}`);
    errorLog.push("-".repeat(80));
    errorLog.push(`Failed to process file: ${err}`);
    return true;
  }
}
// function processFile(filePath: string, errorLog: string[]): boolean {
//   try {
//     const ctx = new ABCContext();
//     const content = fs.readFileSync(filePath, "utf-8");
//     const scanner = new Scanner(content, ctx);
//     const tokens = scanner.scanTokens();
//     const parser = new Parser(tokens, ctx);
//     const ast = parser.parse();

//     if (ast === null) {
//       // Log parsing failure but don't throw
//       errorLog.push(`\nFile: ${filePath}`);
//       errorLog.push("-".repeat(80));
//       errorLog.push("Failed to parse file structure");
//       if (parser.hasErrors()) {
//         const errors = parser.getErrors();
//         errors.forEach((error) => {
//           errorLog.push(JSON.stringify(error));
//         });
//       }
//       return true;
//     } else if (parser.hasErrors()) {
//       // Log errors from successful parse
//       errorLog.push(`\nFile: ${filePath}`);
//       errorLog.push("-".repeat(80));
//       const errors = parser.getErrors();
//       errors.forEach((error) => {
//         errorLog.push(formatError(error, content));
//       });
//       return true;
//     }
//     return false;
//   } catch (err) {
//     // Log any other errors
//     console.error(`Error processing file ${filePath}:`, err);
//     errorLog.push(`\nFile: ${filePath}`);
//     errorLog.push("-".repeat(80));
//     errorLog.push(`Failed to process file: ${err}`);
//     return true;
//   }
// }

function processDirectory(directoryPath: string): void {
  const errorLog: string[] = [];
  const failedFiles: string[] = [];
  let files_processed = 0;

  function walkDir(currentPath: string) {
    const files = fs.readdirSync(currentPath);

    files.forEach((file) => {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (path.extname(file) === ".abc") {
        console.log("Processing file:", filePath);
        const had_error = processFile2(filePath, errorLog);
        files_processed += 1;
        if (had_error) {
          failedFiles.push(filePath);
        }
      }
    });
  }

  try {
    walkDir(directoryPath);

    if (errorLog.length > 0) {
      const logPath = path.join(process.cwd(), "error.log");
      fs.writeFileSync(logPath, errorLog.join("\n"));
      console.log(`Errors found and logged to ${logPath}`);
    } else {
      console.log("No errors found in any files.");
    }
  } catch (err) {
    console.error("Error processing directory:", err);
  }

  if (errorLog.length > 0) {
    const logPath = path.join(process.cwd(), "error.log");
    const summary = [
      "ABC Parser Error Summary",
      "=====================",
      `Total files with errors: ${failedFiles.length}`,
      "\nRead files:",
      `${files_processed}`,
      "\nFailed files:",
      ...failedFiles,
      "\nDetailed Errors:",
      ...errorLog,
    ];
    fs.writeFileSync(logPath, summary.join("\n"));
    console.log(`Errors found and logged to ${logPath}`);
    console.log(`${files_processed} read files`);
    console.log(`${failedFiles.length} files had errors`);
  }
}

// Get directory path from command line argument
const directoryPath = process.argv[2];

if (!directoryPath) {
  console.error("Please provide a directory path");
  process.exit(1);
}

if (!fs.existsSync(directoryPath)) {
  console.error("Directory does not exist");
  process.exit(1);
}

console.log(`Processing .abc files in ${directoryPath}...`);
processDirectory(directoryPath);
