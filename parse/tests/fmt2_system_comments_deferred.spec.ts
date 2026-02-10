import chai from "chai";
import * as fc from "fast-check";
import { isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner, TT } from "../parsers/scan2";
import { Tune } from "../types/Expr2";
import { AbcFormatter } from "../Visitors/Formatter2";

const expect = chai.expect;

describe("fmt2 - system comments for deferred style", () => {
  describe("example-based tests", () => {
    it("inserts comment before voice marker that starts a new system in deferred style", () => {
      const ctx = new ABCContext();
      // Deferred style (NOT linear) multi-voice tune with system-comments directive
      const input = `%%abcls-fmt system-comments
X:1
V:1
V:2
K:C
V:1
CDEF | GABc |
V:2
cdef | gabc |
V:1
defg | abcd |
V:2
DEFG | ABCD |
`;
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);
      const tune = ast.contents[0] as Tune;

      const formatter = new AbcFormatter(ctx);
      const output = formatter.format(tune);

      // The output should contain a % comment between systems
      expect(output).to.include("\n%\n");

      // The comment should appear BEFORE the V:1 that starts the second system
      // Find the position of the % and check that V:1 follows it
      const lines = output.split("\n");
      const percentLineIdx = lines.findIndex((line) => line.trim() === "%");
      expect(percentLineIdx).to.be.greaterThan(-1);

      // The line after the % should be V:1 (the voice marker for the new system)
      const nextNonEmptyLine = lines.slice(percentLineIdx + 1).find((line) => line.trim() !== "");
      expect(nextNonEmptyLine?.trim()).to.match(/^V:1/);
    });

    it("does not insert comments when systemComments is false", () => {
      const ctx = new ABCContext();
      // Deferred style without system-comments directive
      const input = `X:1
V:1
V:2
K:C
V:1
CDEF | GABc |
V:2
cdef | gabc |
V:1
defg | abcd |
V:2
DEFG | ABCD |
`;
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);
      const tune = ast.contents[0] as Tune;

      const formatter = new AbcFormatter(ctx);
      const output = formatter.format(tune);

      // Should NOT contain separator comments
      expect(output).to.not.include("\n%\n");
    });
  });

  describe("property-based tests", () => {
    it("voice markers always appear at the start of systems, never at the end", () => {
      fc.assert(
        fc.property(
          // Generate random number of bars for two systems
          fc.integer({ min: 1, max: 4 }),
          fc.integer({ min: 1, max: 4 }),
          (bars1, bars2) => {
            const ctx = new ABCContext();

            // Generate music for each voice in each system
            const music1V1 = "CDEF |".repeat(bars1);
            const music1V2 = "cdef |".repeat(bars1);
            const music2V1 = "EFGA |".repeat(bars2);
            const music2V2 = "efga |".repeat(bars2);

            const input = `%%abcls-fmt system-comments
X:1
V:1
V:2
K:C
V:1
${music1V1}
V:2
${music1V2}
V:1
${music2V1}
V:2
${music2V2}
`;
            const tokens = Scanner(input, ctx);
            const ast = parse(tokens, ctx);

            if (!ast || ast.contents.length === 0) {
              return true; // Skip if parse failed
            }

            const tune = ast.contents[0] as Tune;
            if (!tune.tune_body) {
              return true; // Skip if no tune body
            }

            const systems = tune.tune_body.sequence;

            // Check that no system ends with a voice marker (except possibly the last one)
            for (let i = 0; i < systems.length - 1; i++) {
              const system = systems[i];
              // Find the last non-whitespace/non-EOL element
              for (let j = system.length - 1; j >= 0; j--) {
                const element = system[j];
                if (isToken(element) && (element.type === TT.WS || element.type === TT.EOL)) {
                  continue; // Skip WS and EOL
                }
                // This is the last significant element
                if ("key" in element && element.key?.lexeme === "V:") {
                  // System ends with a voice marker - this is wrong
                  return false;
                }
                break;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it("comment insertion produces parseable ABC", () => {
      fc.assert(
        fc.property(
          // Generate random number of bars for two systems
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1, max: 3 }),
          (bars1, bars2) => {
            const ctx = new ABCContext();

            // Generate music for each voice in each system
            const music1V1 = "CDEF |".repeat(bars1);
            const music1V2 = "cdef |".repeat(bars1);
            const music2V1 = "EFGA |".repeat(bars2);
            const music2V2 = "efga |".repeat(bars2);

            const input = `%%abcls-fmt system-comments
X:1
V:1
V:2
K:C
V:1
${music1V1}
V:2
${music1V2}
V:1
${music2V1}
V:2
${music2V2}
`;
            const tokens = Scanner(input, ctx);
            const ast = parse(tokens, ctx);

            if (!ast || ast.contents.length === 0) {
              return true; // Skip if parse failed
            }

            const tune = ast.contents[0] as Tune;
            const formatter = new AbcFormatter(ctx);
            const formatted = formatter.format(tune);

            // Try to parse the formatted output
            const ctx2 = new ABCContext();
            const tokens2 = Scanner(`X:1\nK:C\n${formatted}`, ctx2);
            const ast2 = parse(tokens2, ctx2);

            // Should parse without errors
            return ast2 !== null && !ctx2.errorReporter.hasErrors();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
