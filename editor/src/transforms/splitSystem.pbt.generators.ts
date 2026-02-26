import { IRational, createRational, addRational, subtractRational, multiplyRational, compareRational, isToken } from "abc-parser";
import { ABCContext } from "abc-parser/parsers/Context";
import { AbcErrorReporter } from "abc-parser/parsers/ErrorReporter";
import { Token, TT } from "abc-parser/parsers/scan2";
import { Expr, Note, Rest, Chord, Rhythm, Pitch, Annotation, Decoration, Grace_group } from "abc-parser/types/Expr2";
import { Position } from "abc-parser/types/types";
import { AbcFormatter } from "abc-parser/Visitors/Formatter2";
import { RangeVisitor } from "abc-parser/Visitors/RangeVisitor";
import * as fc from "fast-check";

type SystemAst = Array<Expr | Token>;

export interface SplitTestCase {
  beforeParts: SystemAst[];
  afterParts: SystemAst[];
  numVoices: number;
  beforeDuration: IRational;
  abcString: string;
}

// Duration generators

/**
 * Generates musical durations as rationals (1/4 to 4/1 range).
 */
export function genDuration(): fc.Arbitrary<IRational> {
  return fc.tuple(fc.integer({ min: 1, max: 4 }), fc.constantFrom(1, 2, 4)).map(([num, denom]) => createRational(num, denom));
}

/**
 * Generates a rational number in the range [min, max].
 */
export function genRationalInRange(min: IRational, max: IRational): fc.Arbitrary<IRational> {
  return fc.integer({ min: 0, max: 100 }).map((percent) => {
    const range = subtractRational(max, min);
    const offset = multiplyRational(range, createRational(percent, 100));
    return addRational(min, offset);
  });
}

/**
 * Checks if a set of cut points would produce any zero-length segments.
 */
function hasZeroLengthSegments(cuts: IRational[], total: IRational): boolean {
  const sortedCuts = [...cuts].sort((a, b) => compareRational(a, b));
  const allPoints = [createRational(0, 1), ...sortedCuts, total];
  for (let i = 0; i < allPoints.length - 1; i++) {
    const diff = subtractRational(allPoints[i + 1], allPoints[i]);
    if (diff.numerator === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Subdivides a total duration into random parts that sum exactly to total.
 * Filters out invalid subdivisions that would produce zero-length segments.
 */
export function genSubdivisions(total: IRational): fc.Arbitrary<IRational[]> {
  return fc.integer({ min: 1, max: 4 }).chain((numParts) => {
    if (numParts === 1) {
      return fc.constant([total]);
    }

    // Generate numParts-1 cut points in [0, total], sort, then compute differences.
    // We filter out sets that produce zero-length segments to preserve the total invariant.
    return fc
      .array(genRationalInRange(createRational(0, 1), total), {
        minLength: numParts - 1,
        maxLength: numParts - 1,
      })
      .filter((cuts) => !hasZeroLengthSegments(cuts, total))
      .map((cuts) => {
        const sortedCuts = [...cuts].sort((a, b) => compareRational(a, b));
        const allPoints = [createRational(0, 1), ...sortedCuts, total];
        const subdivisions: IRational[] = [];
        for (let i = 0; i < allPoints.length - 1; i++) {
          const diff = subtractRational(allPoints[i + 1], allPoints[i]);
          subdivisions.push(diff);
        }
        return subdivisions;
      });
  });
}

// Content generators

/**
 * Generates a pitch with random note letter and optional accidental/octave.
 */
function genPitch(ctx: ABCContext): fc.Arbitrary<Pitch> {
  return fc
    .tuple(
      fc.option(fc.constantFrom("^", "^^", "_", "__", "="), { nil: undefined }),
      fc.constantFrom("A", "B", "C", "D", "E", "F", "G", "a", "b", "c", "d", "e", "f", "g"),
      fc.option(fc.constantFrom("'", "''", ",", ",,"), { nil: undefined })
    )
    .map(([acc, letter, oct]) => {
      const alteration = acc ? new Token(TT.ACCIDENTAL, acc, ctx.generateId()) : undefined;
      const noteLetter = new Token(TT.NOTE_LETTER, letter, ctx.generateId());
      const octave = oct ? new Token(TT.OCTAVE, oct, ctx.generateId()) : undefined;
      return new Pitch(ctx.generateId(), { alteration, noteLetter, octave });
    });
}

/**
 * Builds a Rhythm node from an IRational duration.
 */
function buildRhythmFromDuration(duration: IRational, ctx: ABCContext): Rhythm | undefined {
  const { numerator, denominator } = duration;
  if (numerator === 1 && denominator === 1) {
    return undefined;
  }

  let numToken: Token | null = null;
  let sepToken: Token | undefined = undefined;
  let denToken: Token | undefined = undefined;

  if (denominator === 1) {
    numToken = new Token(TT.RHY_NUMER, numerator.toString(), ctx.generateId());
  } else {
    if (numerator !== 1) {
      numToken = new Token(TT.RHY_NUMER, numerator.toString(), ctx.generateId());
    }
    sepToken = new Token(TT.RHY_SEP, "/", ctx.generateId());
    if (denominator !== 2) {
      denToken = new Token(TT.RHY_DENOM, denominator.toString(), ctx.generateId());
    }
  }

  return new Rhythm(ctx.generateId(), numToken, sepToken, denToken ?? null);
}

/**
 * Generates a Note with specified duration.
 */
function genNoteWithDuration(duration: IRational, ctx: ABCContext): fc.Arbitrary<Note> {
  return genPitch(ctx).map((pitch) => {
    const rhythm = buildRhythmFromDuration(duration, ctx);
    return new Note(ctx.generateId(), pitch, rhythm, undefined);
  });
}

/**
 * Generates a Rest with specified duration.
 */
function genRestWithDuration(duration: IRational, ctx: ABCContext): fc.Arbitrary<Rest> {
  return fc.constant(null).map(() => {
    const restToken = new Token(TT.REST, "z", ctx.generateId());
    const rhythm = buildRhythmFromDuration(duration, ctx);
    return new Rest(ctx.generateId(), restToken, rhythm);
  });
}

/**
 * Generates a Chord (2-4 notes) with specified duration.
 */
function genChordWithDuration(duration: IRational, ctx: ABCContext): fc.Arbitrary<Chord> {
  return fc.array(genPitch(ctx), { minLength: 2, maxLength: 4 }).map((pitches) => {
    const notes = pitches.map((p) => new Note(ctx.generateId(), p, undefined, undefined));
    const rhythm = buildRhythmFromDuration(duration, ctx);
    return new Chord(ctx.generateId(), notes, rhythm, undefined);
  });
}

/**
 * Generates a time event (note, rest, or chord) with specified duration.
 */
export function genTimeEvent(duration: IRational, ctx: ABCContext): fc.Arbitrary<Expr> {
  return fc.oneof(
    { arbitrary: genNoteWithDuration(duration, ctx), weight: 10 },
    { arbitrary: genRestWithDuration(duration, ctx), weight: 3 },
    { arbitrary: genChordWithDuration(duration, ctx), weight: 3 }
  );
}

/**
 * Generates a sequence of time events with total duration equal to the given value.
 */
export function genTimeSegment(totalDuration: IRational, ctx: ABCContext): fc.Arbitrary<SystemAst> {
  return genSubdivisions(totalDuration).chain((durations) => {
    const eventArbitraries = durations.map((d) => genTimeEvent(d, ctx));
    return fc.tuple(...eventArbitraries).map((events) => events);
  });
}

/**
 * Generates a non-time expression (annotation, decoration, or grace group).
 */
export function genNonTimeExpr(ctx: ABCContext): fc.Arbitrary<Expr> {
  const genAnnotation = fc
    .stringMatching(/^"[<>^_@][a-zA-Z0-9 ]{1,10}"$/)
    .map((text) => new Annotation(ctx.generateId(), new Token(TT.ANNOTATION, text, ctx.generateId())));

  const genDecoration = fc
    .constantFrom(".", "~", "H", "L", "M", "O", "P", "S", "T", "u", "v")
    .map((deco) => new Decoration(ctx.generateId(), new Token(TT.DECORATION, deco, ctx.generateId())));

  const genGraceGroup = genPitch(ctx).map((pitch) => {
    const note = new Note(ctx.generateId(), pitch, undefined, undefined);
    return new Grace_group(ctx.generateId(), [note], false);
  });

  return fc.oneof({ arbitrary: genAnnotation, weight: 2 }, { arbitrary: genDecoration, weight: 5 }, { arbitrary: genGraceGroup, weight: 2 });
}

/**
 * Intersperses non-time expressions into a sequence of time events.
 * At each position, there is a ~20% chance to insert a non-time expression.
 * We use fc.oneof with weighted options: 80% chance of undefined (no insert), 20% chance of an expression.
 */
export function intersperse(content: SystemAst, ctx: ABCContext): fc.Arbitrary<SystemAst> {
  if (content.length === 0) {
    return fc.constant([]);
  }

  // Generate optional non-time expressions for each gap (including before first and after last).
  // Use weighted oneof: 80% undefined, 20% actual expression
  const maybeInsert = fc.oneof({ arbitrary: fc.constant(undefined), weight: 4 }, { arbitrary: genNonTimeExpr(ctx), weight: 1 });

  return fc
    .array(maybeInsert, {
      minLength: content.length + 1,
      maxLength: content.length + 1,
    })
    .map((optionalInserts) => {
      const result: SystemAst = [];
      for (let i = 0; i <= content.length; i++) {
        if (optionalInserts[i] !== undefined) {
          result.push(optionalInserts[i] as Expr);
        }
        if (i < content.length) {
          result.push(content[i]);
        }
      }
      return result;
    });
}

/**
 * Formats a SystemAst array to an ABC string using the AbcFormatter.
 */
function formatSystemAst(system: SystemAst, ctx: ABCContext): string {
  const fmt = new AbcFormatter(ctx);
  return system
    .map((node) => {
      if (isToken(node)) {
        return node.lexeme;
      }
      return fmt.stringify(node, true);
    })
    .join("");
}

/**
 * Builds an ABC string from before and after parts for all voices.
 */
export function buildAbcString(beforeParts: SystemAst[], afterParts: SystemAst[], numVoices: number, ctx: ABCContext): string {
  let result = "X:1\nM:4/4\nL:1/4\nK:C\n";

  // Declare voices if multi-voice
  if (numVoices > 1) {
    for (let v = 0; v < numVoices; v++) {
      result += `V:v${v + 1}\n`;
    }
  }

  // Output each voice line
  for (let v = 0; v < numVoices; v++) {
    // Add voice marker if multi-voice
    if (numVoices > 1) {
      result += `[V:v${v + 1}]`;
    }

    // Format before content
    result += formatSystemAst(beforeParts[v], ctx);

    // Format after content
    result += formatSystemAst(afterParts[v], ctx);

    // Add barline and newline
    result += "|\n";
  }

  return result;
}

/**
 * Calculates the duration of a time event node.
 * Returns the rhythm value if present, otherwise returns 1/1 (default note length).
 */
function calculateDuration(node: Expr): IRational {
  if (node instanceof Note) {
    return rhythmToDuration(node.rhythm);
  }
  if (node instanceof Rest) {
    return rhythmToDuration(node.rhythm);
  }
  if (node instanceof Chord) {
    return rhythmToDuration(node.rhythm);
  }
  return createRational(0, 1);
}

function rhythmToDuration(rhythm: Rhythm | undefined): IRational {
  if (!rhythm) {
    return createRational(1, 1);
  }

  let numerator = 1;
  let denominator = 1;

  if (rhythm.numerator) {
    numerator = parseInt(rhythm.numerator.lexeme, 10);
  }

  if (rhythm.separator) {
    const slashCount = rhythm.separator.lexeme.length;
    if (rhythm.denominator) {
      denominator = parseInt(rhythm.denominator.lexeme, 10);
    } else {
      denominator = Math.pow(2, slashCount);
    }
  }

  return createRational(numerator, denominator);
}

/**
 * Checks if a node is a time event (note, rest, or chord).
 */
function isTimeEvent(node: Expr | Token): boolean {
  return node instanceof Note || node instanceof Rest || node instanceof Chord;
}

/**
 * Finds the split position in a parsed system AST by time.
 * Returns the position of the first time event at or after the beforeDuration.
 * Uses RangeVisitor to extract the actual source position from the parsed AST node.
 */
export function findSplitPositionByTime(parsedSystem: SystemAst, beforeDuration: IRational): Position | null {
  let currentTime = createRational(0, 1);
  const rangeVisitor = new RangeVisitor();

  for (const node of parsedSystem) {
    if (isToken(node) && node.type === TT.EOL) {
      break;
    }

    if (!isToken(node) && isTimeEvent(node)) {
      if (compareRational(currentTime, beforeDuration) >= 0) {
        // Use RangeVisitor to get the actual position of this node
        const range = node.accept(rangeVisitor);
        return { line: range.start.line, character: range.start.character };
      }
      currentTime = addRational(currentTime, calculateDuration(node));
    }
  }

  return null;
}

/**
 * Main generator for split test cases.
 * Generates test cases with known before and after parts, so we can verify
 * the conservation property.
 */
export function genSplitTestCase(): fc.Arbitrary<SplitTestCase> {
  const ctx = new ABCContext(new AbcErrorReporter());

  return fc
    .record({
      beforeDuration: genDuration(),
      afterDuration: genDuration(),
      numVoices: fc.integer({ min: 1, max: 4 }),
    })
    .chain((params) => {
      // Generate voice segments: [beforeContent, afterContent] per voice
      return fc
        .array(fc.tuple(genTimeSegment(params.beforeDuration, ctx), genTimeSegment(params.afterDuration, ctx)), {
          minLength: params.numVoices,
          maxLength: params.numVoices,
        })
        .chain((voiceSegments) => {
          // Intersperse each segment with non-time expressions
          const intersperseArbitraries = voiceSegments.map(([before, after]) => fc.tuple(intersperse(before, ctx), intersperse(after, ctx)));

          return fc.tuple(...intersperseArbitraries).map((interspersedSegments) => {
            const beforeParts: SystemAst[] = [];
            const afterParts: SystemAst[] = [];

            for (const [beforeContent, afterContent] of interspersedSegments) {
              beforeParts.push(beforeContent);
              // Don't add EOL token here - buildAbcString adds the barline and newline
              afterParts.push(afterContent);
            }

            const abcString = buildAbcString(beforeParts, afterParts, params.numVoices, ctx);

            return {
              beforeParts,
              afterParts,
              numVoices: params.numVoices,
              beforeDuration: params.beforeDuration,
              abcString,
            };
          });
        });
    });
}
