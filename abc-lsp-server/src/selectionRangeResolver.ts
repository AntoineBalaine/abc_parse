import { CSNode, isTokenNode, TokenData } from "../../abct2/src/csTree/types";
import { Selection } from "../../abct2/src/selection";
import { Range, Position } from "abc-parser";

export function findNodeById(root: CSNode, targetId: number): CSNode | null {
  if (root.id === targetId) return root;
  if (root.firstChild) {
    const found = findNodeById(root.firstChild, targetId);
    if (found) return found;
  }
  if (root.nextSibling) {
    const found = findNodeById(root.nextSibling, targetId);
    if (found) return found;
  }
  return null;
}

function tokenRange(data: TokenData): Range {
  return {
    start: { line: data.line, character: data.position },
    end: { line: data.line, character: data.position + data.lexeme.length },
  };
}

function firstLeafToken(node: CSNode): TokenData | null {
  if (isTokenNode(node)) return node.data;
  let child = node.firstChild;
  while (child) {
    const found = firstLeafToken(child);
    if (found) return found;
    child = child.nextSibling;
  }
  return null;
}

function lastLeafToken(node: CSNode): TokenData | null {
  let child = node.firstChild;
  let last: TokenData | null = null;
  while (child) {
    const found = lastLeafToken(child);
    if (found) last = found;
    child = child.nextSibling;
  }
  if (last) return last;
  if (isTokenNode(node)) return node.data;
  return null;
}

export function computeNodeRange(node: CSNode): Range | null {
  if (isTokenNode(node)) return tokenRange(node.data);
  const first = firstLeafToken(node);
  const last = lastLeafToken(node);
  if (!first || !last) return null;
  const start: Position = { line: first.line, character: first.position };
  const end: Position = { line: last.line, character: last.position + last.lexeme.length };
  return { start, end };
}

export function resolveSelectionRanges(selection: Selection): Range[] {
  const ranges: Range[] = [];

  for (const cursor of selection.cursors) {
    const id = [...cursor][0];
    const csNode = findNodeById(selection.root, id);
    if (!csNode) continue;

    const range = computeNodeRange(csNode);
    if (range) ranges.push(range);
  }

  return ranges;
}
