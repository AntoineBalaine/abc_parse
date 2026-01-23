import * as fc from "fast-check";
import { Scanner } from "../../parse/parsers/scan2";
import { parse } from "../../parse/parsers/parse2";
import { ABCContext } from "../../parse/parsers/Context";
import { fromAst } from "../src/csTree/fromAst";
import { CSNode } from "../src/csTree/types";
import { createSelection, Selection } from "../src/selection";
import * as ParserGen from "../../parse/tests/prs_pbt.generators.spec";

export function toCSTree(source: string): CSNode {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  return fromAst(ast);
}

export function toSelection(source: string): Selection {
  return createSelection(toCSTree(source));
}

function walkIterative(result: CSNode[], start: CSNode): void {
  let current: CSNode | null = start;
  while (current) {
    result.push(current);
    if (current.firstChild) {
      walkIterative(result, current.firstChild);
    }
    current = current.nextSibling;
  }
}

export function collectAll(root: CSNode): CSNode[] {
  const result: CSNode[] = [];
  walkIterative(result, root);
  return result;
}

export function collectSubtree(root: CSNode): CSNode[] {
  const result: CSNode[] = [root];
  if (root.firstChild) {
    walkIterative(result, root.firstChild);
  }
  return result;
}

export function findByTag(root: CSNode, tag: string): CSNode[] {
  return collectAll(root).filter((n) => n.tag === tag);
}

export function siblingCount(node: CSNode): number {
  let count = 0;
  let current = node.firstChild;
  while (current) {
    count++;
    current = current.nextSibling;
  }
  return count;
}

export function findById(root: CSNode, id: number): CSNode | undefined {
  return collectAll(root).find((n) => n.id === id);
}

// --- fast-check arbitraries built on top of existing parser generators ---

function tokensToString(tokens: { lexeme: string }[]): string {
  return tokens.map((t) => t.lexeme).join("");
}

export const genAbcTune: fc.Arbitrary<string> = ParserGen.genMusicSequence_NoBar.map(
  (sequence) => "X:1\nK:C\n" + tokensToString(sequence.tokens) + "|\n"
);

export const genAbcWithChords: fc.Arbitrary<string> = fc
  .tuple(
    fc.array(ParserGen.genChordExpr, { minLength: 1, maxLength: 3 }),
    fc.array(ParserGen.genNoteExpr, { minLength: 0, maxLength: 3 }),
    fc.array(ParserGen.genRestExpr, { minLength: 0, maxLength: 2 })
  )
  .map(([chords, notes, rests]) => {
    const allTokens = [...chords, ...notes, ...rests].flatMap((e) => e.tokens);
    return "X:1\nK:C\n" + tokensToString(allTokens) + "|\n";
  });

export const genAbcMultiTune: fc.Arbitrary<string> = fc
  .array(
    ParserGen.genMusicSequence_NoBar.map(
      (seq) => tokensToString(seq.tokens) + "|\n"
    ),
    { minLength: 2, maxLength: 4 }
  )
  .map((bodies) =>
    bodies.map((body, i) => `X:${i + 1}\nK:C\n${body}`).join("\n")
  );
