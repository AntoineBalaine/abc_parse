# ABCx Testing Plan - Redesigned

## Table of Contents

1. [Overview](#overview)
2. [What is NEW in ABCx](#what-is-new-in-abcx)
3. [Key Principles](#key-principles)
4. [Part 1: Scanner Tests](#part-1-scanner-tests)
5. [Part 2: Parser Tests](#part-2-parser-tests)
6. [Part 3: Rest Calculation Tests](#part-3-rest-calculation-tests)
7. [Part 4: ABCx to ABC Conversion Tests](#part-4-abcx-to-abc-conversion-tests)
8. [Files to Create/Modify/Delete](#files-to-createmodifydelete)
9. [Verification](#verification)

---

## Overview

This plan focuses on testing ABCx-specific functionality following the established patterns in the codebase.

## What is NEW in ABCx

Scanner: ONE new token type
- `TT.CHORD_SYMBOL` - chord symbols like `C`, `Am7`, `Dm7b5`, `G/B`

Parser: ONE new expression type
- `ChordSymbol` - AST node for chord symbols

Everything else (barlines, annotations, comments, rests, inline fields) uses existing infrastructure.

---

## Key Principles (from PR review)

1. **REUSE existing generators** - import from `scn_pbt.generators.spec.ts` and `prs_pbt.generators.spec.ts`, do NOT duplicate
2. **Test ONLY new expressions** - ChordSymbol only, not barlines or other pre-existing expressions
3. **Follow existing PBT patterns EXACTLY** - look at `scn_pbt.spec.ts` and `prs_pbt.spec.ts` for structure
4. **ALL round-trip and integration tests must be property-based** - no example-based tests for these
5. **Do NOT add default M/L fields** - leave them implied, composer's choice
6. **Test preservation across conversion boundary** - verify chord symbols preserved with correct calculated lengths

---

## Part 1: Scanner Tests

### 1.1 Example-based (scn_abcx.spec.ts) - Minimal

Only test CHORD_SYMBOL token - the ONE new token:

```
describe("ABCx Scanner - ChordSymbol Token")
  - "C" -> CHORD_SYMBOL with lexeme "C"
  - "Am7" -> CHORD_SYMBOL with lexeme "Am7"
  - "Dm7b5" -> CHORD_SYMBOL with lexeme "Dm7b5"
  - "G/B" -> CHORD_SYMBOL with lexeme "G/B"
  - "Cmaj7#11" -> CHORD_SYMBOL with lexeme "Cmaj7#11"
```

### 1.2 Generator (add to scn_pbt.generators.spec.ts)

Add ONE new generator to existing file:

```typescript
// In scn_pbt.generators.spec.ts - ADD this generator
export const genChordSymbolToken = fc.stringMatching(pChordSymbol)
  .map(chord => new Token(TT.CHORD_SYMBOL, chord, sharedContext.generateId()));
```

### 1.3 ABCx Tune Body Generator (scn_abcx.generators.spec.ts)

Compose ABCx-specific sequences using EXISTING generators:

```typescript
import { genBarline, genAnnotation, genRest, genInlineField, genComment, genWhitespace, genEOL, ... } from "./scn_pbt.generators.spec";

// ABCx tune body token generator - composes existing generators + new chord symbol
export const genAbcxTuneBodyTokens = fc.array(
  fc.oneof(
    genChordSymbolToken,
    genBarline.map(b => [b]),
    genAnnotation.map(a => [a]),
    genRest.map(r => [r]),
    // ... other EXISTING generators
  )
).map(arrays => arrays.flat());

// ABCx file generator
export const genAbcxFileTokens = ...
```

### 1.4 Property-based Tests (scn_abcx.pbt.spec.ts)

Following scn_pbt.spec.ts pattern EXACTLY:

```typescript
describe("ABCx Scanner Property Tests")

  // Use createRoundTripPredicate from scn_pbt.spec.ts
  it("should produce equivalent tokens when rescanning concatenated lexemes")
    - fc.assert(fc.property(genAbcxTokenSequence, createRoundTripPredicate), { numRuns: 10000 })

  it("should preserve structural integrity")
  it("should maintain token position integrity")
  it("should properly identify tune sections")
  it("should never crash on valid input")
```

---

## Part 2: Parser Tests

### 2.1 Example-based (prs_abcx.spec.ts) - Minimal

Only test ChordSymbol expression - the ONE new expression:

```
describe("ABCx Parser - ChordSymbol Expression")
  - Token CHORD_SYMBOL "C" -> ChordSymbol node
  - Token CHORD_SYMBOL "Am7" -> ChordSymbol node
```

### 2.2 Generator (add to prs_pbt.generators.spec.ts)

Add ONE new generator to existing file:

```typescript
// In prs_pbt.generators.spec.ts - ADD this generator
export const genChordSymbolExpr = genChordSymbolToken.map(token => ({
  tokens: [token],
  expr: new ChordSymbol(sharedContext.generateId(), token)
}));
```

### 2.3 ABCx Music Sequence Generator (prs_abcx.generators.spec.ts)

Compose using EXISTING generators:

```typescript
import { genBarLineExpr, genAnnotationExpr, genRestExpr, ... } from "./prs_pbt.generators.spec";

// ABCx music sequence - composes existing generators + new chord symbol
export const genAbcxMusicSequence = fc.array(
  fc.oneof(
    { arbitrary: genChordSymbolExpr, weight: 10 },  // NEW - weighted higher
    { arbitrary: genBarLineExpr, weight: 3 },
    { arbitrary: genAnnotationExpr, weight: 2 },
    { arbitrary: genRestExpr, weight: 2 },
    // ... other EXISTING generators
  )
).map(exprs => ({
  tokens: exprs.flatMap(e => e.tokens),
  exprs: exprs.map(e => e.expr)
}));
```

### 2.4 Property-based Tests (prs_abcx.pbt.spec.ts)

Following prs_pbt.spec.ts pattern EXACTLY:

```typescript
describe("ABCx Parser Property Tests")

  it("should never crash on valid input")

  // Round-trip: generate -> parse -> format -> compare
  it("should correctly round-trip ChordSymbol expressions")
    - fc.assert(fc.property(genChordSymbolExpr, ...))

  it("should correctly round-trip ABCx music sequences")
    - fc.assert(fc.property(genAbcxMusicSequence, ...))
```

---

## Part 3: Rest Calculation Tests

Location: `parse/tests/rest_calculation.spec.ts`

Keep as example-based - these test specific calculation logic, not parsing:

```typescript
/**
 * Rest Duration Calculation Tests (ABCx-specific)
 * Tests calculateRestLength used by AbcxToAbcConverter
 */
describe("Rest Duration Calculation")
  - 4/4 meter, 1 chord/bar -> X (full bar)
  - 4/4 meter, L:1/8, 2 chords/bar -> x4 each
  - 3/4 meter, L:1/4, 1 chord/bar -> X
  - 6/8 meter, L:1/8, 2 chords/bar -> x3 each
  // etc.
```

---

## Part 4: ABCx to ABC Conversion Tests

Location: `parse/tests/abcx2abc.spec.ts`

### 4.1 Property-based Conversion Tests (REQUIRED)

Test preservation across conversion boundary:

```typescript
describe("ABCx to ABC Conversion - Property Tests")

  it("property: all chord symbols are preserved as annotations")
    - Generate ABCx with N chord symbols
    - Convert to ABC AST
    - Verify N annotations with "^ChordName" format

  it("property: all chord symbols have corresponding rests with correct lengths")
    - Generate ABCx with chords
    - Convert to ABC AST
    - Verify each chord becomes Annotation + Rest
    - Verify rest lengths are correct for meter/chords-per-bar

  it("property: barline count is preserved")

  it("property: structure is preserved through full round-trip")
    - ABCx -> Convert -> Format -> Parse ABC -> verify structure
```

### 4.2 Do NOT Add Default M/L

Remove any code that adds default M: or L: fields. Leave them implied.

---

## Files to Create/Modify/Delete

### Modify (add generators)

1. `parse/tests/scn_pbt.generators.spec.ts` - add genChordSymbolToken
2. `parse/tests/prs_pbt.generators.spec.ts` - add genChordSymbolExpr

### Create

3. `parse/tests/scn_abcx.generators.spec.ts` - ABCx tune body/file token generators (imports from existing)
4. `parse/tests/prs_abcx.generators.spec.ts` - ABCx music sequence generator (imports from existing)

### Rewrite

5. `parse/tests/scn_abcx.pbt.spec.ts` - Use new generators, follow scn_pbt.spec.ts pattern exactly
6. `parse/tests/prs_abcx.pbt.spec.ts` - Use new generators, follow prs_pbt.spec.ts pattern exactly
7. `parse/tests/abcx2abc.spec.ts` - Property-based conversion tests, test AST structure

### Modify

8. `parse/tests/rest_calculation.spec.ts` - Add ABCx-specific header comment
9. `parse/Visitors/AbcxToAbcConverter.ts` - Remove default M/L field addition

### Delete

10. `parse/tests/abcx_roundtrip.spec.ts` - Merged into property-based tests
11. `parse/tests/abcx_integration.spec.ts` - Merged into property-based tests

---

## Verification

1. `npm run test` - All tests pass
2. `npx tsc --noEmit` - No TypeScript errors
3. Round-trip tests pass with high numRuns (1000+ for scanner, 2000+ for parser)
