import { expect } from "chai";
import { KeyRoot, KeyAccidental } from "../types/abcjs-ast";
import { parseKeyRoot, parseKeyAccidental } from "../utils/keyUtils";

describe("parseKeyRoot", () => {
  it("parses uppercase note letters", () => {
    expect(parseKeyRoot("A")).to.equal(KeyRoot.A);
    expect(parseKeyRoot("B")).to.equal(KeyRoot.B);
    expect(parseKeyRoot("C")).to.equal(KeyRoot.C);
    expect(parseKeyRoot("D")).to.equal(KeyRoot.D);
    expect(parseKeyRoot("E")).to.equal(KeyRoot.E);
    expect(parseKeyRoot("F")).to.equal(KeyRoot.F);
    expect(parseKeyRoot("G")).to.equal(KeyRoot.G);
  });

  it("parses lowercase note letters (case insensitive)", () => {
    expect(parseKeyRoot("a")).to.equal(KeyRoot.A);
    expect(parseKeyRoot("b")).to.equal(KeyRoot.B);
    expect(parseKeyRoot("c")).to.equal(KeyRoot.C);
    expect(parseKeyRoot("d")).to.equal(KeyRoot.D);
    expect(parseKeyRoot("e")).to.equal(KeyRoot.E);
    expect(parseKeyRoot("f")).to.equal(KeyRoot.F);
    expect(parseKeyRoot("g")).to.equal(KeyRoot.G);
  });

  it("parses H as Highland Pipes (backward compatibility)", () => {
    expect(parseKeyRoot("H")).to.equal(KeyRoot.HP);
    expect(parseKeyRoot("h")).to.equal(KeyRoot.HP);
  });

  it("returns null for invalid characters", () => {
    expect(parseKeyRoot("X")).to.be.null;
    expect(parseKeyRoot("Z")).to.be.null;
    expect(parseKeyRoot("1")).to.be.null;
    expect(parseKeyRoot("#")).to.be.null;
    expect(parseKeyRoot("")).to.be.null;
  });
});

describe("parseKeyAccidental", () => {
  it("parses sharp", () => {
    expect(parseKeyAccidental("#")).to.equal(KeyAccidental.Sharp);
  });

  it("parses flat", () => {
    expect(parseKeyAccidental("b")).to.equal(KeyAccidental.Flat);
  });

  it("returns None for other input", () => {
    expect(parseKeyAccidental("x")).to.equal(KeyAccidental.None);
    expect(parseKeyAccidental("")).to.equal(KeyAccidental.None);
    expect(parseKeyAccidental("B")).to.equal(KeyAccidental.None);
  });

  it("returns None for multi-character strings (expects single char)", () => {
    expect(parseKeyAccidental("##")).to.equal(KeyAccidental.None);
    expect(parseKeyAccidental("C#")).to.equal(KeyAccidental.None);
    expect(parseKeyAccidental("Bb")).to.equal(KeyAccidental.None);
  });
});
