/**
 * Fast-check generators for ABCT scanner tests
 */

import * as fc from "fast-check";

/**
 * Generate a valid identifier (starts with letter or _, contains alphanumerics)
 * Excludes reserved words: and, or, not
 */
export const genIdentifier: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,15}$/)
  .filter((id) => !["and", "or", "not"].includes(id) && id.length > 0);

/**
 * Generate a keyword: and, or, not
 */
export const genKeyword: fc.Arbitrary<string> = fc.constantFrom("and", "or", "not");

/**
 * Generate a valid integer (positive only, negative handled by parser)
 */
export const genInteger: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 999 })
  .map(String);

/**
 * Generate a valid decimal number (positive only)
 */
export const genDecimal: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 })
  )
  .map(([whole, frac]) => `${whole}.${frac}`);

/**
 * Generate a valid fraction
 */
export const genFraction: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 1, max: 99 })
  )
  .map(([num, denom]) => `${num}/${denom}`);

/**
 * Generate any valid number (integer, decimal, or fraction)
 */
export const genNumber: fc.Arbitrary<string> = fc.oneof(
  genInteger,
  genDecimal,
  genFraction
);

/**
 * Generate a simple string literal (no escapes)
 */
export const genSimpleString: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9 _,.!?]{0,20}$/)
  .map((content) => `"${content}"`);

/**
 * Generate a string with escape sequences
 */
export const genEscapedString: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      fc.stringMatching(/^[a-zA-Z0-9 ]{1,5}$/),
      fc.constantFrom('\\"', "\\n", "\\t", "\\\\")
    ),
    { minLength: 0, maxLength: 5 }
  )
  .map((parts) => `"${parts.join("")}"`);

/**
 * Generate any valid string literal
 */
export const genString: fc.Arbitrary<string> = fc.oneof(
  genSimpleString,
  genEscapedString
);

/**
 * Generate simple ABC content (no triple backticks inside)
 */
export const genAbcContent: fc.Arbitrary<string> = fc
  .stringMatching(/^[A-Ga-g0-9 |:\[\]\/]{0,50}$/)
  .filter((content) => !content.includes("```"));

/**
 * Generate an ABC fence literal (triple-backtick syntax)
 * Format: ```\ncontent\n``` or ```abc\ncontent\n```
 * The 'abc' language specifier is optional.
 */
export const genAbcFence: fc.Arbitrary<string> = fc
  .tuple(genAbcContent, fc.boolean())
  .map(([content, withAbc]) =>
    (withAbc ? "```abc" : "```") + "\n" + content + "\n```"
  );

/**
 * Generate an ABC fence with location
 * Format: ``` :line:col\ncontent\n``` or ```abc :line:col\ncontent\n```
 * The 'abc' language specifier is optional.
 */
export const genAbcFenceWithLocation: fc.Arbitrary<string> = fc
  .tuple(
    genAbcContent,
    fc.integer({ min: 1, max: 100 }),
    fc.integer({ min: 1, max: 100 }),
    fc.boolean()
  )
  .map(([content, line, col, withAbc]) =>
    (withAbc ? "```abc" : "```") + " :" + line + ":" + col + "\n" + content + "\n```"
  );

// Legacy alias for backwards compatibility during migration
export const genAbcLiteral = genAbcFence;

/**
 * Generate horizontal whitespace
 */
export const genWS: fc.Arbitrary<string> = fc.stringMatching(/^[ \t]{1,10}$/);

/**
 * Generate an end-of-line character
 */
export const genEOL: fc.Arbitrary<string> = fc.constantFrom("\n", "\r", "\r\n");

/**
 * Generate a comment
 */
export const genComment: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9 _,.!?]{0,30}$/)
  .map((content) => `# ${content}`);

/**
 * Generate a dot (for file paths)
 */
export const genDot: fc.Arbitrary<string> = fc.constant(".");

/**
 * Generate a comma (for lists)
 */
export const genComma: fc.Arbitrary<string> = fc.constant(",");

/**
 * Generate a single-character operator
 */
export const genSingleOp: fc.Arbitrary<string> = fc.constantFrom(
  "|", "+", "=", "@", ":", "-", "(", ")", "[", "]", ">", "<"
);

/**
 * Generate any single-character punctuation (safe for round-trip tests)
 */
export const genSafeSingleOp: fc.Arbitrary<string> = fc.constantFrom(
  "|", "+", "=", "@", ":", "-", "(", ")", "[", "]", ".", ",", "<", ">"
);

/**
 * Generate a two-character operator
 */
export const genDoubleOp: fc.Arbitrary<string> = fc.constantFrom(
  "|=", ">=", "<=", "==", "!="
);

/**
 * Generate any operator
 */
export const genOperator: fc.Arbitrary<string> = fc.oneof(
  genSingleOp,
  genDoubleOp
);

/**
 * Generate any token type (for comprehensive round-trip testing)
 * Exclusions:
 * - ABC fences: Require line start positioning
 * - Comments: Consume until EOL, so must be followed by newline
 * - EOL tokens: Test separately as they interact with comments and line tracking
 */
export const genAnyToken: fc.Arbitrary<string> = fc.oneof(
  genIdentifier,
  genKeyword,
  genNumber,
  genString,
  genSafeSingleOp,
  genDoubleOp,
  genWS
);

/**
 * Generate a sequence of tokens joined together
 */
export const genTokenSequence: fc.Arbitrary<string> = fc
  .array(genAnyToken, { minLength: 1, maxLength: 15 })
  .map((tokens) => tokens.join(""));
