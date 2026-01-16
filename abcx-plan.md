# ABCx Implementation Plan

ABCx is a simplified subset of ABC notation for chord sheet transcriptions.

## Overview

ABCx files follow ABC structure (tune header + tune body) but the body contains only:
- Chord symbols (new expression type)
- Bar lines (all types)
- Annotations
- Comments
- Multi-measure rests

All tunes are single-voice.

## Configuration Choices

- Chord syntax: Full (Cmaj7#11, Bb/D, Am7b5)
- Header fields: X, T, P, K, M, L, Q, C
- Defaults: 4/4 meter, 1/8 note length
- Inline fields: Pass through unchanged to ABC output

## Implementation Steps

### Phase 1: Scanner

Location: `parse/parsers/`

1. Create `scan_abcx_tunebody.ts` with chord symbol scanner
   - Chord symbol pattern: `[A-G][#b]?(m|maj|min|dim|aug|sus|add)?[0-9]*(#|b)?[0-9]*(/[A-G][#b]?)?`
   - Reuse bar line scanning from `scan_tunebody.ts`
   - Reuse annotation, comment, multi-measure rest scanning

2. Add new token type to `scan2.ts`:
   - `TT.CHORD_SYMBOL` for chord symbols

3. Create `ScannerAbcx()` function that:
   - Reuses header scanning
   - Switches to ABCx body scanner for tune body

### Phase 2: Parser

Location: `parse/parsers/`

1. Add `ChordSymbol` expression to `Expr2.ts`:
   ```
   class ChordSymbol extends Expr
     token: Token
   ```

2. Add visitor method to `Visitor` interface:
   - `visitChordSymbolExpr(expr: ChordSymbol): R`

3. Create `parse_abcx.ts` with:
   - `parseChordSymbol()` function
   - `parseAbcxMusicCode()` that handles chord symbols + bars + annotations + rests
   - Reuse `parseTuneHeader()` from `parse2.ts`

### Phase 3: Formatter (ABCx to ABCx)

Location: `parse/Visitors/`

1. Update `Formatter2.ts` to handle `ChordSymbol`:
   - `visitChordSymbolExpr()` returns the chord symbol text

2. This enables roundtrip testing for ABCx files

### Phase 4: ABCx to ABC Converter

Location: `parse/Visitors/`

1. Create `AbcxToAbcConverter.ts` visitor:
   - Converts chord symbols to quoted annotations + invisible rests
   - Calculates rest durations based on chords per bar

2. Rest duration algorithm:
   ```
   bar_length = meter_numerator / note_length_denominator
   rest_per_chord = bar_length / num_chords_in_bar

   Example: 4/4 meter, 1/8 note length
   bar_length = 4 / (1/8) = 32 eighth notes
   2 chords → each gets x16 (2 whole notes worth)
   4 chords → each gets x8 (1 whole note worth)
   ```

3. Output format for each chord symbol:
   ```
   "Bm"x8   (annotation + invisible rest)
   ```

### Phase 5: Language Server

Location: `abc-lsp-server/src/`

1. Register `.abcx` file extension in server capabilities

2. Update `server_helpers.ts`:
   - Add `TT.CHORD_SYMBOL` → semantic token mapping
   - Use a distinct token type (possibly `type` or create custom)

3. Create `AbcxDocument.ts` (or extend AbcDocument):
   - Use ABCx scanner instead of ABC scanner

4. Update `AbcLspServer.ts`:
   - Detect file type by extension
   - Route to appropriate scanner/parser

### Phase 6: CLI Command

Location: `abc-cli/commands/`

1. Create `abcx2abc.ts` command:
   ```
   abcls abcx2abc <input.abcx> [-o output.abc]
   ```
   - Parse ABCx file
   - Convert using AbcxToAbcConverter
   - Output ABC text

2. Register command in `abcls-cli.ts`

### Phase 7: Testing

Location: `parse/tests/`

1. Scanner tests (`scn_abcx.spec.ts`):
   - Chord symbol tokenization
   - Mixed content (chords + bars + annotations)

2. Parser tests (`prs_abcx.spec.ts`):
   - ChordSymbol expression parsing
   - Full ABCx tune parsing

3. Converter tests (`abcx2abc.spec.ts`):
   - Rest duration calculations
   - Full conversion examples

4. Property-based tests:
   - `scn_abcx_pbt.spec.ts` - chord symbol generator
   - `abcx2abc_pbt.spec.ts` - conversion properties (element count, bar count preservation)

## Files to Create

```
parse/parsers/scan_abcx_tunebody.ts
parse/parsers/parse_abcx.ts
parse/Visitors/AbcxToAbcConverter.ts
parse/tests/scn_abcx.spec.ts
parse/tests/prs_abcx.spec.ts
parse/tests/abcx2abc.spec.ts
parse/tests/scn_abcx_pbt.spec.ts
parse/tests/abcx2abc_pbt.spec.ts
abc-cli/commands/abcx2abc.ts
abc-lsp-server/src/AbcxDocument.ts (optional, may extend existing)
```

## Files to Modify

```
parse/parsers/scan2.ts           (add TT.CHORD_SYMBOL)
parse/types/Expr2.ts             (add ChordSymbol, visitor method)
parse/Visitors/Formatter2.ts     (handle ChordSymbol)
abc-cli/abcls-cli.ts             (register abcx2abc command)
abc-lsp-server/src/server.ts     (register .abcx extension)
abc-lsp-server/src/server_helpers.ts (token mapping)
abc-lsp-server/src/AbcLspServer.ts   (file type routing)
```

## Verification

1. Unit tests pass: `npm run test`
2. CLI conversion works:
   ```
   echo "X:1\nT:Test\nK:C\nBm | G | A :|" > test.abcx
   abcls abcx2abc test.abcx
   ```
3. LSP provides syntax highlighting for `.abcx` files
4. Converted ABC renders correctly via `abcls render`
