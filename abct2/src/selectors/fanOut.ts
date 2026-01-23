import { CSNode, TAGS } from "../csTree/types";
import { Selection } from "../selection";

export type WalkStrategy = "all" | "skipChordChildren" | "onlyChordNotes";

interface FanOutCtx {
  cursor: Set<number>;
  outputCursors: Set<number>[];
  predicate: (node: CSNode) => boolean;
  walkStrategy: WalkStrategy;
}

function walk(ctx: FanOutCtx, node: CSNode, inScope: boolean, parentIsChord: boolean): void {
  let current: CSNode | null = node;
  while (current) {
    const nowInScope = inScope || ctx.cursor.has(current.id);
    const shouldMatch =
      ctx.walkStrategy === "onlyChordNotes"
        ? parentIsChord && nowInScope
        : nowInScope;

    if (shouldMatch && ctx.predicate(current)) {
      ctx.outputCursors.push(new Set([current.id]));
    }

    if (ctx.walkStrategy === "skipChordChildren" && current.tag === TAGS.Chord) {
      // Do not recurse into the chord's children
    } else if (current.firstChild) {
      walk(ctx, current.firstChild, nowInScope, current.tag === TAGS.Chord);
    }

    current = current.nextSibling;
  }
}

export function fanOutByPredicate(
  input: Selection,
  predicate: (node: CSNode) => boolean,
  walkStrategy: WalkStrategy
): Selection {
  const outputCursors: Set<number>[] = [];

  for (const cursor of input.cursors) {
    const ctx: FanOutCtx = { cursor, outputCursors, predicate, walkStrategy };
    walk(ctx, input.root, false, false);
  }

  return { root: input.root, cursors: outputCursors };
}
