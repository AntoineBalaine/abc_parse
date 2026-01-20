// ABCT Operator Documentation
// Documentation for pipe, update, concat, and other operators

/**
 * Operator documentation structure
 */
export interface OperatorInfo {
  symbol: string;
  name: string;
  description: string;
  documentation: string;
  examples: string[];
  seeAlso: string[];
}

/**
 * Registry of operator documentation for hover tooltips.
 */
export const operatorDocs: Map<string, OperatorInfo> = new Map([
  [
    "|",
    {
      symbol: "|",
      name: "pipe",
      description: "Pass output to next operation",
      documentation: `The pipe operator passes the result of the left expression as input to the right expression.

The result flows left-to-right through the pipeline. Each step receives the output of the previous step.

Unlike |= (update), the pipe extracts and transforms data without preserving context.`,
      examples: [
        "song.abc | transpose 2",
        "file.abc | @notes | retrograde",
        "input | @chords | bass",
      ],
      seeAlso: ["|=", "+"],
    },
  ],
  [
    "|=",
    {
      symbol: "|=",
      name: "update",
      description: "Focus, transform, and reintegrate",
      documentation: `The update operator focuses on selected nodes, applies a transform, then reintegrates the result into the original context.

The left side must be a selector that identifies which nodes to modify.
The right side is the transform to apply to those nodes.
The result is the full document with only the selected nodes modified.

This differs from | (pipe) which extracts nodes and loses their original context.`,
      examples: [
        "@chords |= transpose 2",
        "song.abc | @notes |= octave 1",
        "@V:melody |= retrograde",
      ],
      seeAlso: ["|", "@"],
    },
  ],
  [
    "+",
    {
      symbol: "+",
      name: "concat",
      description: "Concatenate two expressions",
      documentation: `The concat operator combines two ABC expressions sequentially.

The right expression is appended after the left expression.
Both expressions are evaluated independently and then joined.`,
      examples: [
        "intro.abc + verse.abc",
        "song.abc | @M:1-4 + song.abc | @M:5-8",
      ],
      seeAlso: ["|"],
    },
  ],
  [
    "=",
    {
      symbol: "=",
      name: "assignment",
      description: "Assign a value to a variable",
      documentation: `The assignment operator binds a value to a variable name.

The left side is the variable name (an identifier).
The right side is the expression to evaluate and store.

Variables can be referenced later by their name.`,
      examples: [
        "source = song.abc",
        "melody = source | @V:melody",
        "result = melody | transpose 5",
      ],
      seeAlso: [],
    },
  ],
  [
    "@",
    {
      symbol: "@",
      name: "selector",
      description: "Select nodes by type or criteria",
      documentation: `The @ symbol introduces a selector expression.

Selectors filter ABC nodes by type (notes, chords, voices) or by location (measures, ranges).

Common selectors:
- @notes, @n: Select all notes
- @chords, @c: Select all chords
- @V:name: Select a specific voice
- @M:range: Select a measure range`,
      examples: [
        "@notes",
        "@chords",
        "@V:melody",
        "@M:1-8",
      ],
      seeAlso: ["|="],
    },
  ],
  [
    "or",
    {
      symbol: "or",
      name: "logical or",
      description: "Logical OR of two conditions",
      documentation: `The or keyword performs logical disjunction.

Returns true if either operand is true. Used in conditional expressions.`,
      examples: [
        "@notes or @chords",
      ],
      seeAlso: ["and", "not"],
    },
  ],
  [
    "and",
    {
      symbol: "and",
      name: "logical and",
      description: "Logical AND of two conditions",
      documentation: `The and keyword performs logical conjunction.

Returns true only if both operands are true. Used in conditional expressions.`,
      examples: [
        "@notes and @V:melody",
      ],
      seeAlso: ["or", "not"],
    },
  ],
  [
    "not",
    {
      symbol: "not",
      name: "logical not",
      description: "Logical negation",
      documentation: `The not keyword negates a boolean expression.

Returns true if the operand is false, and vice versa.`,
      examples: [
        "not @chords",
      ],
      seeAlso: ["and", "or"],
    },
  ],
]);

/**
 * Get operator documentation by symbol.
 * @param op - The operator symbol (e.g., "|", "|=", "+")
 * @returns The operator info, or undefined if not found
 */
export function getOperatorInfo(op: string): OperatorInfo | undefined {
  return operatorDocs.get(op);
}
