import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { File_structure, Tune } from "../types/Expr2";
import { discoverVoicesInTuneBody } from "../Visitors/fmt2/fmt_aligner";
import { AbcFormatter } from "../Visitors/Formatter2";

function parseFile(input: string, ctx: ABCContext): File_structure {
  const tokens = Scanner(input, ctx);
  return parse(tokens, ctx);
}

function getTuneBody(input: string, ctx: ABCContext) {
  const ast = parseFile(input, ctx);
  const tune = ast.contents[0] as Tune;
  return tune.tune_body;
}

describe("discoverVoicesInTuneBody", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  describe("discovers voices from V: info lines", () => {
    it("discovers voices from V: info lines in tune body", () => {
      const input = `X:1
K:C
V:1
CDEF|
V:2
GABC|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = [];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal(["1", "2"]);
    });

    it("discovers voices with complex IDs", () => {
      const input = `X:1
K:C
V:soprano
CDEF|
V:alto
GABC|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = [];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal(["soprano", "alto"]);
    });
  });

  describe("discovers voices from [V:] inline fields", () => {
    it("discovers voices from [V:] inline fields in tune body", () => {
      const input = `X:1
K:C
[V:soprano]CDEF|
[V:alto]GABC|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = [];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal(["soprano", "alto"]);
    });
  });

  describe("appends only new voices", () => {
    it("preserves header-declared voices and appends new ones", () => {
      const input = `X:1
K:C
V:1
CDEF|
V:2
GABC|
V:3
EFGA|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = ["1"];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal(["1", "2", "3"]);
    });

    it("does not duplicate existing voices", () => {
      const input = `X:1
K:C
V:1
CDEF|
V:1
GABC|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = [];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal(["1"]);
    });
  });

  describe("handles empty cases", () => {
    it("returns empty array when no voice declarations and no header voices", () => {
      const input = `X:1
K:C
CDEF|GABC|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = [];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal([]);
    });
  });

  describe("handles mixed info lines and inline fields", () => {
    it("discovers voices from both V: info lines and [V:] inline fields", () => {
      const input = `X:1
K:C
V:1
CDEF|
[V:2]GABC|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = [];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal(["1", "2"]);
    });
  });

  describe("discovers voices from inline fields nested in Music_code", () => {
    it("finds [V:] inside music code sections", () => {
      const input = `X:1
K:C
CDEF [V:inner] GABc|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = [];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal(["inner"]);
    });
  });

  describe("handles edge cases", () => {
    it("preserves case sensitivity of voice IDs", () => {
      const input = `X:1
K:C
V:A
CDEF|
V:a
GABC|`;

      const tuneBody = getTuneBody(input, ctx);
      const voices: string[] = ["A"];
      discoverVoicesInTuneBody(voices, tuneBody!);

      expect(voices).to.deep.equal(["A", "a"]);
    });
  });
});

describe("Formatter integration with voice discovery", () => {
  let ctx: ABCContext;
  let formatter: AbcFormatter;

  beforeEach(() => {
    ctx = new ABCContext();
    formatter = new AbcFormatter(ctx);
  });

  it("aligns voices declared only in body via V: info lines", () => {
    const input = `X:1
K:C
V:1
CDEF|
V:2
GABcdef|`;

    const ast = parseFile(input, ctx);
    const tune = ast.contents[0] as Tune;
    const result = formatter.format(tune);

    // The bar lines should be aligned - V:1 line should have padding
    // because V:2 has more content before the bar
    expect(result).to.include("CDEF    |");
    expect(result).to.include("GABcdef |");
  });

  it("aligns voices declared only in body via [V:] inline fields", () => {
    const input = `X:1
K:C
[V:1]CDEF|
[V:2]GABcdef|`;

    const ast = parseFile(input, ctx);
    const tune = ast.contents[0] as Tune;
    const result = formatter.format(tune);

    // The bar lines should be aligned
    expect(result).to.include("CDEF    |");
    expect(result).to.include("GABcdef |");
  });

  it("aligns voices with mix of header and body declarations", () => {
    const input = `X:1
V:1
K:C
V:1
CDEF|
V:2
GABcdef|`;

    const ast = parseFile(input, ctx);
    const tune = ast.contents[0] as Tune;
    const result = formatter.format(tune);

    // V:1 is in header, V:2 is only in body, both should be aligned
    expect(result).to.include("CDEF    |");
    expect(result).to.include("GABcdef |");
  });

  it("does not add alignment for single-voice tune", () => {
    const input = `X:1
K:C
V:1
CDEF|GABC|`;

    const ast = parseFile(input, ctx);
    const tune = ast.contents[0] as Tune;
    const result = formatter.format(tune);

    // Single voice - no alignment padding should be added
    expect(result).to.include("CDEF |");
    expect(result).not.to.include("CDEF  |");
  });
});
