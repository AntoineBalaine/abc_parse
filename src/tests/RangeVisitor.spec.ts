
import assert from "assert";
import chai from "chai";
import { RangeVisitor } from "../Visitors/RangeVisitor";
import { isGraceGroup, isNote } from "../helpers";
import { Grace_group, Note } from "../types/Expr";
import { Range } from "../types/types";
import { buildParse } from "./RhythmTransform.spec";

const expect = chai.expect;
describe("Range Visitor", function () {

  it("can accomodate ties in notes", function () {
    const input = "B2-";
    const expected: Range = {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 2 }
    };
    const parse = buildParse(input).tune[0].tune_body?.sequence[0][0];
    expect(parse).to.not.be.undefined;
    if (parse) {
      expect(parse).to.be.instanceof(Note);
      if (isNote(parse)) {
        const res = parse.accept(new RangeVisitor());
        assert.deepEqual(res, expected);
      }
    }

  });
  it("can accomodate accaciaturas in grace notes groups", function () {
    const input = "{/a}B";
    const expected: Range = {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 4 }
    };
    const parse = buildParse(input).tune[0].tune_body?.sequence[0][0];
    if (parse) {
      expect(parse).to.be.instanceof(Grace_group);
      if (isGraceGroup(parse)) {
        const res = parse.accept(new RangeVisitor());
        assert.deepEqual(res, expected);
      }
    }

  });
});