import fs from "fs";
import { Scanner2 } from "../parsers/scan2";
import { processFile2 } from "./parseFolder";

// Get directory path from command line argument
const filePath = process.argv[2];

if (!filePath) {
  console.error("Please provide a directory path");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error("Directory does not exist");
  process.exit(1);
}

console.log(`Processing .abc files in ${filePath}...`);
let error_log: Array<string> = [];
processFile2(filePath, error_log);
