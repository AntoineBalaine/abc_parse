import { findChild, remove, replace, insertBefore as cstreeInsertBefore, appendChild as cstreeAppendChild } from "cstree";
import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { TT } from "abc-parser";

export function findChildByTag(parent: CSNode, tag: string): CSNode | null {
  return findChild(parent, (n) => n.tag === tag);
}

export function findRhythmChild(parent: CSNode): CSNode | null {
  return findChild(parent, (n) => n.tag === TAGS.Rhythm);
}

export function findTieChild(parent: CSNode): CSNode | null {
  return findChild(parent, (n) => isTokenNode(n) && getTokenData(n).tokenType === TT.TIE);
}

export function replaceNodeWithSequence(oldNode: CSNode, newNodes: CSNode[]): void {
  if (newNodes.length === 0) {
    remove(oldNode);
    return;
  }
  for (const newNode of newNodes) {
    cstreeInsertBefore(oldNode, newNode);
  }
  remove(oldNode);
}

export function replaceRhythm(parent: CSNode, newRhythm: CSNode | null): void {
  const existing = findRhythmChild(parent);
  if (existing) {
    if (newRhythm) {
      replace(existing, newRhythm);
    } else {
      remove(existing);
    }
    return;
  }
  if (newRhythm === null) return;
  const tie = findTieChild(parent);
  if (tie) {
    cstreeInsertBefore(tie, newRhythm);
  } else {
    cstreeAppendChild(parent, newRhythm);
  }
}

export function getNodeLineAndChar(node: CSNode): { line: number; char: number } {
  let current: CSNode | null = node;
  while (current !== null) {
    if (isTokenNode(current)) {
      const data = getTokenData(current);
      return { line: data.line, char: data.position };
    }
    current = current.firstChild;
  }
  return { line: 0, char: 0 };
}
