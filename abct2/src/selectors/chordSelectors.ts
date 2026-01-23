import { CSNode, TAGS } from "../csTree/types";
import { Selection } from "../selection";

function collectNoteChildren(chordNode: CSNode): CSNode[] {
  const notes: CSNode[] = [];
  let child = chordNode.firstChild;
  while (child) {
    if (child.tag === TAGS.Note) {
      notes.push(child);
    }
    child = child.nextSibling;
  }
  return notes;
}

interface ChordWalkCtx {
  cursor: Set<number>;
  outputCursors: Set<number>[];
  pickNotes: (notes: CSNode[]) => CSNode[];
}

function walk(ctx: ChordWalkCtx, node: CSNode, inScope: boolean): void {
  let current: CSNode | null = node;
  while (current) {
    const nowInScope = inScope || ctx.cursor.has(current.id);

    if (nowInScope && current.tag === TAGS.Chord) {
      const notes = collectNoteChildren(current);
      const picked = ctx.pickNotes(notes);
      for (const n of picked) {
        ctx.outputCursors.push(new Set([n.id]));
      }
    }

    if (current.firstChild) {
      walk(ctx, current.firstChild, nowInScope);
    }

    current = current.nextSibling;
  }
}

function chordWalk(
  input: Selection,
  pickNotes: (notes: CSNode[]) => CSNode[]
): Selection {
  const outputCursors: Set<number>[] = [];

  for (const cursor of input.cursors) {
    const ctx: ChordWalkCtx = { cursor, outputCursors, pickNotes };
    walk(ctx, input.root, false);
  }

  return { root: input.root, cursors: outputCursors };
}

export function selectTop(input: Selection): Selection {
  return chordWalk(input, (notes) => {
    if (notes.length === 0) return [];
    return [notes[notes.length - 1]];
  });
}

export function selectBottom(input: Selection): Selection {
  return chordWalk(input, (notes) => {
    if (notes.length === 0) return [];
    return [notes[0]];
  });
}

export function selectNthFromTop(input: Selection, n: number): Selection {
  return chordWalk(input, (notes) => {
    const index = notes.length - 1 - n;
    if (index < 0 || index >= notes.length) return [];
    return [notes[index]];
  });
}

export function selectAllButTop(input: Selection): Selection {
  return chordWalk(input, (notes) => {
    if (notes.length < 2) return [];
    return notes.slice(0, notes.length - 1);
  });
}

export function selectAllButBottom(input: Selection): Selection {
  return chordWalk(input, (notes) => {
    if (notes.length < 2) return [];
    return notes.slice(1);
  });
}
