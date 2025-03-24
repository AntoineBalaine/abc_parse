import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { parseTune, prsBody, ParseCtx } from "../parsers/parse2";
import { Scanner2, Token, TT } from "../parsers/scan2";
import { Expr, Tune_Body } from "../types/Expr2";
import { AbcFormatter2 } from "../Visitors/Formatter2";
import * as ParserGen from "./parse2_pbt.generators.spec";

describe("Parser Property Tests", () => {
  // Create a context for testing
  const createContext = () => new ABCContext(new AbcErrorReporter());

  // Test that parsing never crashes on valid input
  it("should never crash on valid input", () => {
    fc.assert(
      fc.property(ParserGen.genMusicSequence, (sequence) => {
        try {
          const ctx = createContext();
          const tuneBody = prsBody(new ParseCtx(sequence.tokens, ctx));
          return true;
        } catch (e) {
          console.error("Parsing crashed with error:", e);
          return false;
        }
      }),
      { numRuns: 100 }
    );
  });

  // Test round-trip parsing for tune body
  describe("Tune Body Round-trip Tests", () => {
    // Test individual expression types
    it("should correctly round-trip Note expressions", () => {
      fc.assert(
        fc.property(ParserGen.genNoteExpr, (gen) => {
          const ctx = createContext();

          // Add EOL token to ensure proper parsing
          const tokens = [...gen.tokens, new Token(TT.EOL, "\n")];

          // Parse the tokens
          const tuneBody = prsBody(new ParseCtx(tokens, ctx));

          // Check if we got a valid tune body
          if (!tuneBody || !tuneBody.sequence || tuneBody.sequence.length === 0) {
            console.log("Failed to parse tokens:", tokens.map((t) => `${TT[t.type]}:${t.lexeme}`).join(", "));
            return false;
          }

          // Get the first expression from the tune body
          const parsedExpr = tuneBody.sequence[0][0];

          // Compare the original and parsed expressions
          const formatter = new AbcFormatter2(ctx);
          const originalStr = formatter.stringify(gen.expr);
          const parsedStr = formatter.stringify(parsedExpr);

          if (originalStr !== parsedStr) {
            console.log("Original:", originalStr);
            console.log("Parsed:", parsedStr);
          }

          return originalStr === parsedStr;
        }),
        { verbose: true, numRuns: 50 }
      );
    });

    it("should correctly round-trip Rest expressions", () => {
      fc.assert(
        fc.property(ParserGen.genRestExpr, (gen) => {
          const ctx = createContext();

          // Add EOL token to ensure proper parsing
          const tokens = [...gen.tokens, new Token(TT.EOL, "\n")];

          // Parse the tokens
          const tuneBody = prsBody(new ParseCtx(tokens, ctx));

          // Check if we got a valid tune body
          if (!tuneBody || !tuneBody.sequence || tuneBody.sequence.length === 0) {
            return false;
          }

          // Get the first expression from the tune body
          const parsedExpr = tuneBody.sequence[0][0];

          // Compare the original and parsed expressions
          const formatter = new AbcFormatter2(ctx);
          const originalStr = formatter.stringify(gen.expr);
          const parsedStr = formatter.stringify(parsedExpr);

          return originalStr === parsedStr;
        }),
        { numRuns: 50 }
      );
    });

    it("should correctly round-trip Chord expressions", () => {
      fc.assert(
        fc.property(ParserGen.genChordExpr, (gen) => {
          const ctx = createContext();

          // Add EOL token to ensure proper parsing
          const tokens = [...gen.tokens];

          // Parse the tokens
          const tuneBody = prsBody(new ParseCtx(tokens, ctx));

          // Check if we got a valid tune body
          if (!tuneBody || !tuneBody.sequence || tuneBody.sequence.length === 0) {
            return false;
          }

          // Get the first expression from the tune body
          const parsedExpr = tuneBody.sequence[0][0];

          // Compare the original and parsed expressions
          const formatter = new AbcFormatter2(ctx);
          const originalStr = formatter.stringify(gen.expr);
          const parsedStr = formatter.stringify(parsedExpr);
          if (originalStr !== parsedStr) {
            console.log("====================================");
            console.log("Original tokens:");
            console.log("", originalStr);
            console.log(tokens);
            console.log("Original expressions:");
            console.log(gen.expr);
          }
          return originalStr === parsedStr;
        }),
        { numRuns: 50 }
      );
    });

    it("should correctly round-trip BarLine expressions", () => {
      fc.assert(
        fc.property(ParserGen.genBarLineExpr, (gen) => {
          const ctx = createContext();

          // Add EOL token to ensure proper parsing
          const tokens = [...gen.tokens, new Token(TT.EOL, "\n")];

          // Parse the tokens
          const tuneBody = prsBody(new ParseCtx(tokens, ctx));

          // Check if we got a valid tune body
          if (!tuneBody || !tuneBody.sequence || tuneBody.sequence.length === 0) {
            return false;
          }

          // Get the first expression from the tune body
          const parsedExpr = tuneBody.sequence[0][0];

          // Compare the original and parsed expressions
          const formatter = new AbcFormatter2(ctx);
          const originalStr = formatter.stringify(gen.expr);
          const parsedStr = formatter.stringify(parsedExpr);

          return originalStr === parsedStr;
        }),
        { numRuns: 50 }
      );
    });

    // Test sequences of expressions
    it("should correctly round-trip sequences of music expressions", () => {
      fc.assert(
        fc.property(ParserGen.genMusicSequence, (sequence) => {
          const ctx = createContext();

          // Add EOL token to ensure proper parsing
          const tokens = [...sequence.tokens];

          // Parse the tokens
          const tuneBody = prsBody(new ParseCtx(tokens, ctx));

          // Check if we got a valid tune body
          if (!tuneBody || !tuneBody.sequence || tuneBody.sequence.length === 0) {
            console.log("Failed to parse tokens:", tokens.map((t) => `${TT[t.type]}:${t.lexeme}`).join(", "));
            return false;
          }

          // Get all expressions from the first system of the tune body
          const parsedExprs = tuneBody.sequence[0];

          // Compare the original and parsed expressions
          const formatter = new AbcFormatter2(ctx);

          // Convert all expressions to strings and join them
          const originalStr = sequence.exprs.map((expr) => formatter.stringify(expr)).join("");
          const parsedStr = parsedExprs.map((expr) => formatter.stringify(expr)).join("");

          if (originalStr !== parsedStr) {
            console.log("Original:", originalStr);
            console.log("Parsed:", parsedStr);
            console.log("Original tokens:", sequence.tokens.map((t) => `${TT[t.type]}:${t.lexeme}`).join(", "));
          }

          return originalStr === parsedStr;
        }),
        { verbose: true, numRuns: 2000 }
      );
    });

    // Test complete tune body with a valid header
  });
});
