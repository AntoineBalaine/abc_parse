import { expect } from "chai";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { parse } from "../parsers/parse2";
import { Scanner, Token, TT } from "../parsers/scan2";
import { Directive, Tune } from "../types/Expr2";
import { DIRECTIVE_SPECS } from "../types/directive-specs";

describe("Linear Directive Parser Tests", () => {
  function parseAbc(source: string): ReturnType<typeof parse> {
    const ctx = new ABCContext();
    const tokens = Scanner(source, ctx);
    return parse(tokens, ctx);
  }

  describe("File-level linear directive", () => {
    it("should set fileStructure.linear to true when %%linear true in file header", () => {
      const source = `%%linear true

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
    });

    it("should set fileStructure.linear to false when %%linear false in file header", () => {
      const source = `%%linear false

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false);
    });

    it("should set fileStructure.linear to false when no %%linear directive", () => {
      const source = `X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false);
    });

    it("should accept %%linear 1 as true", () => {
      const source = `%%linear 1

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
    });

    it("should accept %%linear 0 as false", () => {
      const source = `%%linear 0

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false);
    });
  });

  describe("Tune inherits file-level linear value", () => {
    it("should set tune.linear to true when file has %%linear true and tune has no directive", () => {
      const source = `%%linear true

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      const tune = ast.contents[0] as Tune;
      expect(tune.linear).to.equal(true);
    });

    it("should set tune.linear to false when file has %%linear false and tune has no directive", () => {
      const source = `%%linear false

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      const tune = ast.contents[0] as Tune;
      expect(tune.linear).to.equal(false);
    });
  });

  describe("Tune header overrides file-level linear value", () => {
    it("should override: file %%linear false, tune header %%linear true -> tune.linear is true", () => {
      const source = `%%linear false

X:1
%%linear true
K:C
CDEF|`;
      const ast = parseAbc(source);
      const tune = ast.contents[0] as Tune;
      expect(ast.linear).to.equal(false);
      expect(tune.linear).to.equal(true);
    });

    it("should override: file %%linear true, tune header %%linear false -> tune.linear is false", () => {
      const source = `%%linear true

X:1
%%linear false
K:C
CDEF|`;
      const ast = parseAbc(source);
      const tune = ast.contents[0] as Tune;
      expect(ast.linear).to.equal(true);
      expect(tune.linear).to.equal(false);
    });
  });

  describe("Multiple tunes with mixed linear values", () => {
    it("should handle: file %%linear true, tune 1 no directive, tune 2 %%linear false", () => {
      const source = `%%linear true

X:1
K:C
CDEF|

X:2
%%linear false
K:G
GABG|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(true);
      expect(ast.contents.length).to.be.greaterThanOrEqual(2);

      const tune1 = ast.contents[0] as Tune;
      const tune2 = ast.contents[1] as Tune;

      expect(tune1.linear).to.equal(true);
      expect(tune2.linear).to.equal(false);
    });

    it("should handle: no file header, tune 1 %%linear true, tune 2 no directive", () => {
      const source = `X:1
%%linear true
K:C
CDEF|

X:2
K:G
GABG|`;
      const ast = parseAbc(source);
      expect(ast.linear).to.equal(false); // no file header directive

      const tune1 = ast.contents[0] as Tune;
      const tune2 = ast.contents[1] as Tune;

      expect(tune1.linear).to.equal(true);
      expect(tune2.linear).to.equal(false);
    });
  });

  describe("Multiple directives in same header (last one wins)", () => {
    it("should use last %%linear value in tune header", () => {
      const source = `X:1
%%linear true
%%linear false
K:C
CDEF|`;
      const ast = parseAbc(source);
      const tune = ast.contents[0] as Tune;
      expect(tune.linear).to.equal(false);
    });
  });

  describe("Invalid linear values are ignored", () => {
    it("should keep default when %%linear has invalid value", () => {
      const source = `%%linear foo

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      // Invalid value is ignored, so default (false) is kept
      expect(ast.linear).to.equal(false);
    });

    it("should keep default when %%linear has no value", () => {
      const source = `%%linear

X:1
K:C
CDEF|`;
      const ast = parseAbc(source);
      // No value is ignored, so default (false) is kept
      expect(ast.linear).to.equal(false);
    });
  });
});

describe("Linear Directive Spec Tests", () => {
  describe("DIRECTIVE_SPECS entry", () => {
    it("should have linear entry in DIRECTIVE_SPECS", () => {
      expect(DIRECTIVE_SPECS["linear"]).to.exist;
    });

    it("should have params array with one boolean entry", () => {
      const linearSpec = DIRECTIVE_SPECS["linear"];
      expect(linearSpec.params).to.be.an("array");
      expect(linearSpec.params.length).to.equal(1);
      expect(linearSpec.params[0].type).to.equal("boolean");
    });
  });
});

describe("Linear Directive Analyzer Tests", () => {
  let analyzer: SemanticAnalyzer;
  let ctx: ABCContext;
  let idCounter: number;

  function generateId(): number {
    return idCounter++;
  }

  function createDirective(key: string, values: Token[]): Directive {
    return new Directive(
      generateId(),
      new Token(TT.IDENTIFIER, key, generateId()),
      values
    );
  }

  beforeEach(() => {
    idCounter = 1;
    const errorReporter = new AbcErrorReporter();
    ctx = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(ctx);
  });

  describe("Valid boolean values", () => {
    it("should return { type: 'linear', data: true } for %%linear true", () => {
      const directive = createDirective("linear", [
        new Token(TT.IDENTIFIER, "true", generateId())
      ]);
      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result?.type).to.equal("linear");
      expect(result?.data).to.equal(true);
    });

    it("should return { type: 'linear', data: false } for %%linear false", () => {
      const directive = createDirective("linear", [
        new Token(TT.IDENTIFIER, "false", generateId())
      ]);
      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result?.type).to.equal("linear");
      expect(result?.data).to.equal(false);
    });

    it("should return { type: 'linear', data: true } for %%linear 1", () => {
      const directive = createDirective("linear", [
        new Token(TT.NUMBER, "1", generateId())
      ]);
      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result?.type).to.equal("linear");
      expect(result?.data).to.equal(true);
    });

    it("should return { type: 'linear', data: false } for %%linear 0", () => {
      const directive = createDirective("linear", [
        new Token(TT.NUMBER, "0", generateId())
      ]);
      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result?.type).to.equal("linear");
      expect(result?.data).to.equal(false);
    });
  });

  describe("Invalid values", () => {
    it("should return null and report error for %%linear foo", () => {
      const directive = createDirective("linear", [
        new Token(TT.IDENTIFIER, "foo", generateId())
      ]);
      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
      expect(ctx.errorReporter.getErrors().length).to.be.greaterThan(0);
    });

    it("should return null and report error for %%linear with no value", () => {
      const directive = createDirective("linear", []);
      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
      expect(ctx.errorReporter.getErrors().length).to.be.greaterThan(0);
    });
  });

  describe("Semantic data map storage", () => {
    it("should store semantic data in the data map for valid %%linear true", () => {
      const directive = createDirective("linear", [
        new Token(TT.IDENTIFIER, "true", generateId())
      ]);
      analyzer.visitDirectiveExpr(directive);

      expect(analyzer.data.has(directive.id)).to.be.true;
      const storedData = analyzer.data.get(directive.id);
      expect(storedData?.type).to.equal("linear");
      expect(storedData?.data).to.equal(true);
    });

    it("should not store semantic data in the data map for invalid %%linear foo", () => {
      const directive = createDirective("linear", [
        new Token(TT.IDENTIFIER, "foo", generateId())
      ]);
      analyzer.visitDirectiveExpr(directive);

      expect(analyzer.data.has(directive.id)).to.be.false;
    });
  });
});
