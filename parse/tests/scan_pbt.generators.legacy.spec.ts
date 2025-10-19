// import fc from "fast-check";
// import { Token, TT } from "../parsers/scan2";
// import { ABCContext } from "../parsers/Context";
// import { AbcErrorReporter } from "../parsers/ErrorReporter";

// // Create a shared context for all generators
// export const sharedContext = new ABCContext(new AbcErrorReporter());

// const genVoiceWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));
// export const genVxId = fc.oneof(
//   // Numeric voice IDs
//   fc.integer({ min: 1, max: 99 }).map((n) => new Token(TT.VX_ID, n.toString(), sharedContext.generateId())),
//   // Alphabetic voice IDs
//   fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/).map((id) => new Token(TT.VX_ID, id, sharedContext.generateId())),
//   // Common voice names
//   fc
//     .constantFrom("melody", "bass", "tenor", "soprano", "alto", "drums", "T1", "B1", "S1", "A1")
//     .map((id) => new Token(TT.VX_ID, id, sharedContext.generateId()))
// );

// export const genVxPropKey = fc
//   .constantFrom(
//     "name",
//     "clef",
//     "transpose",
//     "octave",
//     "middle",
//     "m",
//     "stafflines",
//     "staffscale",
//     "instrument",
//     "merge",
//     "stems",
//     "stem",
//     "gchord",
//     "space",
//     "spc",
//     "bracket",
//     "brk",
//     "brace",
//     "brc"
//   )
//   .map((key) => new Token(TT.VX_K, key, sharedContext.generateId()));

// export const genVxPropVal = fc.oneof(
//   // Quoted strings
//   fc
//     .string({ minLength: 1, maxLength: 20 })
//     .filter((s) => !s.includes('"') && !s.includes("\n"))
//     .map((s) => new Token(TT.VX_V, `"${s}"`, sharedContext.generateId())),
//   // Unquoted strings
//   fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/).map((s) => new Token(TT.VX_V, s, sharedContext.generateId())),
//   // Numbers
//   fc.integer({ min: -12, max: 12 }).map((n) => new Token(TT.VX_V, n.toString(), sharedContext.generateId())),
//   // Decimal numbers
//   fc.float({ min: Math.fround(0.1), max: 5.0, noNaN: true }).map((n) => new Token(TT.VX_V, n.toFixed(1), sharedContext.generateId())),
//   // Boolean-like values
//   fc.constantFrom("true", "false", "1", "0").map((b) => new Token(TT.VX_V, b, sharedContext.generateId())),
//   // Clef values
//   fc.constantFrom("treble", "bass", "alto", "tenor", "perc", "none").map((clef) => new Token(TT.VX_V, clef, sharedContext.generateId())),
//   // Stem directions
//   fc.constantFrom("up", "down", "auto", "none").map((stem) => new Token(TT.VX_V, stem, sharedContext.generateId()))
// );
// // Property pair generator (key=value)
// export const genVxKV = fc
//   .tuple(
//     genVxPropKey,
//     fc.option(genVoiceWhitespace),
//     fc.constantFrom("=").map((eq) => new Token(TT.EQL, eq, sharedContext.generateId())),
//     fc.option(genVoiceWhitespace),
//     genVxPropVal
//   )
//   .map(([key, ws1, equals, ws2, value]) => {
//     const tokens = [key];
//     if (ws1) tokens.push(ws1);
//     tokens.push(equals);
//     if (ws2) tokens.push(ws2);
//     tokens.push(value);
//     return tokens;
//   });
// // Special perc property (standalone)
// const genVxPercuProp = fc
//   .constantFrom("perc")
//   .map((perc) => new Token(TT.VX_V, perc, sharedContext.generateId()))
//   .map((perc) => [perc]);

// // Complete voice definition generator (simplified for integration tests)
// export const genVxDefinition = fc
//   .tuple(
//     fc.option(genVoiceWhitespace), // leading whitespace
//     genVxId,
//     fc.array(fc.oneof(genVxKV, genVxPercuProp), { maxLength: 3 }) // Simplified, no comments
//   )
//   .map(([leadingWs, voiceId, properties]) => {
//     const tokens: Token[] = [];

//     if (leadingWs) tokens.push(leadingWs);
//     tokens.push(voiceId);

//     for (const property of properties) {
//       // Add whitespace before each property
//       tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
//       if (Array.isArray(property)) {
//         tokens.push(...property);
//       } else {
//         tokens.push(property);
//       }
//     }

//     return tokens;
//   });

// const genTempoText = fc
//   .string({ minLength: 0, maxLength: 20 })
//   .filter((s) => !s.includes('"') && !s.includes("\n"))
//   .map((s) => new Token(TT.TEMPO_TEXT, `"${s}"`, sharedContext.generateId()));

// const genBPMInt = fc.integer({ min: 30, max: 400 }).map((bpm) => new Token(TT.TEMPO_BPM, bpm.toString(), sharedContext.generateId()));

// const genTempoNoteNum = fc.integer({ min: 1, max: 16 }).map((num) => new Token(TT.NOTE_LEN_NUM, num.toString(), sharedContext.generateId()));

// const genTempoNoteDenom = fc.constantFrom(1, 2, 4, 8, 16, 32).map((denom) => new Token(TT.NOTE_LEN_DENOM, denom.toString(), sharedContext.generateId()));

// const genTempoNoteLetter = fc
//   .tuple(fc.constantFrom("A", "B", "C", "D", "E", "F", "G"), fc.integer({ min: 1, max: 9 }))
//   .map(([letter, octave]) => new Token(TT.TEMPO_NOTE_LETTER, `${letter}${octave}`, sharedContext.generateId()));

// const genRationalNote = fc
//   .tuple(genTempoNoteNum, fc.constantFrom(new Token(TT.DISCARD, "/", sharedContext.generateId())), genTempoNoteDenom)
//   .map(([num, slashToken, denom]) => {
//     return [num, slashToken, denom];
//   });

// const genTempoInfoNoteValue = fc.oneof(
//   genRationalNote,
//   genTempoNoteLetter.map((note) => [note])
// );

// const genTempoInfoNoteSequence = fc.array(genTempoInfoNoteValue, { minLength: 1, maxLength: 4 }).map((noteValues) => {
//   // Add whitespace between note values
//   const result: Token[] = [];

//   for (let i = 0; i < noteValues.length; i++) {
//     // Add the note value tokens
//     result.push(...noteValues[i]);

//     // Add whitespace separator between notes (except after the last note)
//     if (i < noteValues.length - 1) {
//       result.push(new Token(TT.WS, " ", sharedContext.generateId()));
//     }
//   }

//   return result;
// });

// const genTempoDefinition = fc.oneof(
//   // Just BPM
//   genBPMInt.map((bpm) => [bpm]),
//   // Note sequence = BPM
//   fc.tuple(genTempoInfoNoteSequence, genBPMInt).map(([notes, bpm]) => [...notes, new Token(TT.DISCARD, "=", sharedContext.generateId()), bpm])
// );

// export const genTempoLine = fc
//   .tuple(fc.option(genTempoText), fc.option(genTempoDefinition), fc.option(genTempoText))
//   .filter(([text1, tempoDef, text2]) => !!(text1 || tempoDef || text2)) // At least one component
//   .map(([text1, tempoDef, text2]) => {
//     const tokens: Token[] = [];

//     if (text1) {
//       tokens.push(text1);
//       if (tempoDef || text2) tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
//     }

//     if (tempoDef) {
//       tokens.push(...tempoDef);
//       if (text2) tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
//     }

//     if (text2) {
//       tokens.push(text2);
//       // Removed the trailing space after the last text element
//     }

//     return tokens;
//   });

// // Note length component generators
// const genNoteLenNum = fc.integer({ min: 1, max: 999 }).map((num) => new Token(TT.NOTE_LEN_NUM, num.toString(), sharedContext.generateId()));

// export const genNoteLenDenom = fc
//   .constantFrom(1, 2, 4, 8, 16, 32, 64, 128, 256, 512)
//   .map((denom) => new Token(TT.NOTE_LEN_DENOM, denom.toString(), sharedContext.generateId()));

// const genNoteLenWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));

// export const genMeterSeparator = fc.constantFrom(new Token(TT.METER_SEPARATOR, "/", sharedContext.generateId()));

// // Generator for complete note length signatures with optional whitespace
// export const genNoteLenSignature = fc
//   .tuple(
//     fc.option(genNoteLenWhitespace), // leading whitespace
//     genNoteLenNum,
//     fc.option(genNoteLenWhitespace), // whitespace before slash
//     genMeterSeparator,
//     fc.option(genNoteLenWhitespace), // whitespace after slash
//     genNoteLenDenom,
//     fc.option(genNoteLenWhitespace) // trailing whitespace
//   )
//   .map(([leadingWs, num, wsBeforeSlash, separator, wsAfterSlash, denom, trailingWs]) => {
//     const tokens: Token[] = [];

//     if (leadingWs) tokens.push(leadingWs);
//     tokens.push(num);
//     if (wsBeforeSlash) tokens.push(wsBeforeSlash);
//     tokens.push(separator);
//     if (wsAfterSlash) tokens.push(wsAfterSlash);
//     tokens.push(denom);
//     if (trailingWs) tokens.push(trailingWs);

//     return tokens;
//   });

// const genKeyNone = fc.constantFrom("none", "NONE", "None").map((none) => new Token(TT.KEY_NONE, none, sharedContext.generateId()));

// export const genKeyRoot = fc.constantFrom("A", "B", "C", "D", "E", "F", "G").map((root) => new Token(TT.KEY_ROOT, root, sharedContext.generateId()));

// export const genKeyAccidental = fc.constantFrom("#", "b").map((acc) => new Token(TT.KEY_ACCIDENTAL, acc, sharedContext.generateId()));

// const genKeyMode = fc
//   .constantFrom(
//     "major",
//     "minor",
//     "maj",
//     "min",
//     "m",
//     "ionian",
//     "dorian",
//     "dor",
//     "phrygian",
//     "phr",
//     "lydian",
//     "lyd",
//     "mixolydian",
//     "mix",
//     "aeolian",
//     "aeo",
//     "locrian",
//     "loc"
//   )
//   .map((mode) => new Token(TT.KEY_MODE, mode, sharedContext.generateId()));

// export const genExplicitAccidental = fc
//   .tuple(fc.constantFrom("^", "_", "="), fc.constantFrom("a", "b", "c", "d", "e", "f", "g", "A", "B", "C", "D", "E", "F", "G"))
//   .map(([accSymbol, note]) => new Token(TT.KEY_EXPLICIT_ACC, accSymbol + note, sharedContext.generateId()));

// export const genKeySignature = fc.oneof(
//   // "none" key signature with optional leading/trailing whitespace
//   fc.tuple(fc.option(genWhitespace), genKeyNone, fc.option(genWhitespace)).map(([leadingWs, none, trailingWs]) => {
//     const tokens: Token[] = [];
//     if (leadingWs) tokens.push(leadingWs);
//     tokens.push(none);
//     if (trailingWs) tokens.push(trailingWs);
//     return tokens;
//   }),

//   // Regular key signatures: root [ws] [accidental] [ws] [mode] [ws] [explicit accidentals]
//   fc
//     .tuple(
//       fc.option(genWhitespace), // leading whitespace
//       genKeyRoot,
//       fc.option(genKeyAccidental),
//       fc.option(genKeyMode),
//       fc.array(genExplicitAccidental, { maxLength: 5 }),
//       fc.option(genWhitespace) // trailing whitespace
//     )
//     .map(([leadingWs, root, accidental, mode, explicitAccs, trailingWs]) => {
//       const tokens: Token[] = [];

//       if (leadingWs) tokens.push(leadingWs);
//       tokens.push(root);

//       if (accidental) {
//         // Optional whitespace before accidental
//         if (fc.sample(fc.boolean(), 1)[0]) {
//           tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
//         }
//         tokens.push(accidental);
//       }

//       if (mode) {
//         // Always add whitespace before mode if we have one
//         tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
//         tokens.push(mode);
//       }

//       if (explicitAccs.length > 0) {
//         // Optional whitespace before explicit accidentals
//         if (fc.sample(fc.boolean(), 1)[0]) {
//           tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
//         }
//         tokens.push(...explicitAccs);
//       }

//       if (trailingWs) tokens.push(trailingWs);
//       return tokens;
//     })
// );
