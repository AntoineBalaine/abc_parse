import * as fc from "fast-check";
import { Scanner2, TT } from "../parsers/scan2";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

describe("Scanner Property Tests", () => {
  // Arbitrary generators for ABC notation components
  const genInfoLine = fc
    .record({
      key: fc.constantFrom("T", "C", "M", "L", "K"),
      value: fc.string().filter((s) => !s.includes("\n")),
    })
    .map(({ key, value }) => `${key}:${value}`);

  const genComment = fc
    .string()
    .filter((s) => !s.includes("\n"))
    .map((s) => `%${s}`);

  const genDirective = fc
    .string()
    .filter((s) => !s.includes("\n"))
    .map((s) => `%%${s}`);

  const genTuneHeader = fc.nat().map((n) => `X:${n}`);

  // Generate a valid file header section
  const genFileHeader = fc.array(fc.oneof(genInfoLine, genComment, genDirective)).map((lines) => lines.join("\n"));

  // Generate a valid tune section
  const genTuneSection = fc
    .record({
      header: genTuneHeader,
      content: fc.array(fc.oneof(genInfoLine, genComment, genDirective)),
    })
    .map(({ header, content }) => [header, ...content].join("\n"));

  // Generate a complete ABC file
  const genAbcFile = fc
    .record({
      header: genFileHeader,
      tunes: fc.array(genTuneSection),
    })
    .map(({ header, tunes }) => [header, ...tunes].join("\n\n"));

  it("should preserve structural integrity", () => {
    fc.assert(
      fc.property(genAbcFile, (input) => {
        const tokens = Scanner2(input);
        // Property 1: Every section break should correspond to double newlines in input
        const sectionBreaks = tokens.filter((t) => t.type === TT.SCT_BRK);
        const inputBreaks = (input.match(/\n\n/g) || []).length;
        return sectionBreaks.length === inputBreaks;
      }),
      { verbose: true } // Enable verbose mode
    );
  });

  it("should maintain token position integrity", () => {
    fc.assert(
      fc.property(genAbcFile, (input) => {
        const tokens = Scanner2(input, new AbcErrorReporter());

        // Property 2: Tokens should be sequential and non-overlapping
        for (let i = 0; i < tokens.length - 1; i++) {
          const current = tokens[i];
          if (current.type === TT.EOL || current.type === TT.SCT_BRK || current.type === TT.EOF) {
            return true;
          }
          const next = tokens[i + 1];
          if (current.line > next.line) {
            return false;
          }

          // Current token's end should not exceed next token's start
          if (current.line === next.line && current.position + current.lexeme.length - 1 > next.position) {
            return false;
          }
        }
        return true;
      }),
      { verbose: true }
    );
  });

  it("should properly identify tune sections", () => {
    fc.assert(
      fc.property(genAbcFile, (input) => {
        const tokens = Scanner2(input, new AbcErrorReporter());

        // Property 3: Every X: line should start a new tune section
        const tuneHeaders = tokens.filter((t) => t.type === TT.INF_HDR && t.lexeme.startsWith("X:"));

        const expectedTuneCount = (input.match(/^X:\d+/gm) || []).length;
        return tuneHeaders.length === expectedTuneCount;
      })
    );
  });

  it("should never crash on valid input", () => {
    fc.assert(
      fc.property(genAbcFile, (input) => {
        try {
          Scanner2(input, new AbcErrorReporter());
          return true;
        } catch (e) {
          return false;
        }
      })
    );
  });
});
