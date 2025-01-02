import chai from "chai";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { tuneHeader } from "./RhythmTransform.spec";
import { ABCContext } from "../parsers/Context";

const expect = chai.expect;

describe("Error Reporter", () => {
  it("Parser: retrieve errors after synchronization", () => {
    const sample = "~23 a bc\na,,";
    const ctx = new ABCContext();
    const scan = new Scanner(tuneHeader(sample), ctx).scanTokens();
    const parser = new Parser(scan, ctx);
    const parse = parser.parse();
    expect(parse).to.be.not.null;
    if (parse === null) {
      return;
    }
    const errors = parser.getErrors();
    expect(errors).to.be.not.empty;
  });
  it("Error Reporter: Scanner and Parser can share a reporter.", () => {
    const sample = "~23 a bc\na,,";
    const ctx = new ABCContext();
    const tokens = new Scanner(tuneHeader(sample), ctx).scanTokens();
    const parser = new Parser(tokens, ctx);
    const parse = parser.parse();
    expect(parse).to.be.not.null;
    if (parse === null) {
      return;
    }
    const errors = ctx.errorReporter.getErrors();
    expect(errors).to.be.not.empty;
  });

  it("Error Reporter: Registers Warnings for escaped chars in body", () => {
    const sample = `a \\e bc`;
    const abcErrorReporter = new AbcErrorReporter();
    const ctx = new ABCContext();
    const tokens = new Scanner(tuneHeader(sample), ctx).scanTokens();
    const parser = new Parser(tokens, ctx);
    const parse = parser.parse();
    expect(parse).to.be.not.null;
    if (parse === null) {
      return;
    }
    const errors = abcErrorReporter.getErrors();
    expect(errors).to.be.not.empty;
  });
});
