import type { CSNode } from "../src/index";

export enum TestTag {
  Root = "root",
  A = "a",
  B = "b",
  C = "c",
  D = "d",
  E = "e",
}

export type TestData = string;
export type TNode = CSNode<TestTag, TestData>;

export function makeCtx() {
  let id = 0;
  return { generateId: () => id++ };
}
