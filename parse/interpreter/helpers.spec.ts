import { expect } from "chai";
import { Font } from "../types/abcjs-ast";
import { FontSpec } from "../types/directive-specs";
import { fontSpecToFont } from "./helpers";

describe("fontSpecToFont", () => {
  it("returns all-default Font when given empty spec", () => {
    const result = fontSpecToFont({});
    expect(result).to.deep.equal({
      face: "",
      size: 12,
      weight: "normal",
      style: "normal",
      decoration: "none",
    });
  });

  it("uses all fields from a fully specified FontSpec", () => {
    const spec: FontSpec = {
      face: "Helvetica",
      size: 20,
      weight: "bold",
      style: "italic",
      decoration: "underline",
    };
    const result = fontSpecToFont(spec);
    expect(result).to.deep.equal({
      face: "Helvetica",
      size: 20,
      weight: "bold",
      style: "italic",
      decoration: "underline",
    });
  });

  it("fills missing fields from defaults when provided", () => {
    const spec: FontSpec = { size: 24 };
    const defaults: Font = {
      face: "Times",
      size: 14,
      weight: "bold",
      style: "italic",
      decoration: "underline",
    };
    const result = fontSpecToFont(spec, defaults);
    expect(result).to.deep.equal({
      face: "Times",
      size: 24,
      weight: "bold",
      style: "italic",
      decoration: "underline",
    });
  });

  it("prefers spec values over defaults", () => {
    const spec: FontSpec = { face: "Arial", weight: "normal" };
    const defaults: Font = {
      face: "Times",
      size: 14,
      weight: "bold",
      style: "italic",
      decoration: "none",
    };
    const result = fontSpecToFont(spec, defaults);
    expect(result.face).to.equal("Arial");
    expect(result.weight).to.equal("normal");
    expect(result.size).to.equal(14);
    expect(result.style).to.equal("italic");
  });

  it("ignores the box field from FontSpec", () => {
    const spec: FontSpec = { face: "Courier", box: true };
    const result = fontSpecToFont(spec);
    expect(result).to.not.have.property("box");
    expect(result.face).to.equal("Courier");
  });

  it("falls back to hardcoded defaults when no defaults parameter given", () => {
    const spec: FontSpec = { face: "Mono" };
    const result = fontSpecToFont(spec);
    expect(result.face).to.equal("Mono");
    expect(result.size).to.equal(12);
    expect(result.weight).to.equal("normal");
    expect(result.style).to.equal("normal");
    expect(result.decoration).to.equal("none");
  });
});
