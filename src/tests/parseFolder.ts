// abc_parse/src/tests/parseFolder.ts
import fs from "fs";
import path from "path";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";

function processFile(filePath: string, errorLog: string[]) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const scanner = new Scanner(content);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens, content);
    const ast = parser.parse();

    if (ast === null) {
      // Log parsing failure but don't throw
      errorLog.push(`\nFile: ${filePath}`);
      errorLog.push("-".repeat(80));
      errorLog.push("Failed to parse file structure");
      if (parser.hasErrors()) {
        const errors = parser.getErrors();
        errors.forEach((error) => {
          errorLog.push(JSON.stringify(error));
        });
      }
    } else if (parser.hasErrors()) {
      // Log errors from successful parse
      errorLog.push(`\nFile: ${filePath}`);
      errorLog.push("-".repeat(80));
      const errors = parser.getErrors();
      errors.forEach((error) => {
        errorLog.push(JSON.stringify(error));
      });
    }
  } catch (err) {
    // Log any other errors
    console.error(`Error processing file ${filePath}:`, err);
    errorLog.push(`\nFile: ${filePath}`);
    errorLog.push("-".repeat(80));
    errorLog.push(`Failed to process file: ${err}`);
  }
}

function processDirectory(directoryPath: string): void {
  const errorLog: string[] = [];
  const failedFiles: string[] = [];

  function walkDir(currentPath: string) {
    const files = fs.readdirSync(currentPath);

    files.forEach((file) => {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (path.extname(file) === ".abc") {
        processFile(filePath, errorLog);
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
      "\nFailed files:",
      ...failedFiles,
      "\nDetailed Errors:",
      ...errorLog,
    ];
    fs.writeFileSync(logPath, summary.join("\n"));
    console.log(`Errors found and logged to ${logPath}`);
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
