import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseInvalidToken, parseTune } from "../parsers/parse2";
import { Scanner, Token, TT } from "../parsers/scan2";
import { ErrorExpr, Tune } from "../types/Expr2";

// Helper function to create a token with the given type and lexeme
function createToken(type: TT, lexeme: string, line: number = 0, position: number = 0): Token {
  const abcContext = new ABCContext();
  const token = new Token(
    type,
    {
      source: "",
      tokens: [],
      start: 0,
      current: lexeme.length,
      line,
      report: () => {},
      push: () => {},
      test: () => false,
      abcContext: abcContext,
      errorReporter: abcContext.errorReporter,
    },
    abcContext.generateId()
  );

  // Override the lexeme property
  Object.defineProperty(token, "lexeme", {
    value: lexeme,
    writable: false,
  });

  // Override the position property
  Object.defineProperty(token, "position", {
    value: position,
    writable: false,
  });

  return token;
}

// Helper function to create a ParseCtx with the given tokens
function createParseCtx(tokens: Token[]): ParseCtx {
  return new ParseCtx(tokens, new ABCContext());
}

describe("Invalid Token Handling in Parser", () => {
  describe("parseInvalidToken", () => {
    it("should parse an INVALID token into an ErrorExpr", () => {
      const tokens = [createToken(TT.INVALID, "~123")];
      const ctx = createParseCtx(tokens);

      const result = parseInvalidToken(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, ErrorExpr);
      assert.equal(result?.tokens[0].lexeme, "~123");
      assert.equal(result?.errorMessage, "Invalid token: ~123");
    });

    it("should return null for non-INVALID tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseInvalidToken(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseTune with invalid tokens", () => {
    it("should preserve invalid tokens in the AST", () => {
      // Create a simple tune with an invalid token
      const source = "X:1\nA ~123 B";
      const abcContext = new ABCContext();
      const tokens = Scanner(source, abcContext);

      // Parse the tune
      const parseCtx = new ParseCtx(tokens, abcContext);
      const tune = parseTune(parseCtx);

      // Verify that the tune was parsed correctly
      assert.instanceOf(tune, Tune);
      assert.isDefined(tune.tune_body);

      // Find the ErrorExpr in the tune body
      let foundErrorExpr = false;
      const visitTuneBody = (expr: any) => {
        if (expr instanceof ErrorExpr) {
          foundErrorExpr = true;
          assert.equal(expr.tokens[0].lexeme, "~123");
          assert.equal(expr.errorMessage, "Invalid token: ~123");
        }

        // Recursively visit all properties that might contain expressions
        for (const key in expr) {
          const value = expr[key];
          if (value && typeof value === "object") {
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (item && typeof item === "object") {
                  visitTuneBody(item);
                }
              });
            } else {
              visitTuneBody(value);
            }
          }
        }
      };

      visitTuneBody(tune);
      assert.isTrue(foundErrorExpr, "ErrorExpr not found in the AST");
    });

    it("should preserve all characters from the source in the AST", () => {
      // Create a simple tune with an invalid token
      const source = "X:1\nA ~123 B";
      const abcContext = new ABCContext();
      const tokens = Scanner(source, abcContext);

      // Parse the tune
      const parseCtx = new ParseCtx(tokens, abcContext);
      const tune = parseTune(parseCtx);

      // Collect all lexemes from the AST
      const lexemes: string[] = [];
      const collectLexemes = (expr: any) => {
        if (expr instanceof Token) {
          lexemes.push(expr.lexeme);
        } else if (expr && expr.tokens && Array.isArray(expr.tokens)) {
          expr.tokens.forEach((token: Token) => {
            lexemes.push(token.lexeme);
          });
        }

        // Recursively visit all properties that might contain expressions or tokens
        for (const key in expr) {
          const value = expr[key];
          if (value && typeof value === "object") {
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (item && typeof item === "object") {
                  collectLexemes(item);
                }
              });
            } else {
              collectLexemes(value);
            }
          }
        }
      };

      collectLexemes(tune);

      // Verify that all characters from the source are present in the AST
      // Note: This is a simplified check that doesn't account for order
      // but ensures all tokens are represented
      assert.include(lexemes, "X:");
      assert.include(lexemes, "1");
      assert.include(lexemes, "A");
      assert.include(lexemes, "~123");
      assert.include(lexemes, "B");
    });

    it("should handle multiple invalid tokens in a tune", () => {
      // Create a tune with multiple invalid tokens
      const source = "X:1\nA ~123 B @456 C";
      const abcContext = new ABCContext();
      const tokens = Scanner(source, abcContext);

      // Parse the tune
      const parseCtx = new ParseCtx(tokens, abcContext);
      const tune = parseTune(parseCtx);

      // Find all ErrorExpr instances in the tune body
      const errorExprs: ErrorExpr[] = [];
      const findErrorExprs = (expr: any) => {
        if (expr instanceof ErrorExpr) {
          errorExprs.push(expr);
        }

        // Recursively visit all properties that might contain expressions
        for (const key in expr) {
          const value = expr[key];
          if (value && typeof value === "object") {
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (item && typeof item === "object") {
                  findErrorExprs(item);
                }
              });
            } else {
              findErrorExprs(value);
            }
          }
        }
      };

      findErrorExprs(tune);

      // Verify that both invalid tokens were preserved as ErrorExpr objects
      assert.equal(errorExprs.length, 2, "Expected 2 ErrorExpr objects");
      assert.equal(errorExprs[0].tokens[0].lexeme, "~123");
      assert.equal(errorExprs[1].tokens[0].lexeme, "@456");
    });
  });
});
