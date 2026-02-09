import { CSNode } from "../csTree/types";
import { Selection } from "../selection";
import { firstTokenData, lastTokenData, comparePositions } from "./treeWalk";

interface RangeWalkCtx {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  cursor: Set<number>;
  outputCursors: Set<number>[];
}

function walkRange(ctx: RangeWalkCtx, node: CSNode, inScope: boolean): void {
  let current: CSNode | null = node;
  while (current !== null) {
    const nowInScope = inScope || ctx.cursor.has(current.id);

    if (nowInScope) {
      const first = firstTokenData(current);
      const last = lastTokenData(current);
      // Trailing newline tokens in the CS tree have position = -1, so we skip
      // bounds checking for nodes whose first/last token has a negative position
      // and recurse into their children instead.
      if (first && last && first.position >= 0 && last.position >= 0) {
        const nodeStartLine = first.line;
        const nodeStartCol = first.position;
        const nodeEndLine = last.line;
        const nodeEndCol = last.position + last.lexeme.length;

        const startCmp = comparePositions(nodeStartLine, nodeStartCol, ctx.startLine, ctx.startCol);
        const endCmp = comparePositions(nodeEndLine, nodeEndCol, ctx.endLine, ctx.endCol);

        if (startCmp >= 0 && endCmp <= 0) {
          // Fully contained within range: select this node, skip children
          ctx.outputCursors.push(new Set([current.id]));
          current = current.nextSibling;
          continue;
        }

        // Entirely outside range: skip subtree
        const beforeRange = comparePositions(nodeEndLine, nodeEndCol, ctx.startLine, ctx.startCol) <= 0;
        const afterRange = comparePositions(nodeStartLine, nodeStartCol, ctx.endLine, ctx.endCol) >= 0;
        if (beforeRange || afterRange) {
          current = current.nextSibling;
          continue;
        }

        // Partial overlap: recurse into children first to find more specific matches
        const lengthBeforeRecursion = ctx.outputCursors.length;
        if (current.firstChild) {
          walkRange(ctx, current.firstChild, nowInScope);
        }
        // If no children were selected during recursion but this node overlaps, select it.
        // This handles the case of a single-char cursor on a multi-char token.
        if (ctx.outputCursors.length === lengthBeforeRecursion) {
          ctx.outputCursors.push(new Set([current.id]));
        }
        current = current.nextSibling;
        continue;
      }
    }

    // Node has invalid positions or not yet in scope: recurse into children
    if (current.firstChild) {
      walkRange(ctx, current.firstChild, nowInScope);
    }

    current = current.nextSibling;
  }
}

export function selectRange(
  input: Selection,
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number
): Selection {
  const outputCursors: Set<number>[] = [];

  for (const cursor of input.cursors) {
    const ctx: RangeWalkCtx = { startLine, startCol, endLine, endCol, cursor, outputCursors };
    walkRange(ctx, input.root, false);
  }

  return { root: input.root, cursors: outputCursors };
}
