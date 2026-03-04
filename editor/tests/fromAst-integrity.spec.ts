import { ABCContext, Scanner, parse, AbcErrorReporter, Tune } from "abc-parser";
import { verifyIntegrity } from "cstree";
import { expect } from "chai";
import { describe, it } from "mocha";
import { fromAst } from "../src/csTree/fromAst";

function parseAndConvert(source: string) {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  const tune = ast.contents.find((c: any) => c instanceof Tune) as Tune;
  return fromAst(tune, ctx);
}

describe("fromAst integrity", () => {
  it("produces a valid tree for a simple tune", () => {
    const csTree = parseAndConvert("X:1\nK:C\nCDEF|\n");
    expect(verifyIntegrity(csTree)).to.be.true;
  });

  it("produces a valid tree for a multi-voice tune", () => {
    const csTree = parseAndConvert("X:1\nM:4/4\nK:C\nV:1\n|C D E F|\nV:2\n|G, A, B, C|\n");
    expect(verifyIntegrity(csTree)).to.be.true;
  });

  it("produces a valid tree for chords, grace notes, and tuplets", () => {
    const csTree = parseAndConvert("X:1\nK:C\n[CEG]2 {ag}f (3ABC|\n");
    expect(verifyIntegrity(csTree)).to.be.true;
  });

  it("produces a valid tree for inline fields", () => {
    const csTree = parseAndConvert("X:1\nM:4/4\nK:C\n|C D|[M:3/4]E F G|\n");
    expect(verifyIntegrity(csTree)).to.be.true;
  });

  it("produces a valid tree for decorations and annotations", () => {
    const csTree = parseAndConvert('X:1\nK:C\n.C ~D "^above"E|\n');
    expect(verifyIntegrity(csTree)).to.be.true;
  });
});
