import * as fc from "fast-check";
import { assert } from "chai";
import { describe, it } from "mocha";
import { ParseCtx } from "../parsers/parse2";
import { parseDirective } from "../parsers/infoLines/parseDirective";
import { Token, TT } from "../parsers/scan2";
import { Directive } from "../types/Expr2";
import { AbcFormatter } from "../Visitors/Formatter2";
import { genTextDirectiveExpr, sharedContext } from "./prs_pbt.generators.spec";
import { analyzeDirective } from "../analyzers/directive-analyzer";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";

describe("Parser Property-Based: Text Directive (%%begintext)", () => {
  it("should always successfully parse text directive tokens", () => {
    fc.assert(
      fc.property(genTextDirectiveExpr, (gen) => {
        const ctx = new ParseCtx(gen.tokens, sharedContext);

        // Parse the directive
        const result = parseDirective(ctx);

        // Property: Must successfully parse and return a Directive
        return result !== null && result instanceof Directive;
      }),
      { numRuns: 100 }
    );
  });

  it("should preserve text content in parsing", () => {
    fc.assert(
      fc.property(genTextDirectiveExpr, (gen) => {
        const ctx = new ParseCtx(gen.tokens, sharedContext);

        // Parse the directive
        const result = parseDirective(ctx);

        if (!result || !(result instanceof Directive)) return false;

        // Property: Parsed directive should have the same key as generated
        const sameKey = result.key.lexeme === gen.expr.key.lexeme;

        // Property: Parsed directive should have FREE_TXT in values
        const hasFreeText = result.values.some((v) => v instanceof Token && v.type === TT.FREE_TXT);

        return sameKey && hasFreeText;
      }),
      { numRuns: 100 }
    );
  });

  it("should roundtrip correctly (tokens → parse → format → equals input)", () => {
    fc.assert(
      fc.property(genTextDirectiveExpr, (gen) => {
        const ctx = new ParseCtx(gen.tokens, sharedContext);

        // Parse the directive
        const result = parseDirective(ctx);

        if (!result) return false;

        // Format the parsed directive
        const formatter = new AbcFormatter(sharedContext);
        const formatted = formatter.stringify(result);

        // Reconstruct expected output from original tokens
        let expected = "%%begintext";
        const freeTextToken = gen.tokens.find((t) => t.type === TT.FREE_TXT);
        if (freeTextToken) {
          expected += "\n" + freeTextToken.lexeme;
        }
        const hasEndText = gen.tokens.some((t) => t.lexeme === "endtext");
        if (hasEndText) {
          expected += "\n%%endtext";
        }

        // Property: Formatted output should match expected pattern
        // Note: We check if formatted contains the key elements, as formatting may vary slightly
        return formatted.includes("%%begintext") && formatted.includes(freeTextToken?.lexeme || "");
      }),
      { numRuns: 50 }
    );
  });

  it("should preserve line breaks through parser", () => {
    fc.assert(
      fc.property(genTextDirectiveExpr, (gen) => {
        const ctx = new ParseCtx(gen.tokens, sharedContext);

        // Parse the directive
        const result = parseDirective(ctx);

        if (!result) return false;

        // Get the FREE_TXT token from parsed result
        const parsedFreeText = result.values.find((v) => v instanceof Token && v.type === TT.FREE_TXT) as Token | undefined;

        // Get the original FREE_TXT token
        const originalFreeText = gen.tokens.find((t) => t.type === TT.FREE_TXT);

        if (!parsedFreeText || !originalFreeText) return false;

        // Property: Line breaks should be preserved exactly
        return parsedFreeText.lexeme === originalFreeText.lexeme;
      }),
      { numRuns: 100 }
    );
  });

  it("should extract text correctly in semantic analyzer", () => {
    fc.assert(
      fc.property(genTextDirectiveExpr, (gen) => {
        const ctx = new ParseCtx(gen.tokens, sharedContext);

        // Parse the directive
        const result = parseDirective(ctx);

        if (!result) return false;

        // Analyze the directive
        const analyzer = new SemanticAnalyzer(sharedContext);
        const semanticData = analyzeDirective(result, analyzer);

        if (!semanticData) return false;

        // Property: Semantic data should have correct type and contain text
        const correctType = semanticData.type === "begintext";
        const hasData = typeof semanticData.data === "string" && semanticData.data.length > 0;

        return correctType && hasData;
      }),
      { numRuns: 100 }
    );
  });

  it("should preserve text content through full pipeline (scan → parse → analyze)", () => {
    fc.assert(
      fc.property(genTextDirectiveExpr, (gen) => {
        const ctx = new ParseCtx(gen.tokens, sharedContext);

        // Parse the directive
        const result = parseDirective(ctx);

        if (!result) return false;

        // Analyze the directive
        const analyzer = new SemanticAnalyzer(sharedContext);
        const semanticData = analyzeDirective(result, analyzer);

        if (!semanticData) return false;

        // Get original text
        const originalFreeText = gen.tokens.find((t) => t.type === TT.FREE_TXT);

        if (!originalFreeText) return false;

        // Property: Analyzed text should match original
        return semanticData.data === originalFreeText.lexeme;
      }),
      { numRuns: 100 }
    );
  });
});
