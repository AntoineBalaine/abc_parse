# Type Discrepancies Between Our Types and abcjs

This document tracks the differences between our idealized type definitions in `abcjs-ast.ts` and abcjs's actual runtime data structures.

## Overview

Our parser uses rational numbers (`IRational`) and strongly-typed structures, while abcjs uses floating-point numbers and more flexible JavaScript objects. This document catalogs these differences and the converters we use to bridge them.

## Known Type Discrepancies

### 1. Duration / Note Length

**Our format:**
```typescript
interface IRational {
  numerator: number;
  denominator: number;
}
```

**abcjs format:**
```typescript
type AbcjsRawDuration = number; // float, e.g., 0.125 for 1/8 note
```

**Converter functions:**
- `floatToRational(n: number): IRational` - Convert float to rational
- `rationalToFloat(r: IRational): number` - Convert rational to float
- `durationsEqual(a, b): boolean` - Compare with tolerance

**Tolerance:** `1e-10` for floating point comparison

**Common values:**
- `1.0` = whole note = `{numerator: 1, denominator: 1}`
- `0.5` = half note = `{numerator: 1, denominator: 2}`
- `0.25` = quarter note = `{numerator: 1, denominator: 4}`
- `0.125` = eighth note = `{numerator: 1, denominator: 8}`
- `0.0625` = sixteenth note = `{numerator: 1, denominator: 16}`
- `0.75` = dotted half = `{numerator: 3, denominator: 4}`
- `0.375` = dotted quarter = `{numerator: 3, denominator: 8}`

**Notes:**
- Floating point precision can cause minor differences
- We use GCD-based simplification for general fractions
- Comparison requires tolerance-based equality

---

### 2. Meter Value

**Our format:**
```typescript
interface Meter {
  type: 'specified' | 'common_time' | ...;
  value?: IRational[];
}
```

**abcjs format:**
```typescript
interface AbcjsRawMeter {
  type: 'specified' | 'common_time' | ...;
  value?: AbcjsRawMeterValue[];
}

interface AbcjsRawMeterValue {
  num: string;    // e.g., "4"
  den?: string;   // e.g., "4"
}
```

**Converter functions:**
- `convertAbcjsMeterValue(abcjsValue): IRational` - Convert meter value to rational
- `convertAbcjsMeter(abcjsMeter): Meter` - Convert full meter object
- `convertMeterToAbcjs(meter): AbcjsRawMeter` - Convert to abcjs format

**Examples:**
- 4/4 time: `{num: "4", den: "4"}` → `{numerator: 4, denominator: 4}`
- 6/8 time: `{num: "6", den: "8"}` → `{numerator: 6, denominator: 8}`
- C time: `{type: 'common_time'}` → `{type: 'common_time'}`

**Notes:**
- abcjs uses strings for meter components (historical reasons?)
- Conversion requires parseInt
- Both formats support special meter types (common_time, cut_time, etc.)

---

### 3. MetaText Fields

**Our format:**
```typescript
interface MetaText {
  title?: string | TextFieldProperties[];
  composer?: string | TextFieldProperties[];
  // ... other fields
}
```

**abcjs format:**
```typescript
interface AbcjsRawMetaText {
  title?: string | any[];  // Can be array of objects
  composer?: string | any[];
  // ... other fields
}
```

**Converter functions:**
- `convertAbcjsMetaText(abcjsMetaText): MetaText` - Convert metaText
- `convertMetaTextToAbcjs(metaText): AbcjsRawMetaText` - Convert to abcjs

**Notes:**
- Some fields can be string or array
- Array format contains rich text with formatting
- For comparison, we normalize arrays to strings

---

## Conversion Strategy

### General Principles

1. **Never modify `abcjs-ast.ts`** - Keep our idealized types clean
2. **Define `AbcjsRaw*` types in `abcjs-wrapper.ts`** - Match abcjs exactly
3. **Create bidirectional converters** - Support both directions
4. **Use tolerance for comparisons** - Account for floating point precision
5. **Document everything** - This file is the source of truth

### Converter Location

All type converters live in `type-converters.ts`:
- Individual field converters (e.g., `floatToRational`)
- Object converters (e.g., `convertAbcjsMeter`)
- Full tune converters (e.g., `abcjsToOurFormat`)

### Comparison Strategy

When comparing outputs:
1. Convert both formats to normalized structure
2. Apply tolerance-based equality for numbers
3. Normalize arrays/strings for text fields
4. Flag type mismatches as `'type-mismatch'` severity
5. Allow minor differences (within tolerance)

---

## TODO: Discover More Discrepancies

As we test more features, we'll discover additional type differences:

- [ ] Tempo structure (Q: info line)
- [ ] Chord representations
- [ ] Decoration structures
- [ ] Beam grouping
- [ ] Tuplet ratios
- [ ] Grace note timings
- [ ] Key signature representation
- [ ] Clef properties

**Process for adding new discrepancies:**
1. Run test with abcjs
2. Log actual output structure
3. Document difference here
4. Add `AbcjsRaw*` type to wrapper
5. Create converter functions
6. Update comparison utilities
7. Add test cases

---

## References

- Our types: `src/types/abcjs-ast.ts`
- abcjs raw types: `src/tests/interpreter-comparison/abcjs-wrapper.ts`
- Converters: `src/tests/interpreter-comparison/type-converters.ts`
- Comparison: `src/tests/interpreter-comparison/comparison-utils.ts`
