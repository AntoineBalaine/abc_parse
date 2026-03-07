import { createNode as rawCreateNode, type CSNode, type CSNodeOf } from "../src/cstree";

export enum TestTag {
  Root = "root",
  A = "a",
  B = "b",
  C = "c",
  D = "d",
  E = "e",
}

export type TestDataMap = {
  [TestTag.Root]: string;
  [TestTag.A]: string;
  [TestTag.B]: string;
  [TestTag.C]: string;
  [TestTag.D]: string;
  [TestTag.E]: string;
};

export type TNode = CSNode<TestTag, TestDataMap>;

export function createNode<K extends TestTag>(tag: K, id: number, data: TestDataMap[K]): CSNodeOf<K, TestTag, TestDataMap> {
  return rawCreateNode<TestTag, TestDataMap, K>(tag, id, data);
}

export function makeCtx() {
  let id = 0;
  return { generateId: () => id++ };
}
