import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
  Grace_group,
  Inline_field,
  Macro_decl,
  Macro_invocation,
  MultiMeasureRest,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tuplet,
  YSPACER,
} from "../types/Expr2";
import * as ScannerGen from "./scn_pbt.generators.spec";

// Create a shared context for all generators
export const sharedContext = new ABCContext(new AbcErrorReporter());

// Helper function to build a rhythm expression from tokens
const buildRhythmExpr = (tokens: Token[] | undefined): Rhythm | undefined => {
  if (!tokens || tokens.length === 0) {
    return undefined;
  }

  let numerator = null;
  let separator = undefined;
  let denominator = null;
  let broken = null;

  for (const token of tokens) {
    if (token.type === TT.RHY_NUMER) numerator = token;
    else if (token.type === TT.RHY_SEP) separator = token;
    else if (token.type === TT.RHY_DENOM) denominator = token;
    else if (token.type === TT.RHY_BRKN) broken = token;
  }

  return new Rhythm(sharedContext.generateId(), numerator, separator, denominator, broken);
};

// Helper function to build a pitch expression from tokens
const buildPitchExpr = (tokens: Token[]): Pitch => {
  return new Pitch(sharedContext.generateId(), {
    alteration: tokens.find((t) => t.type === TT.ACCIDENTAL),
    noteLetter: tokens.find((t) => t.type === TT.NOTE_LETTER)!,
    octave: tokens.find((t) => t.type === TT.OCTAVE),
  });
};

// Expression generators that use token generators
export const genPitchExpr = fc
  .tuple(fc.option(ScannerGen.genAccidental), ScannerGen.genNoteLetter, fc.option(ScannerGen.genOctave))
  .map(([acc, note, oct]) => {
    const tokens = [];
    if (acc) tokens.push(acc);
    tokens.push(note);
    if (oct) tokens.push(oct);

    const alteration = acc ?? undefined;
    const noteLetter = note;
    const octave = oct ?? undefined;

    return {
      tokens,
      expr: new Pitch(sharedContext.generateId(), { alteration, noteLetter, octave }),
    };
  });

export const genNoteExpr = fc
  .tuple(ScannerGen.genPitch, fc.option(ScannerGen.genRhythm), fc.option(ScannerGen.genTie))
  .map(([pitchTokens, rhythmTokens, tie]) => {
    const tokens = [...pitchTokens];
    if (rhythmTokens) tokens.push(...rhythmTokens);
    if (tie) tokens.push(tie);

    // Create the pitch expression
    const pitchExpr = buildPitchExpr(pitchTokens);

    // Create the rhythm expression if we have rhythm tokens
    const rhythmExpr = buildRhythmExpr(rhythmTokens ?? undefined);

    return {
      tokens,
      expr: new Note(sharedContext.generateId(), pitchExpr, rhythmExpr, tie ?? undefined),
    };
  });

export const genRestExpr = fc.tuple(ScannerGen.genRest, fc.option(ScannerGen.genRhythm)).map(([rest, rhythmTokens]) => {
  const tokens = [rest];
  if (rhythmTokens) tokens.push(...rhythmTokens);

  // Check if this is a multi-measure rest (uppercase Z or X)
  const isMultiMeasureRest = /^[ZX]$/.test(rest.lexeme);

  if (isMultiMeasureRest) {
    // For multi-measure rests, only use the numerator as the length
    let length = undefined;
    if (rhythmTokens) {
      const numerator = rhythmTokens.find((t) => t.type === TT.RHY_NUMER);
      if (numerator) {
        length = numerator;
      }
    }

    return {
      tokens,
      expr: new MultiMeasureRest(sharedContext.generateId(), rest, length),
    };
  } else {
    // Create the rhythm expression if we have rhythm tokens
    const rhythmExpr = buildRhythmExpr(rhythmTokens ?? undefined);

    return {
      tokens,
      expr: new Rest(sharedContext.generateId(), rest, rhythmExpr),
    };
  }
});

export const genMultiMeasureRestExpr = fc
  .tuple(
    fc.constantFrom(new Token(TT.REST, "Z", sharedContext.generateId()), new Token(TT.REST, "X", sharedContext.generateId())),
    fc.option(fc.stringMatching(/^[1-9][0-9]*$/).map((n) => new Token(TT.RHY_NUMER, n, sharedContext.generateId())))
  )
  .map(([rest, length]) => {
    const tokens = [rest];
    if (length) tokens.push(length);

    return {
      tokens,
      expr: new MultiMeasureRest(sharedContext.generateId(), rest, length ?? undefined),
    };
  });

export const genChordExpr = fc
  .tuple(
    // Generate 1-4 notes for the chord
    fc.array(genNoteExpr, { minLength: 1, maxLength: 4 }),
    // Optional rhythm
    fc.option(ScannerGen.genRhythm),
    // Optional tie
    fc.option(ScannerGen.genTie)
  )
  .map(([noteExprs, rhythmTokens, tie]) => {
    // Create tokens array starting with left bracket
    const tokens = [new Token(TT.CHRD_LEFT_BRKT, "[", sharedContext.generateId())];

    // Add all note tokens
    const notes: Note[] = [];
    for (const noteExpr of noteExprs) {
      // Add the note's tokens to the token array
      tokens.push(...noteExpr.tokens);
      // Add the note to the notes array
      notes.push(noteExpr.expr);
    }

    // Add right bracket
    tokens.push(new Token(TT.CHRD_RIGHT_BRKT, "]", sharedContext.generateId()));

    // Add rhythm tokens if present
    let rhythmExpr: Rhythm | undefined = undefined;
    if (rhythmTokens) {
      tokens.push(...rhythmTokens);
      rhythmExpr = buildRhythmExpr(rhythmTokens);
    }

    // Add tie if present
    if (tie) {
      tokens.push(tie);
    }

    return {
      tokens,
      expr: new Chord(sharedContext.generateId(), notes, rhythmExpr, tie ?? undefined),
    };
  });

export const genBarLineExpr = fc
  .tuple(
    ScannerGen.genBarline,
    fc.option(
      fc.array(
        fc.stringMatching(/^[1-9][0-9]*$/).map((n) => new Token(TT.REPEAT_NUMBER, n, sharedContext.generateId())),
        {
          minLength: 1,
          maxLength: 3,
        }
      )
    )
  )
  .map(([barline, repeatNumbers]) => {
    const tokens = [barline];
    if (repeatNumbers) tokens.push(...repeatNumbers);

    return {
      tokens,
      expr: new BarLine(sharedContext.generateId(), [barline], repeatNumbers ?? undefined),
    };
  });

export const genDecorationExpr = ScannerGen.genDecoration.map((decoration) => {
  return {
    tokens: [decoration],
    expr: new Decoration(sharedContext.generateId(), decoration),
  };
});

export const genAnnotationExpr = ScannerGen.genAnnotation.map((annotation) => {
  return {
    tokens: [annotation],
    expr: new Annotation(sharedContext.generateId(), annotation),
  };
});

export const genSymbolExpr = ScannerGen.genSymbol.map((symbol) => {
  return {
    tokens: [symbol],
    expr: new Symbol(sharedContext.generateId(), symbol),
  };
});

export const genYSpacerExpr = ScannerGen.genYspacer.map((tokens) => {
  // Extract the y-spacer token
  const ySpacer = tokens.find((t) => t.type === TT.Y_SPC)!;

  // Extract rhythm tokens
  const rhythmTokens = tokens.filter((t) => t.type === TT.RHY_NUMER || t.type === TT.RHY_SEP || t.type === TT.RHY_DENOM || t.type === TT.RHY_BRKN);

  // Create the rhythm expression if we have rhythm tokens
  const rhythmExpr = buildRhythmExpr(rhythmTokens.length > 0 ? rhythmTokens : undefined);

  return {
    tokens,
    expr: new YSPACER(sharedContext.generateId(), ySpacer, rhythmExpr),
  };
});

export const genGraceGroupExpr = fc
  .tuple(
    // Generate 1-4 notes for the grace group
    fc.array(genNoteExpr, { minLength: 1, maxLength: 4 }),
    // Optional accacciatura slash
    fc.boolean()
  )
  .map(([noteExprs, hasSlash]) => {
    // Create tokens array starting with left brace
    const tokens = [new Token(TT.GRC_GRP_LEFT_BRACE, "{", sharedContext.generateId())];

    // Add slash if this is an accacciatura
    if (hasSlash) {
      tokens.push(new Token(TT.GRC_GRP_SLSH, "/", sharedContext.generateId()));
    }

    // Add all note tokens
    const notes: Note[] = [];
    for (const noteExpr of noteExprs) {
      // Add the note's tokens to the token array
      tokens.push(...noteExpr.tokens);
      // Add the note to the notes array
      notes.push(noteExpr.expr);
    }

    // Add right brace
    tokens.push(new Token(TT.GRC_GRP_RGHT_BRACE, "}", sharedContext.generateId()));

    return {
      tokens,
      expr: new Grace_group(sharedContext.generateId(), notes, hasSlash),
    };
  });

export const genTupletExpr = ScannerGen.genTuplet.map((tokens) => {
  // Extract components
  const p = tokens.find((t) => t.type === TT.TUPLET_P)!;
  const q = tokens.find((t) => t.type === TT.TUPLET_Q);
  const r = tokens.find((t) => t.type === TT.TUPLET_R);

  return {
    tokens,
    expr: new Tuplet(sharedContext.generateId(), p, q, r),
  };
});

export const genInlineFieldExpr = ScannerGen.genInlineField.map((tokens) => {
  // Extract components
  const field = tokens.find((t) => t.type === TT.INF_HDR)!;
  const text = tokens.filter((t) => t.type === TT.INFO_STR);

  return {
    tokens,
    expr: new Inline_field(sharedContext.generateId(), field, text),
  };
});

// Helper function to create a regular rest expression (not multi-measure)
export const genRegularRestExpr = fc
  .tuple(
    fc.constantFrom(new Token(TT.REST, "z", sharedContext.generateId()), new Token(TT.REST, "x", sharedContext.generateId())), // Only lowercase z and x for regular rests
    fc.option(ScannerGen.genRhythm)
  )
  .map(([rest, rhythmTokens]) => {
    const tokens = [rest];
    if (rhythmTokens) tokens.push(...rhythmTokens);

    // Create the rhythm expression if we have rhythm tokens
    const rhythmExpr = buildRhythmExpr(rhythmTokens ?? undefined);

    return {
      tokens,
      expr: new Rest(sharedContext.generateId(), rest, rhythmExpr),
    };
  });

export const genBeamExpr = fc
  .array(
    fc.oneof(
      { arbitrary: genNoteExpr, weight: 10 },
      { arbitrary: genRegularRestExpr, weight: 5 }, // Use regular rests only, not multi-measure rests
      { arbitrary: genChordExpr, weight: 5 },
      { arbitrary: genGraceGroupExpr, weight: 2 },
      { arbitrary: genDecorationExpr, weight: 2 },
      { arbitrary: genSymbolExpr, weight: 1 },
      { arbitrary: genYSpacerExpr, weight: 1 }
    ),
    { minLength: 2, maxLength: 5 }
  )
  .map((exprs) => {
    // Extract all tokens and expressions
    const tokens = exprs.flatMap((e) => e.tokens);
    const contents = exprs.map((e) => e.expr);

    return {
      tokens,
      expr: new Beam(sharedContext.generateId(), contents),
    };
  });

/** no bars */
const musicGenerators = [{ arbitrary: genNoteExpr, weight: 10 },
{ arbitrary: genRestExpr, weight: 5 },
// Removed genMultiMeasureRestExpr as multi-measure rests don't belong in a single bar
{ arbitrary: genChordExpr, weight: 5 },
{ arbitrary: genDecorationExpr, weight: 2 },
{ arbitrary: genAnnotationExpr, weight: 2 },
{ arbitrary: genSymbolExpr, weight: 1 },
{ arbitrary: genYSpacerExpr, weight: 1 },
{ arbitrary: genGraceGroupExpr, weight: 2 },
{ arbitrary: genTupletExpr, weight: 2 },
{ arbitrary: genInlineFieldExpr, weight: 1 },
{ arbitrary: genBeamExpr, weight: 3 }]
// Generate a simple music expression
export const genMusicExpr = fc.oneof(...musicGenerators,
  { arbitrary: genBarLineExpr, weight: 3 },
);

export const genMusicExpr_NoBar = fc.oneof(...musicGenerators);

// Generate a sequence of music expressions
export const genMusicSequence = fc.array(genMusicExpr, { minLength: 1, maxLength: 10 }).map((exprs) => {
  return {
    tokens: exprs.flatMap((e) => e.tokens),
    exprs: exprs.map((e) => e.expr),
  };
});

export const genMusicSequence_NoBar = fc.array(genMusicExpr_NoBar, { minLength: 1, maxLength: 10 }).map((exprs) => {
  return {
    tokens: exprs.flatMap((e) => e.tokens),
    exprs: exprs.map((e) => e.expr),
  };
});

// Macro expression generators
export const genMacroDeclExpr = ScannerGen.genMacroDecl
  .map(([eol1, header, ws1, variable, ws2, macroStr, comment, eol2]) => {
    const tokens = [eol1, header];
    if (ws1) tokens.push(ws1);
    tokens.push(variable);
    if (ws2) tokens.push(ws2);
    tokens.push(macroStr);
    if (comment) tokens.push(comment);
    tokens.push(eol2);

    const expr = new Macro_decl(sharedContext.generateId(), header, variable, macroStr);
    return { tokens, expr };
  });

export const genMacroInvocationExpr = (variableName: string) =>
  fc.constantFrom(new Token(TT.MACRO_INVOCATION, variableName, sharedContext.generateId()))
    .map((invocation) => {
      return {
        tokens: [invocation],
        expr: new Macro_invocation(sharedContext.generateId(), invocation)
      };
    });


export const genMacroScenario = genMacroDeclExpr.chain(macro_decl => {
  const invocation = genMacroInvocationExpr(macro_decl.expr.variable.lexeme);
  const tune_body_gen = fc.array(
    fc.oneof(
      ...musicGenerators,
      { arbitrary: invocation, weight: 3 }
    ),
    { minLength: 1, maxLength: 5 }
  );

  return tune_body_gen.map(musicExprs => {
    const allTokens = [
      ...macro_decl.tokens,
      ...musicExprs.flatMap(e => e.tokens)
    ];

    const allExprs = [
      macro_decl.expr,
      ...musicExprs.map(e => e.expr)
    ];

    return {
      tokens: allTokens,
      exprs: allExprs
    };
  });
});
// Parser expression generators for tune header elements
// Comment expression generator

export const genCommentExpr = ScannerGen.genCommentToken.map(([comment, eol]) => {
  return new Comment(sharedContext.generateId(), comment);
});

