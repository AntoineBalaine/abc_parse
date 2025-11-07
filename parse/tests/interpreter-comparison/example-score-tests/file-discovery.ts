import * as fs from 'fs';
import * as path from 'path';

/**
 * Because we need to test all .abc files in the example_scores directory,
 * we recursively search for them and return their absolute paths.
 */
export function discoverAbcFiles(rootDir: string): string[] {
  const abcFiles: string[] = [];

  function searchDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        searchDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.abc')) {
        abcFiles.push(fullPath);
      }
    }
  }

  searchDirectory(rootDir);
  return abcFiles.sort();
}
