/**
 * FileResolver - Resolves and loads ABC files referenced in ABCT documents.
 *
 * ABCT files can reference external .abc files using syntax like:
 *   source = song.abc
 *   melody = ./path/to/melody.abc
 *
 * This module resolves these paths relative to the ABCT file's directory
 * and loads the ABC content.
 */

import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { URI } from "vscode-uri";
import { ABCContext, Scanner, parse, File_structure } from "abc-parser";

/**
 * Result of loading an ABC file.
 */
export interface LoadedAbcFile {
  /** The full resolved path to the file */
  path: string;
  /** The raw ABC content */
  content: string;
  /** The parsed AST */
  ast: File_structure;
  /** The ABC context with any parse errors */
  ctx: ABCContext;
}

/**
 * Error thrown when file resolution or loading fails.
 */
export class FileResolverError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "FileResolverError";
  }
}

/**
 * FileResolver loads ABC files relative to an ABCT document's location.
 */
export class FileResolver {
  /** The base directory for relative path resolution (directory of the .abct file) */
  public readonly baseDir: string;

  /** Cache of already-loaded files to avoid re-parsing */
  private cache: Map<string, LoadedAbcFile> = new Map();

  /**
   * Create a FileResolver for an ABCT document.
   *
   * @param abctUri - The URI of the ABCT document (from TextDocument.uri)
   */
  constructor(abctUri: string) {
    // Convert URI to filesystem path and get directory
    const uri = URI.parse(abctUri);
    this.baseDir = dirname(uri.fsPath);
  }

  /**
   * Resolve a relative path to an absolute path.
   *
   * @param relativePath - The path from the ABCT file reference (e.g., "song.abc" or "./folder/song.abc")
   * @returns The absolute filesystem path
   */
  resolvePath(relativePath: string): string {
    return resolve(this.baseDir, relativePath);
  }

  /**
   * Load and parse an ABC file.
   *
   * @param path - The path to the ABC file (relative to the ABCT file)
   * @returns Promise resolving to the loaded file data
   * @throws FileResolverError if the file cannot be loaded or parsed
   */
  async loadAbc(path: string): Promise<LoadedAbcFile> {
    const fullPath = this.resolvePath(path);

    // Check cache first
    const cached = this.cache.get(fullPath);
    if (cached) {
      return cached;
    }

    try {
      // Read file content
      const content = await readFile(fullPath, "utf-8");

      // Parse the ABC content
      const ctx = new ABCContext();
      const tokens = Scanner(content, ctx);
      const ast = parse(tokens, ctx);

      const loaded: LoadedAbcFile = {
        path: fullPath,
        content,
        ast,
        ctx,
      };

      // Cache the result
      this.cache.set(fullPath, loaded);

      return loaded;
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FileResolverError(
          `File not found: ${path}`,
          fullPath,
          error
        );
      }
      if (error instanceof Error) {
        throw new FileResolverError(
          `Failed to load file: ${path} - ${error.message}`,
          fullPath,
          error
        );
      }
      throw new FileResolverError(
        `Failed to load file: ${path}`,
        fullPath
      );
    }
  }

  /**
   * Clear the file cache.
   * Call this when you want to force re-loading of files.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if a file has been cached.
   *
   * @param path - The relative path to check
   * @returns true if the file is in the cache
   */
  isCached(path: string): boolean {
    const fullPath = this.resolvePath(path);
    return this.cache.has(fullPath);
  }
}

/**
 * Create a FileResolver for an ABCT document.
 *
 * @param abctUri - The URI of the ABCT document
 * @returns A new FileResolver instance
 */
export function createFileResolver(abctUri: string): FileResolver {
  return new FileResolver(abctUri);
}
