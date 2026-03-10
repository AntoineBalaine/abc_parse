import { verifyIntegrity } from "abcls-cstree";
import { ABCContext, createRational, Scanner, parse, AbcErrorReporter, SemanticAnalyzer } from "abcls-parser";
import { ContextInterpreter, DocumentSnapshots } from "abcls-parser/interpreter/ContextInterpreter";
import { expect } from "chai";
import { describe, it } from "mocha";
import { TAGS, isTokenNode } from "../src/csTree/types";
import { addToRhythm } from "../src/transforms/addToRhythm";
import { divideRhythm } from "../src/transforms/divideRhythm";
import { explode2 } from "../src/transforms/explode";
import { harmonize } from "../src/transforms/harmonize";
import { legato } from "../src/transforms/legato";
import { multiplyRhythm } from "../src/transforms/multiplyRhythm";
import { remove } from "../src/transforms/remove";
import { setRhythm } from "../src/transforms/setRhythm";
import { toRest } from "../src/transforms/toRest";
import { transpose } from "../src/transforms/transpose";
import { unwrapSingle } from "../src/transforms/unwrapSingle";
import { voiceInfoLineToInline } from "../src/transforms/voiceMarkerTransform";
import { toCSTreeWithContext, findByTag } from "./helpers";

function getSnapshots(source: string): DocumentSnapshots {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);
  const interpreter = new ContextInterpreter();
  return interpreter.interpret(ast, analyzer.data, ctx, { snapshotAccidentals: true });
}

describe("transform integrity", () => {
  it("verifyIntegrity holds after transpose", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDEF|\n");
    const notes = findByTag(root, TAGS.Note);
    const sel = { root, cursors: [new Set(notes.map((n) => n.id))] };
    const snapshots = getSnapshots("X:1\nK:C\nCDEF|\n");
    transpose(sel, 2, ctx, snapshots);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after toRest", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDEF|\n");
    const notes = findByTag(root, TAGS.Note);
    const sel = { root, cursors: [new Set(notes.map((n) => n.id))] };
    toRest(sel, ctx);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after setRhythm", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDEF|\n");
    const notes = findByTag(root, TAGS.Note);
    const sel = { root, cursors: [new Set(notes.map((n) => n.id))] };
    setRhythm(sel, createRational(1, 2), ctx);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after addToRhythm", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2D2|\n");
    const notes = findByTag(root, TAGS.Note);
    const sel = { root, cursors: [new Set(notes.map((n) => n.id))] };
    addToRhythm(sel, createRational(1, 1), ctx);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after multiplyRhythm", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDEF|\n");
    const notes = findByTag(root, TAGS.Note);
    const sel = { root, cursors: [new Set(notes.map((n) => n.id))] };
    multiplyRhythm(sel, 2, ctx);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after divideRhythm", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2D2|\n");
    const notes = findByTag(root, TAGS.Note);
    const sel = { root, cursors: [new Set(notes.map((n) => n.id))] };
    divideRhythm(sel, 2, ctx);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after remove", () => {
    const { root } = toCSTreeWithContext("X:1\nK:C\nCDEF|\n");
    const notes = findByTag(root, TAGS.Note);
    const sel = { root, cursors: [new Set([notes[0].id])] };
    remove(sel);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after unwrapSingle", () => {
    const { root } = toCSTreeWithContext("X:1\nK:C\n[C]2|\n");
    const chords = findByTag(root, TAGS.Chord);
    const sel = { root, cursors: [new Set(chords.map((c) => c.id))] };
    unwrapSingle(sel);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after harmonize", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCE|\n");
    const notes = findByTag(root, TAGS.Note);
    const sel = { root, cursors: [new Set(notes.map((n) => n.id))] };
    harmonize(sel, 2, ctx);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after legato", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCzDz|\n");
    const allNodes = findByTag(root, TAGS.Note).concat(findByTag(root, TAGS.Rest));
    const sel = { root, cursors: [new Set(allNodes.map((n) => n.id))] };
    legato(sel, ctx);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after explode2", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CE][DF]|\n");
    const chords = findByTag(root, TAGS.Chord);
    const sel = { root, cursors: [new Set(chords.map((c) => c.id))] };
    explode2(sel, ctx);
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("verifyIntegrity holds after voiceInfoLineToInline", () => {
    const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nV:1\nCDEF|\nV:2\nGABc|\n");
    const infoLines = findByTag(root, TAGS.Info_line).filter((n) => {
      const child = n.firstChild;
      if (!child || !isTokenNode(child)) return false;
      return child.data.lexeme === "V:";
    });
    const bodyInfoLines = infoLines.filter((n) => {
      // Only body V: lines (not header ones)
      let current = n;
      while (current.parentRef) {
        const parent =
          current.parentRef.tag === "firstChild"
            ? current.parentRef.parent
            : (() => {
                let p = current.parentRef.prev;
                while (p.parentRef && p.parentRef.tag === "sibling") p = p.parentRef.prev;
                return p.parentRef?.parent ?? null;
              })();
        if (parent && parent.tag === TAGS.System) return true;
        if (parent && parent.tag === TAGS.Tune_header) return false;
        if (!parent) break;
        current = parent;
      }
      return false;
    });
    if (bodyInfoLines.length > 0) {
      const sel = { root, cursors: [new Set(bodyInfoLines.map((n) => n.id))] };
      voiceInfoLineToInline(sel, ctx);
      expect(verifyIntegrity(root)).to.be.true;
    }
  });
});
