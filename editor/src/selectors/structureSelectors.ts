import { CSNode, TAGS } from "../csTree/types";
import { Selection } from "../selection";

interface TuneWalkCtx {
  cursor: Set<number>;
  outputCursors: Set<number>[];
}

function walk(ctx: TuneWalkCtx, node: CSNode, inScope: boolean): void {
  let current: CSNode | null = node;
  while (current) {
    const nowInScope = inScope || ctx.cursor.has(current.id);

    if (nowInScope && current.tag === TAGS.Tune) {
      ctx.outputCursors.push(new Set([current.id]));
    }

    if (current.firstChild) {
      walk(ctx, current.firstChild, nowInScope);
    }

    current = current.nextSibling;
  }
}

export function selectTune(input: Selection): Selection {
  const outputCursors: Set<number>[] = [];

  for (const cursor of input.cursors) {
    const ctx: TuneWalkCtx = { cursor, outputCursors };
    walk(ctx, input.root, false);
  }

  return { root: input.root, cursors: outputCursors };
}
