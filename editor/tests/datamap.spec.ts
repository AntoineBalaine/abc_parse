import { expect } from "chai";
import { describe, it } from "mocha";
import { TT } from "abc-parser";
import { CSNode, TAGS, createCSNode, isTokenNode } from "../src/csTree/types";

describe("EditorDataMap narrowing", () => {
  it("narrows data to TokenData when tag is checked against TAGS.Token", () => {
    const node: CSNode = createCSNode(TAGS.Token, 0, {
      type: "token",
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
      type: "token",
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
});
