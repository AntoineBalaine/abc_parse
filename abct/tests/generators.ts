// Fast-check generators for ABCT grammar
// These generators produce valid ABCT syntax strings for property-based testing

import * as fc from "fast-check";

// ============================================================================
// Terminal Generators
// ============================================================================

/**
 * Generate a valid identifier (starts with letter or _, contains alphanumerics)
 * Excludes reserved words: and, or, not
 */
export const genIdentifier: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,8}$/)
  .filter((id) => !["and", "or", "not"].includes(id));

/**
 * Generate a valid integer (positive or negative)
 */
export const genInteger: fc.Arbitrary<string> = fc
  .integer({ min: -999, max: 999 })
  .map(String);

/**
 * Generate a valid number (integer or fraction)
 */
export const genNumber: fc.Arbitrary<string> = fc.oneof(
  genInteger,
  fc
    .tuple(fc.nat({ max: 99 }), fc.integer({ min: 1, max: 99 }))
    .map(([num, denom]) => `${num}/${denom}`)
);

/**
 * Generate a valid file path (must have extension)
 */
export const genPath: fc.Arbitrary<string> = fc
  .tuple(
    genIdentifier.filter((id) => id.length > 0 && id.length <= 10),
    fc.constantFrom(".abc", ".abct", ".txt", ".music")
  )
  .map(([name, ext]) => name + ext);

/**
 * Generate a valid file path with optional subdirectory
 */
export const genPathWithDir: fc.Arbitrary<string> = fc.oneof(
  genPath,
  fc
    .tuple(genIdentifier.filter((id) => id.length <= 5), genPath)
    .map(([dir, file]) => `${dir}/${file}`),
  fc.tuple(genPath).map(([file]) => `./${file}`)
);

// ============================================================================
// Selector Generators
// ============================================================================

/**
 * Generate a short selector: @c, @n, @r, @b, @v, @d, @m
 */
export const genSelectorShort: fc.Arbitrary<string> = fc.constantFrom(
  "@c",
  "@n",
  "@r",
  "@b",
  "@v",
  "@d",
  "@m"
);

/**
 * Generate a full selector: @chords, @notes, @rests, etc.
 */
export const genSelectorFull: fc.Arbitrary<string> = fc.constantFrom(
  "@chords",
  "@notes",
  "@rests",
  "@bars",
  "@voices",
  "@decorations",
  "@measures"
);

/**
 * Generate a named selector: @V:melody, @V:1, @M:5-8
 */
export const genSelectorNamed: fc.Arbitrary<string> = fc.oneof(
  // Voice selector with name: @V:melody
  fc
    .tuple(fc.constant("V"), genIdentifier.filter((id) => id.length <= 8))
    .map(([type, name]) => `@${type}:${name}`),
  // Voice selector with number: @V:1
  fc
    .tuple(fc.constant("V"), fc.nat({ max: 10 }))
    .map(([type, num]) => `@${type}:${num}`),
  // Measure selector with range: @M:5-8
  fc
    .tuple(fc.constant("M"), fc.nat({ max: 50 }), fc.nat({ max: 50 }))
    .filter(([, start, end]) => start <= end)
    .map(([type, start, end]) => `@${type}:${start}-${end}`),
  // Measure selector with single number: @M:5
  fc.tuple(fc.constant("M"), fc.nat({ max: 50 })).map(([type, num]) => `@${type}:${num}`)
);

/**
 * Generate any valid selector
 */
export const genSelector: fc.Arbitrary<string> = fc.oneof(
  genSelectorShort,
  genSelectorFull,
  genSelectorNamed
);

// ============================================================================
// Location Generators
// ============================================================================

/**
 * Generate a location for file references: line, line:col, line:col-col, line:col-line:col
 * Note: This is prefixed with colon for use in file references (file.abc:10:5)
 */
export const genLocation: fc.Arbitrary<string> = fc.oneof(
  // Just line: 10
  fc.nat({ max: 1000 }).map((line) => `:${line}`),
  // Line and column: 10:5
  fc
    .tuple(fc.nat({ max: 1000 }), fc.nat({ max: 200 }))
    .map(([line, col]) => `:${line}:${col}`),
  // Line, column, end column: 10:5-15
  fc
    .tuple(fc.nat({ max: 1000 }), fc.nat({ max: 200 }), fc.nat({ max: 200 }))
    .filter(([, start, end]) => start <= end)
    .map(([line, col, endCol]) => `:${line}:${col}-${endCol}`),
  // Multi-line range: 10:5-12:20
  fc
    .tuple(
      fc.nat({ max: 1000 }),
      fc.nat({ max: 200 }),
      fc.nat({ max: 1000 }),
      fc.nat({ max: 200 })
    )
    .filter(([startLine, , endLine]) => startLine <= endLine)
    .map(
      ([startLine, startCol, endLine, endCol]) =>
        `:${startLine}:${startCol}-${endLine}:${endCol}`
    )
);

/**
 * Generate a location selector: :line, :line:col, :line:col-col, :line:col-line:col
 * These are standalone atoms for use in pipelines (src.abc | :10:5 |= ...)
 *
 * Note: This is structurally similar to genLocation but serves a different purpose.
 * genLocation is used in file references (file.abc:10:5) while genLocationSelector
 * is used as standalone expressions in pipelines. Both are needed because they
 * appear in different grammar contexts.
 */
export const genLocationSelector: fc.Arbitrary<string> = fc.oneof(
  // Just line: :10
  fc.nat({ max: 1000 }).map((line) => `:${line}`),
  // Line and column: :10:5
  fc
    .tuple(fc.nat({ max: 1000 }), fc.nat({ max: 200 }))
    .map(([line, col]) => `:${line}:${col}`),
  // Single line range: :10:5-15
  fc
    .tuple(fc.nat({ max: 1000 }), fc.nat({ max: 200 }), fc.nat({ max: 200 }))
    .filter(([, start, end]) => start <= end)
    .map(([line, col, endCol]) => `:${line}:${col}-${endCol}`),
  // Multi-line range: :10:5-12:20
  fc
    .tuple(
      fc.nat({ max: 1000 }),
      fc.nat({ max: 200 }),
      fc.nat({ max: 1000 }),
      fc.nat({ max: 200 })
    )
    .filter(([startLine, , endLine]) => startLine <= endLine)
    .map(
      ([startLine, startCol, endLine, endCol]) =>
        `:${startLine}:${startCol}-${endLine}:${endCol}`
    )
);

// ============================================================================
// Literal Generators
// ============================================================================

/**
 * Generate ABC literal content (no triple backticks)
 */
export const genAbcContent: fc.Arbitrary<string> = fc
  .stringMatching(/^[A-Ga-g0-9\[\]|:,/^_' ]{0,20}$/)
  .filter((s) => !s.includes("```")); // Avoid triple backticks

/**
 * Generate a complete ABC literal: ```\ncontent\n``` or ```abc\ncontent\n```
 * The 'abc' language specifier is optional.
 */
export const genAbcLiteral: fc.Arbitrary<string> = fc
  .tuple(genAbcContent, fc.boolean())
  .map(([content, withAbc]) =>
    (withAbc ? "```abc" : "```") + "\n" + content + "\n```"
  );

// ============================================================================
// List Generator
// ============================================================================

/**
 * Generate a list with simple items
 */
export const genSimpleList: fc.Arbitrary<string> = fc.oneof(
  fc.constant("[]"),
  fc.array(genIdentifier, { minLength: 1, maxLength: 4 }).map((items) => `[${items.join(", ")}]`),
  fc.array(genNumber, { minLength: 1, maxLength: 4 }).map((items) => `[${items.join(", ")}]`)
);

// ============================================================================
// File Reference Generator
// ============================================================================

/**
 * Generate a selector path (without the @ prefix) for use in file references
 */
export const genSelectorPath: fc.Arbitrary<string> = fc.oneof(
  // Simple: chords, notes
  genIdentifier.filter((id) => id.length <= 8),
  // Named with identifier: V:melody
  fc
    .tuple(fc.constant("V"), genIdentifier.filter((id) => id.length <= 6))
    .map(([type, name]) => `${type}:${name}`),
  // Named with number: V:1, M:5
  fc
    .tuple(fc.constantFrom("V", "M"), fc.nat({ max: 10 }))
    .map(([type, num]) => `${type}:${num}`),
  // Named with range: M:5-8
  fc
    .tuple(fc.constant("M"), fc.nat({ max: 50 }), fc.nat({ max: 50 }))
    .filter(([, start, end]) => start <= end)
    .map(([type, start, end]) => `${type}:${start}-${end}`)
);

/**
 * Generate a file reference with optional location and selector
 */
export const genFileRef: fc.Arbitrary<string> = fc.oneof(
  // Just path
  genPath,
  // Path with location
  fc.tuple(genPath, genLocation).map(([path, loc]) => `${path}${loc}`),
  // Path with selector (uses @ prefix)
  fc.tuple(genPath, genSelectorPath).map(([path, selPath]) => `${path}@${selPath}`),
  // Path with location and selector
  fc
    .tuple(genPath, genLocation, genSelectorPath)
    .map(([path, loc, selPath]) => `${path}${loc}@${selPath}`)
);

// ============================================================================
// Atom Generators
// ============================================================================

/**
 * Generate a simple atom (not recursive)
 * Note: ABC literals are excluded because they must be at line start
 * and can't appear inline in expressions. Use genAbcLiteral separately
 * for testing standalone ABC literals.
 */
export const genSimpleAtom: fc.Arbitrary<string> = fc.oneof(
  genIdentifier,
  genNumber,
  genPath,
  genSimpleList,
  genLocationSelector
);

// ============================================================================
// Expression Generators (Non-recursive to avoid letrec complexity)
// ============================================================================

/**
 * Generate a comparison expression
 */
export const genComparison: fc.Arbitrary<string> = fc
  .tuple(
    genSimpleAtom,
    fc.constantFrom(">", "<", ">=", "<=", "==", "!="),
    genSimpleAtom
  )
  .map(([left, op, right]) => `${left} ${op} ${right}`);

/**
 * Generate a not expression
 */
export const genNotExpr: fc.Arbitrary<string> = genSimpleAtom.map(
  (e) => `not ${e}`
);

/**
 * Generate an and expression
 */
export const genAndExpr: fc.Arbitrary<string> = fc
  .tuple(genSimpleAtom, genSimpleAtom)
  .map(([left, right]) => `${left} and ${right}`);

/**
 * Generate an or expression
 */
export const genOrExpr: fc.Arbitrary<string> = fc
  .tuple(genSimpleAtom, genSimpleAtom)
  .map(([left, right]) => `${left} or ${right}`);

/**
 * Generate a function application
 */
export const genApplication: fc.Arbitrary<string> = fc
  .tuple(genIdentifier, fc.array(genSimpleAtom, { minLength: 0, maxLength: 2 }))
  .map(([fn, args]) => [fn, ...args].join(" "));

/**
 * Generate an update expression
 */
export const genUpdate: fc.Arbitrary<string> = fc
  .tuple(genSelector, genApplication)
  .map(([sel, app]) => `${sel} |= ${app}`);

/**
 * Generate a location update expression (using location selector instead of @ selector)
 */
export const genLocationUpdate: fc.Arbitrary<string> = fc
  .tuple(genLocationSelector, genApplication)
  .map(([loc, app]) => `${loc} |= ${app}`);

/**
 * Generate a pipeline with a location update (file | :location |= transform)
 */
export const genPipelineWithLocationUpdate: fc.Arbitrary<string> = fc
  .tuple(genPath, genLocationSelector, genApplication)
  .map(([file, loc, app]) => `${file} | ${loc} |= ${app}`);

/**
 * Generate a simple pipe expression
 */
export const genSimplePipe: fc.Arbitrary<string> = fc
  .tuple(genSimpleAtom, genSimpleAtom)
  .map(([left, right]) => `${left} | ${right}`);

/**
 * Generate a simple concat expression
 */
export const genSimpleConcat: fc.Arbitrary<string> = fc
  .tuple(genPath, genPath)
  .map(([left, right]) => `${left} + ${right}`);

/**
 * Generate a parenthesized simple expression
 */
export const genParenExpr: fc.Arbitrary<string> = genSimpleAtom.map(
  (e) => `(${e})`
);

/**
 * Generate an expression (weighted selection of different expression types)
 */
export const genExpr: fc.Arbitrary<string> = fc.oneof(
  { weight: 5, arbitrary: genSimpleAtom },
  { weight: 2, arbitrary: genApplication },
  { weight: 2, arbitrary: genComparison },
  { weight: 1, arbitrary: genUpdate },
  { weight: 1, arbitrary: genLocationUpdate },
  { weight: 1, arbitrary: genSimplePipe },
  { weight: 1, arbitrary: genSimpleConcat },
  { weight: 1, arbitrary: genParenExpr },
  { weight: 1, arbitrary: genNotExpr },
  { weight: 1, arbitrary: genAndExpr },
  { weight: 1, arbitrary: genOrExpr }
);

// ============================================================================
// Statement Generators
// ============================================================================

/**
 * Generate an assignment statement
 */
export const genAssignment: fc.Arbitrary<string> = fc
  .tuple(genIdentifier, genExpr)
  .map(([id, expr]) => `${id} = ${expr}`);

/**
 * Generate a statement (assignment or expression)
 */
export const genStatement: fc.Arbitrary<string> = fc.oneof(
  { weight: 1, arbitrary: genAssignment },
  { weight: 3, arbitrary: genExpr }
);

// ============================================================================
// Program Generator
// ============================================================================

/**
 * Generate a complete valid program
 */
export const genProgram: fc.Arbitrary<string> = fc
  .array(genStatement, { minLength: 1, maxLength: 5 })
  .map((statements) => statements.join("\n"));

// ============================================================================
// Specialized Generators for Specific Patterns
// ============================================================================

/**
 * Generate a typical transform pipeline
 */
export const genTransformPipeline: fc.Arbitrary<string> = fc
  .tuple(
    genPath,
    genSelector,
    genIdentifier,
    fc.array(genIdentifier, { minLength: 0, maxLength: 2 })
  )
  .map(([file, sel, fn, args]) => {
    const fnCall = [fn, ...args].join(" ");
    return `${file} | ${sel} |= ${fnCall}`;
  });

/**
 * Generate a file combination expression
 */
export const genFileCombination: fc.Arbitrary<string> = fc
  .array(genPath, { minLength: 2, maxLength: 4 })
  .map((files) => files.join(" + "));

/**
 * Generate a filter expression
 */
export const genFilterExpr: fc.Arbitrary<string> = fc
  .tuple(
    genIdentifier,
    fc.constantFrom(">", "<", ">=", "<=", "==", "!="),
    genNumber
  )
  .map(([prop, op, val]) => `filter (${prop} ${op} ${val})`);

/**
 * Generate a voice distribution expression
 */
export const genVoiceDistribution: fc.Arbitrary<string> = fc
  .array(
    fc
      .tuple(fc.constant("V"), genIdentifier.filter((id) => id.length <= 6))
      .map(([type, name]) => `${type}:${name}`),
    { minLength: 2, maxLength: 4 }
  )
  .map((voices) => `distribute [${voices.join(", ")}]`);
