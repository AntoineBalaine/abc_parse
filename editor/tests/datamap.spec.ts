import { TT, Tune_Body } from "abc-parser";
import { expect } from "chai";
import { describe, it } from "mocha";
import { toAst } from "../src/csTree/toAst";
import { CSNode, TAGS, createCSNode, isTokenNode } from "../src/csTree/types";
import { toCSTree, findByTag } from "./helpers";

describe("EditorDataMap narrowing", () => {
  it("narrows data to TokenData when tag is checked against TAGS.Token", () => {
    const node: CSNode = createCSNode(TAGS.Token, 0, {
      lexeme: "C",
      tokenType: TT.NOTE_LETTER,
      line: 0,
      position: 0,
    });

    if (node.tag === TAGS.Token) {
      // After the tag check, node.data should be narrowed to TokenData
      expect(node.data.lexeme).to.equal("C");
      expect(node.data.tokenType).to.equal(TT.NOTE_LETTER);
    } else {
      expect.fail("node.tag should be TAGS.Token");
    }
  });

  it("narrows data to TokenData when isTokenNode predicate is used", () => {
    const node: CSNode = createCSNode(TAGS.Token, 0, {
      lexeme: "D",
      tokenType: TT.NOTE_LETTER,
      line: 1,
      position: 5,
    });

    if (isTokenNode(node)) {
      // After the predicate, node.data should be narrowed to TokenData
      expect(node.data.lexeme).to.equal("D");
      expect(node.data.line).to.equal(1);
    } else {
      expect.fail("isTokenNode should return true");
    }
  });

  it("narrows data to TuneBodyData when tag is checked against TAGS.Tune_Body", () => {
    const root = toCSTree("X:1\nV:1\nV:2\nK:C\n[V:1]C D|[V:2]E F|\n");
    const tuneBodyNodes = findByTag(root, TAGS.Tune_Body);
    expect(tuneBodyNodes).to.have.length(1);

    const tuneBody: CSNode = tuneBodyNodes[0];
    if (tuneBody.tag === TAGS.Tune_Body) {
      expect(tuneBody.data.voices).to.deep.equal(["1", "2"]);
    } else {
      expect.fail("node.tag should be TAGS.Tune_Body");
    }
  });

  it("preserves voices through the CSTree roundtrip (fromAst -> toAst)", () => {
    const root = toCSTree("X:1\nV:Soprano\nV:Alto\nK:C\n[V:Soprano]C D|[V:Alto]E F|\n");
    const tuneBodyNodes = findByTag(root, TAGS.Tune_Body);
    const tuneBodyAst = toAst(tuneBodyNodes[0]) as Tune_Body;
    expect(tuneBodyAst.voices).to.deep.equal(["Soprano", "Alto"]);
  });

  it("stores an empty voices array when there are no voice markers", () => {
    const root = toCSTree("X:1\nK:C\nC D E|\n");
    const tuneBodyNodes = findByTag(root, TAGS.Tune_Body);
    const tuneBody: CSNode = tuneBodyNodes[0];
    if (tuneBody.tag === TAGS.Tune_Body) {
      expect(tuneBody.data.voices).to.deep.equal([]);
    } else {
      expect.fail("node.tag should be TAGS.Tune_Body");
    }
  });
});
