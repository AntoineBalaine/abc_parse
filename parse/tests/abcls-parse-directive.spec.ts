import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { Tune } from "../types/Expr2";

describe("%%abcls-parse Directive Parser Tests", () => {
  function parseAbc(source: string): ReturnType<typeof parse> {
    const ctx = new ABCContext();
    const tokens = Scanner(source, ctx);
    return parse(tokens, ctx);
  }

  describe("File-level %%abcls-parse linear directive", () => {
    it("should set fileStructure.linear to true when %%abcls-parse linear in file header", () => {
      const source = `%%abcls-parse linear

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
    });

    it("should set fileStructure.linear to true with uppercase LINEAR", () => {
      const source = `%%abcls-parse LINEAR

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
    });

    it("should set fileStructure.linear to true with mixed case Linear", () => {
      const source = `%%abcls-parse Linear

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
    });

    it("should set fileStructure.linear to false when no %%abcls-parse directive", () => {
      const source = `X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false);
    });

    it("should ignore unknown options and keep linear false", () => {
      const source = `%%abcls-parse foo

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false);
    });

    it("should ignore empty directive and keep linear false", () => {
      const source = `%%abcls-parse

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false);
    });
  });

  describe("Tune inherits file-level linear value", () => {
    it("should set tune.linear to true when file has %%abcls-parse linear and tune has no directive", () => {
      const source = `%%abcls-parse linear

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      const tune = ast.contents[0] as Tune;
      expect(tune.linear).to.equal(true);
    });

    it("should set tune.linear to false when file has no directive and tune has no directive", () => {
      const source = `X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      const tune = ast.contents[0] as Tune;
      expect(tune.linear).to.equal(false);
    });
  });

  describe("Tune header overrides file-level linear value", () => {
    it("should override: no file directive, tune header %%abcls-parse linear -> tune.linear is true", () => {
      const source = `X:1
%%abcls-parse linear
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false);

      const tune = ast.contents[0] as Tune;
      expect(tune.linear).to.equal(true);
    });
  });

  describe("Multiple tunes with mixed linear values", () => {
    it("should handle: file %%abcls-parse linear, tune 1 no directive (inherits), tune 2 no directive (inherits)", () => {
      const source = `%%abcls-parse linear

X:1
K:C
CDEF|

X:2
K:G
GABG|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
      expect(ast.contents.length).to.be.greaterThanOrEqual(2);

      const tune1 = ast.contents[0] as Tune;
      const tune2 = ast.contents[1] as Tune;

      expect(tune1.linear).to.equal(true);
      expect(tune2.linear).to.equal(true);
    });

    it("should handle: no file header, tune 1 %%abcls-parse linear, tune 2 no directive", () => {
      const source = `X:1
%%abcls-parse linear
K:C
CDEF|

X:2
K:G
GABG|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false);

      const tune1 = ast.contents[0] as Tune;
      const tune2 = ast.contents[1] as Tune;

      expect(tune1.linear).to.equal(true);
      expect(tune2.linear).to.equal(false);
    });
  });

  describe("Case insensitivity for directive key", () => {
    it("should recognize ABCLS-PARSE as directive key (case insensitive)", () => {
      const source = `%%ABCLS-PARSE linear

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
    });

    it("should recognize Abcls-Parse as directive key (case insensitive)", () => {
      const source = `%%Abcls-Parse linear

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
    });
  });
});
