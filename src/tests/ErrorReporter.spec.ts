import chai from "chai";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { Scanner2 } from "../parsers/scan2";
import { tuneHeader } from "./RhythmTransform.spec";

const expect = chai.expect;

describe("Error Reporter", () => {
  it("Parser: retrieve errors after synchronization", () => {
    const sample = "~23 a bc\na,,";
    const ctx = new ABCContext();
    const tokens = Scanner2(tuneHeader(sample), ctx);

    // Parse the tune
    const parseCtx = new ParseCtx(tokens, ctx);
    const parse = parseTune(parseCtx);
    expect(parse).to.be.not.null;
    if (parse === null) {
      return;
    }
    const errors = ctx.errorReporter.getErrors();
    expect(errors).to.be.not.empty;
  });
  it("Error Reporter: Scanner and Parser can share a reporter.", () => {
    const sample = "~23 a bc\na,,";
    const ctx = new ABCContext();
    const tokens = Scanner2(tuneHeader(sample), ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const parse = parseTune(parseCtx);
    expect(parse).to.be.not.null;
    if (parse === null) {
      return;
    }
    const errors = ctx.errorReporter.getErrors();
    expect(errors).to.be.not.empty;
  });

  it("Error Reporter: Registers Warnings for escaped chars in body", () => {
    const sample = `a \\e bc`;
    const ctx = new ABCContext();
    const tokens = Scanner2(tuneHeader(sample), ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const parse = parseTune(parseCtx);
    expect(parse).to.be.not.null;
    if (parse === null) {
      return;
    }
    const errors = ctx.errorReporter.getErrors();
    expect(errors).to.be.not.empty;
  });
});
