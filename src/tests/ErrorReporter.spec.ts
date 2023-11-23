import chai from "chai";
import { Parser } from "../Parser";
import { Scanner } from "../Scanner";
import { tuneHeader } from "./RhythmTransform.spec";

const expect = chai.expect;

describe("Error Reporter", () => {
  it("Parser: retrieve errors after synchronization", () => {
    const sample = "~23 a bc\na,,";
    const scan = new Scanner(tuneHeader(sample)).scanTokens();
    const parser = new Parser(scan);
    const parse = parser.parse();
    expect(parse).to.be.not.null;
    if (parse === null) { return; }
    const errors = parser.getErrors();
    expect(errors).to.be.not.empty;
  });
});