// ABCT Hover Provider
// Provides hover documentation for transforms, selectors, operators, and variables

import { Hover, MarkupContent, MarkupKind, Position } from "vscode-languageserver";
import {
  getTransformInfo,
  getSelectorInfo,
  TransformInfo,
  SelectorInfo,
} from "../../../abct/src/registry";
import {
  findNodeAtPosition,
  AstNode,
  isInApplicationPosition,
  collectVariables,
} from "../../../abct/src/ast-utils";
import {
  Program,
  Assignment,
  isIdentifier,
} from "../../../abct/src/ast";
import { getOperatorInfo, OperatorInfo } from "./operatorDocs";

/**
 * Provide hover information for an ABCT document at the given position.
 *
 * @param ast - The parsed ABCT Program AST
 * @param position - The cursor position (0-based line and character)
 * @returns Hover information or null if no hover available at the position
 */
export function provideHover(ast: Program, position: Position): Hover | null {
  // Both LSP and AST positions are 0-based
  const node = findNodeAtPosition(ast, position.line, position.character);
  if (!node) {
    return null;
  }

  // Check what type of node we're hovering over
  const nodeType = getNodeType(node);

  switch (nodeType) {
    case "pipe_op":
      return formatOperatorHover(getOperatorInfo("|"));

    case "update_op":
      return formatOperatorHover(getOperatorInfo("|="));

    case "concat_op":
      return formatOperatorHover(getOperatorInfo("+"));

    case "assignment_eq":
      return formatOperatorHover(getOperatorInfo("="));

    case "selector_at":
      return formatOperatorHover(getOperatorInfo("@"));

    case "selector_id":
      return formatSelectorIdHover(node);

    case "or_kw":
      return formatOperatorHover(getOperatorInfo("or"));

    case "and_kw":
      return formatOperatorHover(getOperatorInfo("and"));

    case "not_kw":
      return formatOperatorHover(getOperatorInfo("not"));

    case "filter_kw":
      return formatTransformHover(getTransformInfo("filter")!);

    case "identifier":
      return handleIdentifierHover(node, ast, position.line, position.character);

    default:
      return null;
  }
}

/**
 * Get the type of an AST node for hover purposes.
 */
function getNodeType(node: AstNode): string {
  if ("type" in node) {
    return node.type;
  }
  return "unknown";
}

/**
 * Handle hover on an identifier node.
 * The identifier could be a transform name or a variable reference.
 */
function handleIdentifierHover(
  node: AstNode,
  ast: Program,
  line: number,
  column: number
): Hover | null {
  if (!isIdentifier(node)) {
    return null;
  }

  const name = node.name;

  // Check if this identifier is in application position (first term of an application)
  // which means it's likely a transform name
  if (isInApplicationPosition(node, ast, line, column)) {
    const transformInfo = getTransformInfo(name);
    if (transformInfo) {
      return formatTransformHover(transformInfo);
    }
  }

  // Check if this identifier is a variable reference
  const variables = collectVariables(ast);
  const assignment = variables.get(name);

  // Only show variable hover if it's a reference, not the definition
  if (assignment && !isAtDefinitionSite(node, assignment)) {
    return formatVariableHover(name, assignment);
  }

  // If it's at the definition site, check if the identifier could still be a transform
  // (for standalone transform calls in expressions without explicit application)
  const transformInfo = getTransformInfo(name);
  if (transformInfo) {
    return formatTransformHover(transformInfo);
  }

  return null;
}

/**
 * Check if the node is at the definition site of a variable (left side of assignment).
 */
function isAtDefinitionSite(node: AstNode, assignment: Assignment): boolean {
  if (!("loc" in node) || !node.loc) {
    return false;
  }

  const nodeLoc = node.loc;
  const defLoc = assignment.idLoc;

  return (
    nodeLoc.start.line === defLoc.start.line &&
    nodeLoc.start.column === defLoc.start.column
  );
}

/**
 * Handle hover on a selector ID (the part after @).
 */
function formatSelectorIdHover(node: AstNode): Hover | null {
  if (!("id" in node)) {
    return null;
  }

  const id = (node as { id: string }).id;
  const selectorInfo = getSelectorInfo(id);

  if (selectorInfo) {
    return formatSelectorHover(selectorInfo);
  }

  return null;
}

/**
 * Format hover content for a transform.
 */
function formatTransformHover(info: TransformInfo): Hover {
  const lines: string[] = [];

  lines.push(`**${info.name}**`);
  lines.push("");
  lines.push(info.description);
  lines.push("");
  lines.push(info.documentation);

  if (info.args.length > 0) {
    lines.push("");
    lines.push("**Arguments:**");
    for (const arg of info.args) {
      const optionalText = arg.required ? "" : ", optional";
      const defaultText = arg.default ? ` (default: ${arg.default})` : "";
      lines.push(`- \`${arg.name}\` (${arg.type}${optionalText}) - ${arg.description}${defaultText}`);
    }
  }

  if (info.examples.length > 0) {
    lines.push("");
    lines.push("**Examples:**");
    lines.push("```abct");
    lines.push(...info.examples);
    lines.push("```");
  }

  if (info.seeAlso.length > 0) {
    lines.push("");
    lines.push(`**See also:** ${info.seeAlso.join(", ")}`);
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: lines.join("\n"),
    } as MarkupContent,
  };
}

/**
 * Format hover content for a selector.
 */
function formatSelectorHover(info: SelectorInfo): Hover {
  const lines: string[] = [];

  const shortFormText = info.shortForm ? ` (short: @${info.shortForm})` : "";
  lines.push(`**@${info.name}**${shortFormText}`);
  lines.push("");
  lines.push(info.description);
  lines.push("");
  lines.push(info.documentation);

  if (info.examples.length > 0) {
    lines.push("");
    lines.push("**Examples:**");
    lines.push("```abct");
    lines.push(...info.examples);
    lines.push("```");
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: lines.join("\n"),
    } as MarkupContent,
  };
}

/**
 * Format hover content for an operator.
 */
function formatOperatorHover(info: OperatorInfo | undefined): Hover | null {
  if (!info) {
    return null;
  }

  const lines: string[] = [];

  lines.push(`**${info.symbol}** (${info.name})`);
  lines.push("");
  lines.push(info.description);
  lines.push("");
  lines.push(info.documentation);

  if (info.examples.length > 0) {
    lines.push("");
    lines.push("**Examples:**");
    lines.push("```abct");
    lines.push(...info.examples);
    lines.push("```");
  }

  if (info.seeAlso.length > 0) {
    lines.push("");
    lines.push(`**See also:** ${info.seeAlso.join(", ")}`);
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: lines.join("\n"),
    } as MarkupContent,
  };
}

/**
 * Format hover content for a variable reference.
 */
function formatVariableHover(name: string, assignment: Assignment): Hover {
  const lines: string[] = [];

  lines.push(`**${name}** (variable)`);
  lines.push("");
  // Convert 0-based AST line to 1-based for user display
  // (users expect line numbers starting from 1 in editor UI)
  lines.push(`Defined at line ${assignment.loc.start.line + 1}:`);
  lines.push("");
  lines.push("```abct");
  lines.push(`${assignment.id} = ...`);
  lines.push("```");

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: lines.join("\n"),
    } as MarkupContent,
  };
}
