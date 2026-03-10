import { ABCContext, Scanner, parse, SemanticAnalyzer, AbcErrorReporter } from "abcls-parser";
import { ChordQuality } from "abcls-parser/music-theory/types";
import { KeyRoot } from "abcls-parser/types/abcjs-ast";
import { expect } from "chai";
import { interpretContext } from "../src/context/csContextInterpreter";
import { fromAst } from "../src/csTree/fromAst";

function parseAndInterpret(input: string) {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(input, ctx);
  const ast = parse(tokens, ctx);
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);
  const csTree = fromAst(ast, ctx);
  const snapshots = interpretContext(csTree, analyzer.data);
  return { snapshots, ctx };
}

describe("CSTree ContextInterpreter currentChord", () => {
  it("should set currentChord from annotation with chord symbol", () => {
    const input = 'X:1\nK:C\n"Am7"C D E|';
    const { snapshots } = parseAndInterpret(input);

    const snapshotWithChord = snapshots.find((s) => s.snapshot.currentChord !== undefined);
    expect(snapshotWithChord).to.not.be.undefined;
    expect(snapshotWithChord?.snapshot.currentChord?.root).to.equal(KeyRoot.A);
    expect(snapshotWithChord?.snapshot.currentChord?.quality).to.equal(ChordQuality.Minor);
    expect(snapshotWithChord?.snapshot.currentChord?.extension).to.equal(7);
  });

  it("should not set currentChord for non-chord annotations", () => {
    const input = 'X:1\nK:C\n"tempo"C D E|';
    const { snapshots } = parseAndInterpret(input);

    for (const { snapshot } of snapshots) {
      expect(snapshot.currentChord).to.be.undefined;
    }
  });

  it("should recognize chord symbol with position prefix", () => {
    const input = 'X:1\nK:C\n"^Am7"C D E|';
    const { snapshots } = parseAndInterpret(input);

    const snapshotWithChord = snapshots.find((s) => s.snapshot.currentChord !== undefined);
    expect(snapshotWithChord).to.not.be.undefined;
    expect(snapshotWithChord?.snapshot.currentChord?.root).to.equal(KeyRoot.A);
    expect(snapshotWithChord?.snapshot.currentChord?.quality).to.equal(ChordQuality.Minor);
  });

  it("should update currentChord when new chord symbol appears", () => {
    const input = 'X:1\nK:C\n"Am7"C D|"Dm7"E F|';
    const { snapshots } = parseAndInterpret(input);

    const chordSnapshots = snapshots.filter((s) => s.snapshot.currentChord !== undefined);
    expect(chordSnapshots.length).to.equal(2);

    expect(chordSnapshots[0].snapshot.currentChord?.root).to.equal(KeyRoot.A);
    expect(chordSnapshots[0].snapshot.currentChord?.quality).to.equal(ChordQuality.Minor);

    expect(chordSnapshots[1].snapshot.currentChord?.root).to.equal(KeyRoot.D);
    expect(chordSnapshots[1].snapshot.currentChord?.quality).to.equal(ChordQuality.Minor);
  });

  it("should persist currentChord in subsequent snapshots", () => {
    const input = 'X:1\nK:C\n"Am7"C D [K:G]E F|';
    const { snapshots } = parseAndInterpret(input);

    const keyChangeSnapshot = snapshots.find((s) => s.snapshot.key.root === "G");

    expect(keyChangeSnapshot).to.not.be.undefined;
    expect(keyChangeSnapshot?.snapshot.currentChord?.root).to.equal(KeyRoot.A);
  });

  it("should reset currentChord at new tune", () => {
    const input = 'X:1\nK:C\n"Am7"C D|\n\nX:2\nK:C\nE F G|';
    const { snapshots } = parseAndInterpret(input);

    const tune2Snapshots = snapshots.filter((s) => s.snapshot.line >= 4);

    for (const { snapshot } of tune2Snapshots) {
      expect(snapshot.currentChord).to.be.undefined;
    }
  });
});
