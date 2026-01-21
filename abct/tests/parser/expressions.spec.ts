/**
 * Tests for ABCT parser expression functions
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { scan, AbctTT } from "../../src/scanner";
import { createParseCtx } from "../../src/parser/context";
import { parseExpr, parseAtom, parsePipeline } from "../../src/parser/expressions";
import {
  isPipe,
  isConcat,
  isUpdate,
  isApplication,
  isOr,
  isAnd,
  isNot,
  isNegate,
  isComparison,
  isSelector,
  isLocationSelector,
  isVoiceRef,
  isList,
  isAbcLiteral,
  isFileRef,
  isNumberLiteral,
  isIdentifier,
  isGroup,
  isErrorExpr,
} from "../../src/ast";

/**
 * Helper to parse a source string
 */
function parse(source: string) {
  const { tokens, errors: scanErrors } = scan(source);
  const ctx = createParseCtx(tokens);
  const expr = parseExpr(ctx);
  return { expr, errors: ctx.errors, scanErrors };
}

describe("ABCT Parser Expressions", () => {
  describe("atoms", () => {
    it("should parse identifier", () => {
      const { expr, errors } = parse("transpose");
      expect(isIdentifier(expr)).to.be.true;
      if (isIdentifier(expr)) {
        expect(expr.name).to.equal("transpose");
      }
      expect(errors).to.have.length(0);
    });

    it("should parse number", () => {
      const { expr, errors } = parse("42");
      expect(isNumberLiteral(expr)).to.be.true;
      if (isNumberLiteral(expr)) {
        expect(expr.value).to.equal("42");
      }
      expect(errors).to.have.length(0);
    });

    it("should parse negative number as Negate expression", () => {
      // -5 is scanned as MINUS NUMBER, parsed as Negate(NumberLiteral)
      const { expr, errors } = parse("-5");
      expect(isNegate(expr)).to.be.true;
      if (isNegate(expr)) {
        expect(isNumberLiteral(expr.operand)).to.be.true;
        if (isNumberLiteral(expr.operand)) {
          expect(expr.operand.value).to.equal("5");
        }
      }
      expect(errors).to.have.length(0);
    });

    it("should parse fraction", () => {
      const { expr, errors } = parse("1/4");
      expect(isNumberLiteral(expr)).to.be.true;
      if (isNumberLiteral(expr)) {
        expect(expr.value).to.equal("1/4");
      }
    });

    it("should parse ABC literal", () => {
      const { expr, errors } = parse("<<CDEF>>");
      expect(isAbcLiteral(expr)).to.be.true;
      if (isAbcLiteral(expr)) {
        expect(expr.content).to.equal("CDEF");
      }
      expect(errors).to.have.length(0);
    });

    it("should parse empty list", () => {
      const { expr, errors } = parse("[]");
      expect(isList(expr)).to.be.true;
      if (isList(expr)) {
        expect(expr.items).to.have.length(0);
      }
      expect(errors).to.have.length(0);
    });

    it("should parse list with items", () => {
      const { expr, errors } = parse("[a, b, c]");
      expect(isList(expr)).to.be.true;
      if (isList(expr)) {
        expect(expr.items).to.have.length(3);
        expect(isIdentifier(expr.items[0])).to.be.true;
      }
      expect(errors).to.have.length(0);
    });

    it("should parse grouped expression", () => {
      const { expr, errors } = parse("(a | b)");
      expect(isGroup(expr)).to.be.true;
      if (isGroup(expr)) {
        expect(isPipe(expr.expr)).to.be.true;
      }
      expect(errors).to.have.length(0);
    });

    it("should parse selector", () => {
      const { expr, errors } = parse("@notes");
      expect(isSelector(expr)).to.be.true;
      if (isSelector(expr)) {
        expect(expr.path.id).to.equal("notes");
      }
      expect(errors).to.have.length(0);
    });

    it("should parse selector with value", () => {
      const { expr, errors } = parse("@V:melody");
      expect(isSelector(expr)).to.be.true;
      if (isSelector(expr)) {
        expect(expr.path.id).to.equal("V");
        expect(expr.path.value).to.equal("melody");
      }
    });

    it("should parse selector with range", () => {
      const { expr, errors } = parse("@M:5-8");
      expect(isSelector(expr)).to.be.true;
      if (isSelector(expr)) {
        expect(expr.path.id).to.equal("M");
        expect(expr.path.value).to.deep.equal({ type: "range", start: 5, end: 8 });
      }
    });

    it("should parse location selector", () => {
      const { expr, errors } = parse(":10");
      expect(isLocationSelector(expr)).to.be.true;
      if (isLocationSelector(expr)) {
        expect(expr.line).to.equal(10);
      }
      expect(errors).to.have.length(0);
    });

    it("should parse location selector with column", () => {
      const { expr, errors } = parse(":10:5");
      expect(isLocationSelector(expr)).to.be.true;
      if (isLocationSelector(expr)) {
        expect(expr.line).to.equal(10);
        expect(expr.col).to.equal(5);
      }
    });

    it("should parse voice reference", () => {
      const { expr, errors } = parse("V:melody");
      expect(isVoiceRef(expr)).to.be.true;
      if (isVoiceRef(expr)) {
        expect(expr.voiceType).to.equal("V");
        expect(expr.name).to.equal("melody");
      }
      expect(errors).to.have.length(0);
    });

    it("should parse voice reference with number", () => {
      const { expr, errors } = parse("V:1");
      expect(isVoiceRef(expr)).to.be.true;
      if (isVoiceRef(expr)) {
        expect(expr.voiceType).to.equal("V");
        expect(expr.name).to.equal(1);
      }
    });

    it("should parse file reference", () => {
      const { expr, errors } = parse("file.abc");
      expect(isFileRef(expr)).to.be.true;
      if (isFileRef(expr)) {
        expect(expr.path).to.equal("file.abc");
      }
      expect(errors).to.have.length(0);
    });

    it("should parse file reference with location", () => {
      const { expr, errors } = parse("file.abc:10:5");
      expect(isFileRef(expr)).to.be.true;
      if (isFileRef(expr)) {
        expect(expr.path).to.equal("file.abc");
        expect(expr.location).to.deep.include({ line: 10, col: 5 });
      }
    });

    it("should parse file reference with selector", () => {
      const { expr, errors } = parse("file.abc@notes");
      expect(isFileRef(expr)).to.be.true;
      if (isFileRef(expr)) {
        expect(expr.path).to.equal("file.abc");
        expect(expr.selector).to.not.be.null;
        expect(expr.selector!.id).to.equal("notes");
      }
    });
  });

  describe("application", () => {
    it("should parse single term as atom", () => {
      const { expr, errors } = parse("transpose");
      expect(isIdentifier(expr)).to.be.true;
    });

    it("should parse application with two terms", () => {
      const { expr, errors } = parse("transpose 2");
      expect(isApplication(expr)).to.be.true;
      if (isApplication(expr)) {
        expect(expr.terms).to.have.length(2);
        expect(isIdentifier(expr.terms[0])).to.be.true;
        expect(isNumberLiteral(expr.terms[1])).to.be.true;
      }
      expect(errors).to.have.length(0);
    });

    it("should parse application with multiple terms", () => {
      const { expr, errors } = parse("distribute V:S V:A V:T V:B");
      expect(isApplication(expr)).to.be.true;
      if (isApplication(expr)) {
        expect(expr.terms).to.have.length(5);
      }
    });
  });

  describe("pipe", () => {
    it("should parse simple pipe", () => {
      const { expr, errors } = parse("a | b");
      expect(isPipe(expr)).to.be.true;
      if (isPipe(expr)) {
        expect(isIdentifier(expr.left)).to.be.true;
        expect(isIdentifier(expr.right)).to.be.true;
      }
      expect(errors).to.have.length(0);
    });

    it("should parse chained pipes (left-associative)", () => {
      const { expr, errors } = parse("a | b | c");
      expect(isPipe(expr)).to.be.true;
      if (isPipe(expr)) {
        expect(isPipe(expr.left)).to.be.true; // (a | b)
        expect(isIdentifier(expr.right)).to.be.true; // c
      }
    });

    it("should parse pipe with application", () => {
      const { expr, errors } = parse("file.abc | transpose 2");
      expect(isPipe(expr)).to.be.true;
      if (isPipe(expr)) {
        expect(isFileRef(expr.left)).to.be.true;
        expect(isApplication(expr.right)).to.be.true;
      }
      expect(errors).to.have.length(0);
    });
  });

  describe("concat", () => {
    it("should parse simple concat", () => {
      const { expr, errors } = parse("a + b");
      expect(isConcat(expr)).to.be.true;
      if (isConcat(expr)) {
        expect(isIdentifier(expr.left)).to.be.true;
        expect(isIdentifier(expr.right)).to.be.true;
      }
      expect(errors).to.have.length(0);
    });

    it("should parse chained concats (left-associative)", () => {
      const { expr, errors } = parse("a + b + c");
      expect(isConcat(expr)).to.be.true;
      if (isConcat(expr)) {
        expect(isConcat(expr.left)).to.be.true; // (a + b)
        expect(isIdentifier(expr.right)).to.be.true; // c
      }
    });

    it("concat should have higher precedence than pipe", () => {
      const { expr, errors } = parse("a + b | c");
      expect(isPipe(expr)).to.be.true;
      if (isPipe(expr)) {
        expect(isConcat(expr.left)).to.be.true; // (a + b)
        expect(isIdentifier(expr.right)).to.be.true; // c
      }
    });
  });

  describe("update", () => {
    it("should parse simple update", () => {
      const { expr, errors } = parse("@notes |= transpose 2");
      expect(isUpdate(expr)).to.be.true;
      if (isUpdate(expr)) {
        expect(isSelector(expr.selector)).to.be.true;
        expect(isApplication(expr.transform)).to.be.true;
      }
      expect(errors).to.have.length(0);
    });

    it("update should work with location selector", () => {
      const { expr, errors } = parse(":10 |= transpose 2");
      expect(isUpdate(expr)).to.be.true;
      if (isUpdate(expr)) {
        expect(isLocationSelector(expr.selector)).to.be.true;
      }
    });
  });

  describe("logical expressions", () => {
    it("should parse or", () => {
      const { expr, errors } = parse("a or b");
      expect(isOr(expr)).to.be.true;
      expect(errors).to.have.length(0);
    });

    it("should parse and", () => {
      const { expr, errors } = parse("a and b");
      expect(isAnd(expr)).to.be.true;
      expect(errors).to.have.length(0);
    });

    it("should parse not", () => {
      const { expr, errors } = parse("not a");
      expect(isNot(expr)).to.be.true;
      expect(errors).to.have.length(0);
    });

    it("and should have higher precedence than or", () => {
      const { expr, errors } = parse("a or b and c");
      expect(isOr(expr)).to.be.true;
      if (isOr(expr)) {
        expect(isIdentifier(expr.left)).to.be.true; // a
        expect(isAnd(expr.right)).to.be.true; // (b and c)
      }
    });
  });

  describe("comparison", () => {
    it("should parse greater than", () => {
      const { expr, errors } = parse("a > b");
      expect(isComparison(expr)).to.be.true;
      if (isComparison(expr)) {
        expect(expr.op).to.equal(">");
      }
      expect(errors).to.have.length(0);
    });

    it("should parse less than", () => {
      const { expr, errors } = parse("a < b");
      expect(isComparison(expr)).to.be.true;
      if (isComparison(expr)) {
        expect(expr.op).to.equal("<");
      }
    });

    it("should parse equality", () => {
      const { expr, errors } = parse("a == b");
      expect(isComparison(expr)).to.be.true;
      if (isComparison(expr)) {
        expect(expr.op).to.equal("==");
      }
    });

    it("should parse inequality", () => {
      const { expr, errors } = parse("a != b");
      expect(isComparison(expr)).to.be.true;
      if (isComparison(expr)) {
        expect(expr.op).to.equal("!=");
      }
    });
  });

  describe("parentheses preservation", () => {
    it("should wrap grouped expression in Group node", () => {
      const { expr, errors } = parse("(a | b)");
      expect(isGroup(expr)).to.be.true;
      if (isGroup(expr)) {
        expect(isPipe(expr.expr)).to.be.true;
        expect(expr.openLoc).to.not.be.undefined;
        expect(expr.closeLoc).to.not.be.undefined;
      }
    });

    it("should preserve nested parentheses", () => {
      const { expr, errors } = parse("((a))");
      expect(isGroup(expr)).to.be.true;
      if (isGroup(expr)) {
        expect(isGroup(expr.expr)).to.be.true;
      }
    });

    it("parentheses should override precedence", () => {
      // Without parens: a | (b + c) due to precedence
      // With parens: (a | b) + c
      const { expr, errors } = parse("(a | b) + c");
      expect(isConcat(expr)).to.be.true;
      if (isConcat(expr)) {
        expect(isGroup(expr.left)).to.be.true;
      }
    });
  });

  describe("complex expressions", () => {
    it("should parse file pipeline with transform", () => {
      const { expr, errors } = parse("file.abc | transpose 2 | retrograde");
      expect(isPipe(expr)).to.be.true;
      expect(errors).to.have.length(0);
    });

    it("should parse selector update in pipeline", () => {
      const { expr, errors } = parse("file.abc | @notes |= transpose 2");
      expect(isPipe(expr)).to.be.true;
      if (isPipe(expr)) {
        expect(isFileRef(expr.left)).to.be.true;
        expect(isUpdate(expr.right)).to.be.true;
      }
      expect(errors).to.have.length(0);
    });

    it("should parse complex filter expression", () => {
      const { expr, errors } = parse("@notes and not @rests");
      expect(isAnd(expr)).to.be.true;
      if (isAnd(expr)) {
        expect(isSelector(expr.left)).to.be.true;
        expect(isNot(expr.right)).to.be.true;
      }
      expect(errors).to.have.length(0);
    });

    it("should parse assignment value", () => {
      // This tests expression parsing within assignment context
      const { expr, errors } = parse("transpose 2");
      expect(isApplication(expr)).to.be.true;
    });
  });

  describe("location tracking", () => {
    it("should track locations for pipe operator", () => {
      const { expr } = parse("a | b");
      if (isPipe(expr)) {
        expect(expr.opLoc).to.not.be.undefined;
        expect(expr.opLoc.start.column).to.be.greaterThan(0);
      }
    });

    it("should track locations for grouped expression", () => {
      const { expr } = parse("(a)");
      if (isGroup(expr)) {
        expect(expr.openLoc.start.column).to.equal(1);
        expect(expr.closeLoc.start.column).to.equal(3);
      }
    });

    it("should track span location correctly", () => {
      const { expr } = parse("a | b");
      if (isPipe(expr)) {
        expect(expr.loc.start.column).to.equal(1);
        expect(expr.loc.end.column).to.equal(6);
      }
    });
  });
});
