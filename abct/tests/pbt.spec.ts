// Property-based tests for ABCT grammar
// Run 10000+ generated cases to thoroughly validate the grammar

import { expect } from "chai";
import * as fc from "fast-check";
import { scan } from "../src/scanner";
import { parse } from "../src/parser/parser";
import { AbctContext } from "../src/context";
import { isProgram, isPipe, isUpdate, isConcat, isGroup, Program } from "../src/ast";
import {
  genIdentifier,
  genNumber,
  genPath,
  genSelector,
  genAbcLiteral,
  genSimpleList,
  genFileRef,
  genExpr,
  genStatement,
  genProgram,
  genTransformPipeline,
  genFileCombination,
  genFilterExpr,
  genVoiceDistribution,
  genSimpleAtom,
  genLocationSelector,
  genLocationUpdate,
  genPipelineWithLocationUpdate,
} from "./generators";

/** Helper to parse source with a fresh context and return a result-like object */
function parseSource(source: string): { success: true; value: Program } | { success: false; error: { message: string } } {
  const ctx = new AbctContext();
  const tokens = scan(source, ctx);
  const program = parse(tokens, ctx);
  if (ctx.errorReporter.hasErrors()) {
    const errors = ctx.errorReporter.getErrors();
    return { success: false, error: { message: errors[0].message } };
  }
  return { success: true, value: program };
}

// Configuration for property tests
const PBT_CONFIG = { numRuns: 10000 };
const PBT_CONFIG_FAST = { numRuns: 1000 }; // For slower tests

/**
 * Strip all location properties from an AST for comparison.
 * Because location info differs based on whitespace, we need to compare
 * AST structure without positions for certain property tests.
 */
function stripLocations(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripLocations);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Skip all location-related keys
    if (key === "loc" || key.endsWith("Loc")) {
      continue;
    }
    result[key] = stripLocations(value);
  }
  return result;
}

describe("ABCT Grammar Property-Based Tests", () => {
  describe("Terminal Parsing", () => {
    it("property: all generated identifiers parse successfully", () => {
      fc.assert(
        fc.property(genIdentifier, (id) => {
          const result = parseSource(id);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated numbers parse successfully", () => {
      fc.assert(
        fc.property(genNumber, (num) => {
          const result = parseSource(num);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated file paths parse successfully", () => {
      fc.assert(
        fc.property(genPath, (path) => {
          const result = parseSource(path);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated selectors parse successfully when used in context", () => {
      fc.assert(
        fc.property(genSelector, (sel) => {
          // Selectors need to be in a valid context
          const result = parseSource(`file.abc | ${sel}`);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated ABC literals parse successfully", () => {
      fc.assert(
        fc.property(genAbcLiteral, (lit) => {
          const result = parseSource(lit);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated lists parse successfully", () => {
      fc.assert(
        fc.property(genSimpleList, (list) => {
          const result = parseSource(list);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated file references parse successfully", () => {
      fc.assert(
        fc.property(genFileRef, (fileRef) => {
          const result = parseSource(fileRef);
          return result.success;
        }),
        PBT_CONFIG
      );
    });
  });

  describe("Expression Parsing", () => {
    it("property: all generated expressions parse successfully", () => {
      fc.assert(
        fc.property(genExpr, (expr) => {
          const result = parseSource(expr);
          if (!result.success) {
            // Log failures for debugging
            console.log(`Failed to parse: ${expr}`);
            console.log(`Error: ${result.error.message}`);
          }
          return result.success;
        }),
        PBT_CONFIG_FAST // Use faster config because expressions can be complex
      );
    });

    it("property: all generated statements parse successfully", () => {
      fc.assert(
        fc.property(genStatement, (stmt) => {
          const result = parseSource(stmt);
          return result.success;
        }),
        PBT_CONFIG_FAST
      );
    });

    it("property: all generated programs parse successfully", () => {
      fc.assert(
        fc.property(genProgram, (program) => {
          const result = parseSource(program);
          return result.success;
        }),
        PBT_CONFIG_FAST
      );
    });
  });

  describe("Specialized Pattern Parsing", () => {
    it("property: all generated transform pipelines parse successfully", () => {
      fc.assert(
        fc.property(genTransformPipeline, (pipeline) => {
          const result = parseSource(pipeline);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated file combinations parse successfully", () => {
      fc.assert(
        fc.property(genFileCombination, (combo) => {
          const result = parseSource(combo);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated filter expressions parse successfully", () => {
      fc.assert(
        fc.property(genFilterExpr, (filter) => {
          const result = parseSource(filter);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated voice distributions parse successfully", () => {
      fc.assert(
        fc.property(genVoiceDistribution, (dist) => {
          const result = parseSource(dist);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated location selectors parse successfully", () => {
      fc.assert(
        fc.property(genLocationSelector, (loc) => {
          const result = parseSource(loc);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated location updates parse successfully", () => {
      fc.assert(
        fc.property(genLocationUpdate, (update) => {
          const result = parseSource(update);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: all generated pipelines with location updates parse successfully", () => {
      fc.assert(
        fc.property(genPipelineWithLocationUpdate, (pipeline) => {
          const result = parseSource(pipeline);
          return result.success;
        }),
        PBT_CONFIG
      );
    });
  });

  describe("AST Structure Properties", () => {
    it("property: parsed programs always have 'program' type", () => {
      fc.assert(
        fc.property(genProgram, (input) => {
          const result = parseSource(input);
          if (!result.success) return true; // Skip failed parses
          return isProgram(result.value);
        }),
        PBT_CONFIG_FAST
      );
    });

    it("property: programs have correct number of statements", () => {
      // Filter out atoms starting with reserved keywords that could form
      // multi-line logical expressions (e.g., "abc\nor0" parses as "abc or 0")
      const genSafeAtom = genSimpleAtom.filter(
        (atom) =>
          !atom.startsWith("and") &&
          !atom.startsWith("or") &&
          !atom.startsWith("not")
      );
      fc.assert(
        fc.property(
          fc.array(genSafeAtom, { minLength: 1, maxLength: 5 }),
          (atoms) => {
            const input = atoms.join("\n");
            const result = parseSource(input);
            if (!result.success) return true;
            // Each atom should become one statement
            return result.value.statements.length === atoms.length;
          }
        ),
        PBT_CONFIG
      );
    });
  });

  describe("Precedence Properties", () => {
    it("property: | has lower precedence than +", () => {
      fc.assert(
        fc.property(genPath, genPath, genIdentifier, (a, b, c) => {
          const input = `${a} + ${b} | ${c}`;
          const result = parseSource(input);
          if (!result.success) return true;
          const expr = result.value.statements[0];
          // Outer should be pipe
          if (!isPipe(expr)) return false;
          // Left side of pipe should be concat
          return isConcat(expr.left);
        }),
        PBT_CONFIG
      );
    });

    it("property: |= binds tighter than | on right side only", () => {
      fc.assert(
        fc.property(genSelector, genIdentifier, genIdentifier, (sel, f, g) => {
          const input = `${sel} |= ${f} | ${g}`;
          const result = parseSource(input);
          if (!result.success) return true;
          const expr = result.value.statements[0];
          // Outer should be pipe: (sel |= f) | g
          if (!isPipe(expr)) return false;
          // Left side should be update
          return isUpdate(expr.left);
        }),
        PBT_CONFIG
      );
    });

    it("property: parentheses override precedence", () => {
      fc.assert(
        fc.property(genSelector, genIdentifier, genIdentifier, (sel, f, g) => {
          const input = `${sel} |= (${f} | ${g})`;
          const result = parseSource(input);
          if (!result.success) return true;
          const expr = result.value.statements[0];
          // Should be just an update (no outer pipe)
          if (!isUpdate(expr)) return false;
          // Transform should be a Group containing a Pipe (parentheses preserved)
          if (!isGroup(expr.transform)) return false;
          return isPipe(expr.transform.expr);
        }),
        PBT_CONFIG
      );
    });
  });

  describe("Whitespace Insensitivity", () => {
    it("property: extra whitespace does not change parse result", () => {
      fc.assert(
        fc.property(genIdentifier, genIdentifier, (a, b) => {
          // Minimal whitespace
          const minimal = `${a} | ${b}`;
          // Extra whitespace
          const extra = `  ${a}   |   ${b}  `;

          const resultMinimal = parseSource(minimal);
          const resultExtra = parseSource(extra);

          if (!resultMinimal.success || !resultExtra.success) return true;

          // Both should parse to structurally identical ASTs (ignoring locations)
          return (
            JSON.stringify(stripLocations(resultMinimal.value)) ===
            JSON.stringify(stripLocations(resultExtra.value))
          );
        }),
        PBT_CONFIG
      );
    });

    it("property: newlines act as statement separators", () => {
      // Filter out atoms starting with reserved keywords that could form
      // multi-line logical expressions (e.g., "abc\nor0" parses as "abc or 0")
      const genSafeAtom = genSimpleAtom.filter(
        (atom) => !atom.startsWith("and") && !atom.startsWith("or") && !atom.startsWith("not")
      );
      fc.assert(
        fc.property(genSimpleAtom, genSafeAtom, (a, b) => {
          const input = `${a}\n${b}`;
          const result = parseSource(input);
          if (!result.success) return true;
          // Should have 2 statements
          return result.value.statements.length === 2;
        }),
        PBT_CONFIG
      );
    });
  });

  describe("Comment Handling", () => {
    it("property: comments do not affect parsing", () => {
      fc.assert(
        fc.property(genSimpleAtom, fc.string(), (atom, comment) => {
          // Ensure comment doesn't contain newlines
          const safeComment = comment.replace(/[\n\r]/g, " ");
          const withComment = `${atom} # ${safeComment}`;
          const withoutComment = atom;

          const resultWith = parseSource(withComment);
          const resultWithout = parseSource(withoutComment);

          if (!resultWith.success || !resultWithout.success) return true;

          // Should parse to same AST (ignoring locations)
          return (
            JSON.stringify(stripLocations(resultWith.value)) ===
            JSON.stringify(stripLocations(resultWithout.value))
          );
        }),
        PBT_CONFIG
      );
    });
  });

  describe("Edge Cases", () => {
    it("property: deeply nested parentheses parse correctly", function() {
      this.timeout(10000); // Increase timeout for nested parsing
      fc.assert(
        fc.property(
          genIdentifier,
          fc.integer({ min: 1, max: 5 }), // Reduced max depth for performance
          (id, depth) => {
            const open = "(".repeat(depth);
            const close = ")".repeat(depth);
            const input = `${open}${id}${close}`;
            const result = parseSource(input);
            return result.success;
          }
        ),
        PBT_CONFIG
      );
    });

    it("property: long pipelines parse correctly", () => {
      fc.assert(
        fc.property(
          fc.array(genIdentifier, { minLength: 2, maxLength: 10 }),
          (ids) => {
            const input = ids.join(" | ");
            const result = parseSource(input);
            return result.success;
          }
        ),
        PBT_CONFIG
      );
    });

    it("property: long concatenations parse correctly", () => {
      fc.assert(
        fc.property(fc.array(genPath, { minLength: 2, maxLength: 10 }), (paths) => {
          const input = paths.join(" + ");
          const result = parseSource(input);
          return result.success;
        }),
        PBT_CONFIG
      );
    });

    it("property: mixed operators parse correctly", () => {
      fc.assert(
        fc.property(
          genPath,
          genPath,
          genSelector,
          genIdentifier,
          genIdentifier,
          (file1, file2, sel, fn, arg) => {
            const input = `${file1} + ${file2} | ${sel} |= ${fn} ${arg}`;
            const result = parseSource(input);
            return result.success;
          }
        ),
        PBT_CONFIG
      );
    });
  });

  describe("Stress Tests", () => {
    it("property: many statements in a program", () => {
      // Filter out atoms starting with reserved keywords that could form
      // multi-line logical expressions (e.g., "abc\nor0" parses as "abc or 0")
      const genSafeAtom = genSimpleAtom.filter(
        (atom) =>
          !atom.startsWith("and") &&
          !atom.startsWith("or") &&
          !atom.startsWith("not")
      );
      fc.assert(
        fc.property(
          fc.array(genSafeAtom, { minLength: 10, maxLength: 50 }),
          (atoms) => {
            const input = atoms.join("\n");
            const result = parseSource(input);
            if (!result.success) return true;
            return result.value.statements.length === atoms.length;
          }
        ),
        { numRuns: 100 } // Fewer runs because each test is larger
      );
    });

    it("property: complex nested expressions", () => {
      fc.assert(
        fc.property(
          genPath,
          genSelector,
          genIdentifier,
          genSimpleList,
          (file, sel, fn, list) => {
            const input = `${file} | ${sel} |= (${fn} ${list} | debug)`;
            const result = parseSource(input);
            return result.success;
          }
        ),
        PBT_CONFIG
      );
    });
  });
});
