/**
 * test-helpers.ts
 *
 * Helper functions for interpreter comparison tests
 */

import { ABCContext } from "../../parsers/Context";
import { AbcErrorReporter } from "../../parsers/ErrorReporter";
import { Scanner2 } from "../../parsers/scan2";
import { parse } from "../../parsers/parse2";
import { SemanticAnalyzer } from "../../analyzers/semantic-analyzer";
import { TuneInterpreter } from "../../interpreter/TuneInterpreter";
import { Tune } from "../../types/abcjs-ast";
import { parseWithAbcjs, AbcjsRawTune } from "./abcjs-wrapper";
import { compareTunes, ComparisonResult, formatComparisonResult } from "./comparison-utils";

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse ABC notation with your parser + interpreter
 */
export function parseWithYourParser(input: string): { tunes: Tune[]; ctx: ABCContext } {
  // Create context
  const ctx = new ABCContext(new AbcErrorReporter());

  // Scanner (it's a function that returns tokens)
  const tokens = Scanner2(input, ctx);

  // Parser
  const ast = parse(tokens, ctx);

  // Semantic analyzer
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  // Interpreter
  const interpreter = new TuneInterpreter(analyzer, ctx);
  const result = interpreter.interpretFile(ast);

  return {
    tunes: result.tunes,
    ctx,
  };
}

/**
 * Run both parsers and return results
 */
export function runBothParsers(input: string): {
  yours: { tunes: Tune[]; ctx: ABCContext };
  abcjs: { tunes: AbcjsRawTune[] };
} {
  const yours = parseWithYourParser(input);
  const abcjs = { tunes: parseWithAbcjs(input) };

  return { yours, abcjs };
}

/**
 * Run both parsers and compare results
 */
export function runComparison(
  input: string,
  options: { strict?: boolean; tuneIndex?: number } = {}
): ComparisonResult {
  const { yours, abcjs } = runBothParsers(input);

  const tuneIndex = options.tuneIndex ?? 0;

  if (!yours.tunes[tuneIndex]) {
    throw new Error(`Your parser did not produce tune at index ${tuneIndex}`);
  }

  if (!abcjs.tunes[tuneIndex]) {
    throw new Error(`abcjs parser did not produce tune at index ${tuneIndex}`);
  }

  return compareTunes(yours.tunes[tuneIndex], abcjs.tunes[tuneIndex], options);
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that both parsers produce similar output
 * Throws if comparison fails
 */
export function expectSimilarOutput(
  input: string,
  options: { strict?: boolean; tuneIndex?: number; description?: string } = {}
): ComparisonResult {
  const result = runComparison(input, options);

  if (!result.matches) {
    const formatted = formatComparisonResult(result);
    const desc = options.description ? `\n${options.description}\n` : '';
    throw new Error(`Parser outputs differ:${desc}\n${formatted}`);
  }

  return result;
}

/**
 * Assert that both parsers produce the same number of tunes
 */
export function expectSameTuneCount(input: string): void {
  const { yours, abcjs } = runBothParsers(input);

  if (yours.tunes.length !== abcjs.tunes.length) {
    throw new Error(
      `Different number of tunes: Your parser produced ${yours.tunes.length}, abcjs produced ${abcjs.tunes.length}`
    );
  }
}

/**
 * Assert that parser completed without errors
 */
export function expectNoErrors(ctx: ABCContext, parserName: string): void {
  if (ctx.errorReporter.hasErrors()) {
    const errors = ctx.errorReporter.getErrors();
    const errorMessages = errors.map((e) => e.message).join('\n  ');
    throw new Error(`${parserName} had errors:\n  ${errorMessages}`);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple ABC tune for testing
 */
export function createSimpleTune(options: {
  title?: string;
  composer?: string;
  key?: string;
  meter?: string;
  noteLength?: string;
  music?: string;
} = {}): string {
  const {
    title = "Test Tune",
    composer = "Test Composer",
    key = "C",
    meter = "4/4",
    noteLength = "1/8",
    music = "CDEF GABc|",
  } = options;

  return `X:1
T:${title}
C:${composer}
M:${meter}
L:${noteLength}
K:${key}
${music}`;
}

/**
 * Log comparison result in a readable format
 */
export function logComparisonResult(result: ComparisonResult): void {
  console.log(formatComparisonResult(result));
}
