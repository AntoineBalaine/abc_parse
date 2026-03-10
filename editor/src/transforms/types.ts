import { IRational } from "abc-parser";
import { CSNode } from "../csTree/types";
import { Selection } from "../selection";

export type TransformFn = (selection: Selection, ...args: unknown[]) => Selection;

export type InspectionFn = (selection: Selection) => IRational[];

export function findNodesById(root: CSNode, ids: Set<number>): CSNode[] {
  const result: CSNode[] = [];
  walkCollect(root, ids, result);
  return result;
}

function walkCollect(node: CSNode, ids: Set<number>, result: CSNode[]): void {
  if (ids.has(node.id)) {
    result.push(node);
  }
  let child = node.firstChild;
  while (child !== null) {
    walkCollect(child, ids, result);
    child = child.nextSibling;
  }
}
