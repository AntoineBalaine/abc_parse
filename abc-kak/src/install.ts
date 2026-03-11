/**
 * abcls-kak-install
 *
 * Adds a `source` line for the abcls Kakoune plugin to the user's kakrc.
 * If the line already exists, it prints a message and exits without changes.
 *
 * Usage:
 *   abcls-kak-install [--kakrc <path>]
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function getDefaultKakrc(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdgConfig, "kak", "kakrc");
}

function parseArgs(argv: string[]): { kakrc: string } {
  const args = argv.slice(2);
  let kakrc = getDefaultKakrc();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--kakrc" && i + 1 < args.length) {
      kakrc = args[i + 1];
      i++;
    }
  }

  return { kakrc };
}

function main(): void {
  const { kakrc } = parseArgs(process.argv);

  // The rc/ directory is located relative to this script's position in the
  // published package: dist/install.js -> dist/../rc/abc.kak
  const rcDir = path.resolve(__dirname, "..", "rc");
  const abcKakPath = path.join(rcDir, "abc.kak");

  if (!fs.existsSync(abcKakPath)) {
    console.error(`Could not find abc.kak at ${abcKakPath}`);
    console.error("The package installation may be corrupted.");
    process.exit(1);
  }

  const sourceLine = `source "${abcKakPath}"`;

  // Ensure the kakrc directory exists
  const kakrcDir = path.dirname(kakrc);
  if (!fs.existsSync(kakrcDir)) {
    fs.mkdirSync(kakrcDir, { recursive: true });
    console.log(`Created directory: ${kakrcDir}`);
  }

  // Check if the kakrc already contains the source line
  if (fs.existsSync(kakrc)) {
    const content = fs.readFileSync(kakrc, "utf-8");
    if (content.includes("abc.kak")) {
      console.log("The abcls Kakoune plugin is already configured in your kakrc.");
      console.log(`  kakrc: ${kakrc}`);
      return;
    }
  }

  // Append the source line
  const lineToAppend = `\n# ABC notation plugin (abcls-kak)\n${sourceLine}\n`;
  fs.appendFileSync(kakrc, lineToAppend);

  console.log("abcls Kakoune plugin configured successfully.");
  console.log(`  Added to: ${kakrc}`);
  console.log(`  Source: ${abcKakPath}`);
  console.log("");
  console.log("Restart Kakoune to activate the plugin.");
}

main();
