import { CSNode } from "./csTree/types";

export type Cursor = Set<number>;

export interface Selection {
  root: CSNode;
  cursors: Cursor[];
}

export function createSelection(root: CSNode): Selection {
  return { root, cursors: [new Set([root.id])] };
}
