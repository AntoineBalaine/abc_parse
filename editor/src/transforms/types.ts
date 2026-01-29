import { Selection } from "../selection";
import { CSNode } from "../csTree/types";
import { IRational } from "abc-parser";

export type TransformFn = (selection: Selection, ...args: any[]) => Selection;

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
