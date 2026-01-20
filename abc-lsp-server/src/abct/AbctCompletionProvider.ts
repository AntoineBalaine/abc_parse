// ABCT Auto-completion Provider
// Provides completion suggestions for transforms, selectors, files, and variables

import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

import {
  getCompletionContext,
  getDefinedVariables,
  CompletionContext,
} from "./completionContext";
import {
  transformRegistry,
  selectorRegistry,
  TransformInfo,
  SelectorInfo,
} from "../../../abct/src/registry";

/**
 * Provides completion items for an ABCT document at the given position.
 *
 * @param document - The ABCT text document
 * @param position - The cursor position
 * @returns Array of completion items
 */
export function provideAbctCompletions(
  document: TextDocument,
  position: Position
): CompletionItem[] {
  const context = getCompletionContext(document, position);

  switch (context.type) {
    case "transform":
      return getTransformCompletions(context.prefix);
    case "selector":
      return getSelectorCompletions(context.prefix);
    case "file":
      return getFileCompletions(document.uri, context.prefix);
    case "variable":
      return getVariableCompletions(document, position, context.prefix);
    case "selectorArg":
      return getSelectorArgCompletions(context);
    default:
      return [];
  }
}

/**
 * Returns completion items for transform functions.
 * Filters by prefix if provided.
 *
 * @param prefix - Partial transform name typed by the user
 * @returns Array of completion items for matching transforms
 */
function getTransformCompletions(prefix: string): CompletionItem[] {
  const items: CompletionItem[] = [];
  const normalizedPrefix = prefix.toLowerCase();

  for (const [name, info] of transformRegistry) {
    if (name.toLowerCase().startsWith(normalizedPrefix)) {
      items.push(createTransformCompletionItem(info));
    }
  }

  return items;
}

/**
 * Creates a completion item for a transform function.
 */
function createTransformCompletionItem(info: TransformInfo): CompletionItem {
  const argsDescription =
    info.args.length > 0
      ? info.args.map((a) => `${a.name}: ${a.type}${a.required ? "" : "?"}`).join(", ")
      : "no arguments";

  return {
    label: info.name,
    kind: CompletionItemKind.Function,
    detail: info.description,
    documentation: {
      kind: "markdown",
      value: `${info.documentation}\n\nArguments: ${argsDescription}\n\nExamples:\n${info.examples.map((e) => `- \`${e}\``).join("\n")}`,
    },
    insertText: info.name,
    sortText: info.name,
  };
}

/**
 * Returns completion items for selectors.
 * Includes both full form and short form.
 *
 * @param prefix - Partial selector name typed by the user (without @)
 * @returns Array of completion items for matching selectors
 */
function getSelectorCompletions(prefix: string): CompletionItem[] {
  const items: CompletionItem[] = [];
  const normalizedPrefix = prefix.toLowerCase();

  for (const info of selectorRegistry.values()) {
    // Full form
    if (info.name.toLowerCase().startsWith(normalizedPrefix)) {
      items.push(createSelectorCompletionItem(info, info.name, false));
    }

    // Short form (only if different from full and matches prefix)
    if (
      info.shortForm !== info.name &&
      info.shortForm.toLowerCase().startsWith(normalizedPrefix)
    ) {
      items.push(createSelectorCompletionItem(info, info.shortForm, true));
    }
  }

  return items;
}

/**
 * Creates a completion item for a selector.
 */
function createSelectorCompletionItem(
  info: SelectorInfo,
  form: string,
  isShortForm: boolean
): CompletionItem {
  const label = `@${form}`;
  const detail = isShortForm
    ? `${info.description} (short for @${info.name})`
    : info.description;

  return {
    label,
    kind: CompletionItemKind.Field,
    detail,
    documentation: {
      kind: "markdown",
      value: `${info.documentation}\n\nExamples:\n${info.examples.map((e) => `- \`${e}\``).join("\n")}`,
    },
    // Don't include @ in insertText since it's already typed
    insertText: form,
    sortText: isShortForm ? `1_${form}` : `0_${form}`, // Full forms first
  };
}

/**
 * Returns completion items for .abc files in the same directory as the document.
 *
 * @param documentUri - URI of the current document
 * @param prefix - Partial filename typed by the user
 * @returns Array of completion items for matching .abc files
 */
function getFileCompletions(documentUri: string, prefix: string): CompletionItem[] {
  const items: CompletionItem[] = [];

  try {
    // Convert file:// URI to path
    let dirPath: string;
    if (documentUri.startsWith("file://")) {
      const filePath = fileURLToPath(documentUri);
      dirPath = path.dirname(filePath);
    } else {
      dirPath = path.dirname(documentUri);
    }

    // Read directory contents
    if (!fs.existsSync(dirPath)) {
      return items;
    }

    const files = fs.readdirSync(dirPath);
    const normalizedPrefix = prefix.toLowerCase();

    for (const file of files) {
      // Only suggest .abc files
      if (!file.toLowerCase().endsWith(".abc")) {
        continue;
      }

      // Filter by prefix if provided
      if (normalizedPrefix && !file.toLowerCase().startsWith(normalizedPrefix)) {
        continue;
      }

      items.push({
        label: file,
        kind: CompletionItemKind.File,
        detail: "ABC file",
        insertText: file,
        sortText: file,
      });
    }
  } catch {
    // Silently ignore filesystem errors
  }

  return items;
}

/**
 * Returns completion items for variables defined in the document.
 *
 * @param document - The ABCT text document
 * @param position - Current cursor position
 * @param prefix - Partial variable name typed by the user
 * @returns Array of completion items for matching variables
 */
function getVariableCompletions(
  document: TextDocument,
  position: Position,
  prefix: string
): CompletionItem[] {
  const items: CompletionItem[] = [];
  const variables = getDefinedVariables(document, position);
  const normalizedPrefix = prefix.toLowerCase();

  for (const variable of variables) {
    if (variable.name.toLowerCase().startsWith(normalizedPrefix)) {
      items.push({
        label: variable.name,
        kind: CompletionItemKind.Variable,
        detail: `Defined at line ${variable.line}`,
        insertText: variable.name,
        sortText: variable.name,
      });
    }
  }

  return items;
}

/**
 * Returns completion items for selector arguments.
 * For voice selectors (@V:), suggests common voice names.
 * For measure selectors (@M:), suggests measure range formats.
 *
 * @param context - The completion context with selector information
 * @returns Array of completion items for selector arguments
 */
function getSelectorArgCompletions(context: CompletionContext): CompletionItem[] {
  const items: CompletionItem[] = [];

  if (!context.selector) {
    return items;
  }

  switch (context.selector.toLowerCase()) {
    case "v":
      // Voice selector arguments
      const voiceNames = ["melody", "bass", "tenor", "soprano", "alto", "1", "2", "3"];
      for (const name of voiceNames) {
        if (!context.prefix || name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
          items.push({
            label: name,
            kind: CompletionItemKind.EnumMember,
            detail: `Voice: ${name}`,
            insertText: name,
            sortText: name,
          });
        }
      }
      break;

    case "m":
      // Measure selector arguments - suggest common patterns
      const measurePatterns = [
        { label: "1", detail: "First measure" },
        { label: "1-4", detail: "Measures 1 through 4" },
        { label: "1-8", detail: "Measures 1 through 8" },
        { label: "5-8", detail: "Measures 5 through 8" },
      ];
      for (const pattern of measurePatterns) {
        if (!context.prefix || pattern.label.startsWith(context.prefix)) {
          items.push({
            label: pattern.label,
            kind: CompletionItemKind.EnumMember,
            detail: pattern.detail,
            insertText: pattern.label,
            sortText: pattern.label.padStart(4, "0"),
          });
        }
      }
      break;
  }

  return items;
}
