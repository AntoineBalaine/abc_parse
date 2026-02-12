import { expect } from "chai";
import { describe, it } from "mocha";
import {
  ABCContext,
  Scanner,
  parse,
  SemanticAnalyzer,
  AbcErrorReporter,
  File_structure,
  Tune,
} from "abc-parser";
import {
  ContextInterpreter,
  TuneSnapshots,
  encode,
  getSnapshotAtPosition,
} from "abc-parser/interpreter/ContextInterpreter";
import { SemanticData } from "abc-parser/analyzers/semantic-analyzer";
import { fromAst } from "../src/csTree/fromAst";
import { CSNode } from "../src/csTree/types";
import { getContextForNode } from "../src/context/contextUtils";
import { findFirstByTag, firstTokenData } from "../src/selectors/treeWalk";

function parseWithContext(source: string): {
  ast: File_structure;
  ctx: ABCContext;
  semanticData: Map<number, SemanticData>;
  tuneSnapshots: Map<number, TuneSnapshots>;
  debugInfo: string;
} {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  // Debug: check contents before calling interpret
  const contentsBeforeInterpret = ast.contents.map((c: any) => `${c.constructor.name}:${c.id}`);

  const interpreter = new ContextInterpreter();
  const tuneSnapshots = interpreter.interpret(ast, analyzer.data, ctx);

  const debugInfo = `contents: [${contentsBeforeInterpret.join(", ")}], result keys: [${Array.from(tuneSnapshots.keys()).join(", ")}]`;

  return { ast, ctx, semanticData: analyzer.data, tuneSnapshots, debugInfo };
}

describe("contextUtils", () => {
  describe("getContextForNode", () => {
    it("returns correct meter for note after M: directive", () => {
      const input = `X:1
M:4/4
K:C
|C D E F|`;

      const { ast, ctx, tuneSnapshots } = parseWithContext(input);

      const tune = ast.contents.find((c: any) => c.constructor.name === "Tune");
      expect(tune).to.not.be.undefined;

      const snapshots = tuneSnapshots.get(tune!.id);
      expect(snapshots).to.not.be.undefined;

      const csTree = fromAst(tune, ctx);

      // Find a note node
      const noteNode = findFirstByTag(csTree, "Note");
      expect(noteNode).to.not.be.null;

      const context = getContextForNode(noteNode!, snapshots!);
      expect(context).to.not.be.null;
      // Meter should be 4/4
      expect(context!.meter.value![0].numerator).to.equal(4);
      expect(context!.meter.value![0].denominator).to.equal(4);
    });

    it("returns correct clef for voice with bass clef", () => {
      const input = `X:1
M:4/4
K:C
V:1 clef=treble
|C D|
V:2 clef=bass
|E, F,|`;

      const { ast, ctx, tuneSnapshots } = parseWithContext(input);
      const tune = ast.contents.find((c: any) => c.constructor.name === "Tune");
      const snapshots = tuneSnapshots.get(tune.id)!;

      // Query at position in the bass voice music line (line 7, |E, F,|)
      // Line 7 because: X:1 is line 0, M:4/4 is line 1, K:C is line 2, V:1 is line 3, |C D| is line 4, V:2 is line 5, |E, F,| is line 6
      const context = getSnapshotAtPosition(snapshots, encode(6, 1));

      expect(context).to.not.be.null;
      expect(context!.clef?.type).to.equal("bass");
      expect(context!.voiceId).to.equal("2");
    });

    it("returns correct key for note after K: directive", () => {
      const input = `X:1
M:4/4
K:G
|G A B c|`;

      const { ast, ctx, tuneSnapshots } = parseWithContext(input);
      const tune = ast.contents.find((c: any) => c instanceof Tune) as Tune;
      const snapshots = tuneSnapshots.get(tune.id)!;
      const csTree = fromAst(tune, ctx);

      // Find a note node
      const noteNode = findFirstByTag(csTree, "Note");
      const context = getContextForNode(noteNode!, snapshots);

      expect(context).to.not.be.null;
      // Key should be G major (1 sharp)
      expect(context!.key?.root).to.equal("G");
    });

    it("returns null for node without tokens", () => {
      const emptyNode: CSNode = {
        tag: "Note",
        id: 999,
        data: { type: "empty" },
        firstChild: null,
        nextSibling: null,
      };

      const tuneSnapshots: TuneSnapshots = { byVoice: new Map(), all: [] };
      const context = getContextForNode(emptyNode, tuneSnapshots);

      expect(context).to.be.null;
    });

    it("returns correct note length from L: directive", () => {
      const input = `X:1
L:1/8
K:C
|C D E F|`;

      const { ast, ctx, tuneSnapshots } = parseWithContext(input);
      const tune = ast.contents.find((c: any) => c instanceof Tune) as Tune;
      const snapshots = tuneSnapshots.get(tune.id)!;
      const csTree = fromAst(tune, ctx);

      // Find a note node
      const noteNode = findFirstByTag(csTree, "Note");
      const context = getContextForNode(noteNode!, snapshots);

      expect(context).to.not.be.null;
      // Note length should be 1/8
      expect(context!.noteLength.numerator).to.equal(1);
      expect(context!.noteLength.denominator).to.equal(8);
    });

    it("tracks context changes within tune body", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|C D|
[M:3/4]|E F G|`;

      const { ast, ctx, tuneSnapshots } = parseWithContext(input);
      const tune = ast.contents.find((c: any) => c instanceof Tune) as Tune;
      const snapshots = tuneSnapshots.get(tune.id)!;

      // Query position after the inline [M:3/4] field (line 5, after the inline field)
      const contextAfter = getSnapshotAtPosition(snapshots, encode(5, 7));

      expect(contextAfter).to.not.be.null;
      // Meter should now be 3/4
      expect(contextAfter!.meter.value![0].numerator).to.equal(3);
      expect(contextAfter!.meter.value![0].denominator).to.equal(4);
    });
  });
});
