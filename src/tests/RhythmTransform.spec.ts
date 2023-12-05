import assert from "assert";
import chai from "chai";
import { AbcFormatter } from "../Visitors/Formatter";
import { RhythmVisitor } from "../Visitors/RhythmTransform";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { File_header, File_structure } from "../types/Expr";
const expect = chai.expect;

export function tuneHeader(testStr: string) {
  return `X:1\n${testStr}`;
}

export function removeTuneHeader(testStr: string) {
  return testStr.replace(`X:1\n`, "");
}

export function buildParse(source: string): File_structure {
  const fmtHeader = tuneHeader(source);
  const scan = new Scanner(fmtHeader).scanTokens();
  const parse = new Parser(scan, fmtHeader).parse();
  if (!parse) {
    return new File_structure(new File_header("", []), []);;
  } else {
    return parse;
  };
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
        const multiply = new RhythmVisitor(buildParse(input)).transform("*");
        const fmt = new AbcFormatter().stringify(multiply);
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });

  describe("divide rhythms", () => {
    divide.forEach(([input, expected]) => {
      it(`should divide ${input} to ${expected}`, () => {
        const multiply = new RhythmVisitor(buildParse(input)).transform("/");
        const fmt = new AbcFormatter().stringify(multiply);
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
        const parse = buildParse(input);
        const rhythmVisitor = new RhythmVisitor(parse);
        rhythmVisitor.transform("/", { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } });
        const fmt = rhythmVisitor.getChanges();
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });

});
