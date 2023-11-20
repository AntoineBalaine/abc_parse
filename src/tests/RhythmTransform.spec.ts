import assert from "assert";
import chai from "chai";
import { File_header, File_structure } from "../Expr";
import { Parser } from "../Parser";
import { Scanner } from "../Scanner";
import { AbcFormatter } from "../Visitors/Formatter";
import { RhythmVisitor } from "../Visitors/RhythmTransform";
const expect = chai.expect;

export function tuneHeader(testStr: string) {
  return `X:1\n${testStr}`;
}

export function removeTuneHeader(testStr: string) {
  return testStr.replace(`X:1\n`, "");
}

export function buildParse(source: string): File_structure {
  const scan = new Scanner(tuneHeader(source)).scanTokens();
  const parse = new Parser(scan).parse();
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
    ["a/2", "a"], // ERR: yields a/1
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
        const fmt = new AbcFormatter().format(multiply);
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });

  describe("divide rhythms", () => {
    divide.forEach(([input, expected]) => {
      it(`should duplicate ${input} to ${expected}`, () => {
        const multiply = new RhythmVisitor(buildParse(input)).transform("/");
        const fmt = new AbcFormatter().format(multiply);
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });
});
