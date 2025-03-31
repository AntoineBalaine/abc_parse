import assert from "assert";
import chai from "chai";
import { RhythmVisitor } from "../Visitors/RhythmTransform";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { Scanner2 } from "../parsers/scan2";
import { File_header, File_structure } from "../types/Expr2";
const expect = chai.expect;

export function tuneHeader(testStr: string) {
  return `X:1\n${testStr}`;
}

export function removeTuneHeader(testStr: string) {
  return testStr.replace(`X:1\n`, "");
}

export function buildParse(source: string, ctx: ABCContext): File_structure {
  const fmtHeader = tuneHeader(source);
  const tokens = Scanner2(fmtHeader, ctx);
  const parseCtx = new ParseCtx(tokens, ctx);
  const parse = parseTune(parseCtx);

  if (!parse) {
    return new File_structure(ctx.generateId(), new File_header(ctx.generateId(), []), []);
  } else {
    return new File_structure(ctx.generateId(), new File_header(ctx.generateId(), []), [parse]);
  }
}

describe("Rhythms", () => {
  const duplicate = [
    ["a", "a2"],
    ["a2", "a4"],
    ["a/", "a"],
    ["a/2", "a"],
    ["a//", "a/"],
    ["a/4", "a/2"],
  ];
  const divide = [
    ["a,2", "a,"],
    ["a4", "a2"],
    ["a/", "a/4"],
    ["a/2", "a/4"],
    ["a//", "a/8"],
    ["a", "a/"],
    ["^a''", "^a''/"],
  ];

  describe("duplicate rhythms", () => {
    duplicate.forEach(([input, expected]) => {
      it(`should duplicate ${input} to ${expected}`, () => {
        const ctx = new ABCContext();
        const rhythmVisitor = new RhythmVisitor(buildParse(input, ctx), ctx);
        rhythmVisitor.transform("*");
        const fmt = rhythmVisitor.getChanges();
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });

  describe("divide rhythms", () => {
    divide.forEach(([input, expected]) => {
      it(`should divide ${input} to ${expected}`, () => {
        const ctx = new ABCContext();
        const rhythmVisitor = new RhythmVisitor(buildParse(input, ctx), ctx);
        rhythmVisitor.transform("/");
        const fmt = rhythmVisitor.getChanges();
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });

  describe("Range: divide rhythms", () => {
    const divide = [
      ["c2d", "c"],
      /*       ["a4", "a2"],
            ["a/", "a/4"],
            ["a/2", "a/4"],
            ["a//", "a/8"],
            ["a", "a/"],
            ["^a''", "^a''/"], */
    ];
    divide.forEach(([input, expected]) => {
      it(`should divide ${input} to ${expected}`, () => {
        const ctx = new ABCContext();
        const parse = buildParse(input, ctx);
        const rhythmVisitor = new RhythmVisitor(parse, ctx);
        rhythmVisitor.transform("/", { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } });
        const fmt = rhythmVisitor.getChanges();
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });
});
