# Interpreter Comparison Test Suite

This directory contains a comprehensive test suite for comparing the output of our ABC parser + interpreter against the abcjs library.

## Purpose

The goal is to ensure that our parser and interpreter produce output that is structurally equivalent to abcjs, accounting for type differences (e.g., floats vs rationals).

## Structure

```
interpreter-comparison/
├── README.md                                    # This file
├── TYPE_DISCREPANCIES.md                        # Documentation of type differences
├── abcjs-wrapper.ts                             # Wrapper for abcjs parser + AbcjsRaw types
├── type-converters.ts                           # Bidirectional type converters
├── comparison-utils.ts                          # Comparison logic with tolerance
├── test-helpers.ts                              # Test helper functions
├── interpreter-comparison.examples.spec.ts      # Example-based tests
├── interpreter-comparison.pbt.spec.ts           # Property-based tests (TODO)
├── interpreter-comparison.generators.ts         # Fast-check generators (TODO)
└── fixtures/                                    # ABC file fixtures
    ├── basic/                                   # Basic tunes
    ├── headers/                                 # Header field tests
    ├── directives/                              # Directive tests
    ├── musical/                                 # Musical content tests
    └── edge-cases/                              # Edge cases
```

## Key Principles

### 1. Type Purity
- **Never modify `src/types/abcjs-ast.ts`** - Our idealized types stay clean
- **Define `AbcjsRaw*` types in `abcjs-wrapper.ts`** - Match abcjs's actual output
- See `TYPE_DISCREPANCIES.md` for full documentation

### 2. Type Conversion
- All converters live in `type-converters.ts`
- Bidirectional conversion: our format ↔ abcjs format
- Use tolerance (`1e-10`) for floating point comparisons

### 3. Comparison Strategy
- Convert both formats to normalized structure
- Apply tolerance for numeric comparisons
- Allow minor differences (within tolerance)
- Flag type mismatches separately

## Running Tests

```bash
# Run all interpreter comparison tests
npm run test:interpreter

# Run only example-based tests
npm run test:interpreter:examples

# Run only property-based tests
npm run test:interpreter:pbt
```

## Implementation Status

### ✅ Completed (Phase 1)
- [x] Directory structure
- [x] AbcjsRaw types (initial set)
- [x] Type converters (duration, meter, metaText)
- [x] Comparison utilities with tolerance
- [x] Test helpers
- [x] TYPE_DISCREPANCIES.md documentation
- [x] Basic example test structure
- [x] Sample ABC fixtures

### 🚧 TODO (Phase 2+)

#### abcjs Integration
- [ ] Implement actual abcjs parser wrapper (CommonJS module loading)
- [ ] Test wrapper with simple inputs
- [ ] Discover and document additional type discrepancies

#### Type Converters
- [ ] Tempo structure converters
- [ ] Chord representation converters
- [ ] Decoration converters
- [ ] Key signature converters
- [ ] Clef property converters

#### Example Tests
- [ ] Enable abcjs comparisons (once wrapper is ready)
- [ ] Test all header fields
- [ ] Test font directives
- [ ] Test layout directives
- [ ] Test musical content (notes, rests, chords)
- [ ] Test voice/staff handling
- [ ] Test edge cases

#### Property-Based Tests
- [ ] Create generators for full tunes
- [ ] Test structural equivalence
- [ ] Test type conversion roundtrips
- [ ] Test inheritance properties

#### Fixtures
- [ ] Add more basic tune fixtures
- [ ] Add directive test fixtures
- [ ] Add musical content fixtures
- [ ] Add edge case fixtures

## Type Discrepancies

See [`TYPE_DISCREPANCIES.md`](./TYPE_DISCREPANCIES.md) for complete documentation.

Key differences:
- **Durations**: abcjs uses `number` (float), we use `IRational`
- **Meter values**: abcjs uses `{num: string, den?: string}`, we use `IRational`
- **MetaText**: abcjs can have `string | any[]`, we use `string | TextFieldProperties[]`

## Writing Tests

### Example-Based Tests

```typescript
import { parseWithYourParser, runComparison } from "./test-helpers";

it("should parse a basic tune", () => {
  const input = `X:1\nT:Test\nK:C\nCDEF|`;

  const { tunes, ctx } = parseWithYourParser(input);
  expect(tunes).to.have.length(1);

  // Compare with abcjs (once wrapper is ready)
  const result = runComparison(input);
  expect(result.matches).to.be.true;
});
```

### Property-Based Tests (TODO)

```typescript
import * as fc from "fast-check";
import { genFullTune } from "./interpreter-comparison.generators";

it("should produce equivalent output for any valid tune", () => {
  fc.assert(
    fc.property(genFullTune(), (tuneString) => {
      const result = runComparison(tuneString);
      // Allow minor differences, but no critical ones
      const critical = result.differences.filter(d => d.severity === 'critical');
      return critical.length === 0;
    })
  );
});
```

## Next Steps

1. **Implement abcjs wrapper** - Load CommonJS modules from `abcjs_parse/`
2. **Test with simple inputs** - Verify wrapper works, log actual types
3. **Expand type converters** - Add converters as new discrepancies discovered
4. **Enable comparisons** - Uncomment comparison code in example tests
5. **Add more fixtures** - Comprehensive ABC file coverage
6. **Property-based tests** - Generate and test random valid tunes

## References

- Our parser: `src/parsers/parse2.ts`
- Our interpreter: `src/interpreter/TuneInterpreter.ts`
- Our types: `src/types/abcjs-ast.ts`
- abcjs source: `abcjs_parse/`
- Fast-check docs: https://github.com/dubzzz/fast-check
