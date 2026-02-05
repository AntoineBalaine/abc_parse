# XML to ABC Conversion Implementation Plan

## Overview

This document outlines the plan for porting the Python xml2abc implementation to TypeScript for integration into our ABC parser codebase.

## Revised Porting Plan

### 1. XML Parser Selection & Integration

- Choose TypeScript XML library (fast-xml-parser, xml2js, or @xmldom/xmldom)
- ZIP library for `.mxl` files (jszip or adm-zip)
- Error handling for malformed XML delegated to parser library

### 2. Port Data Structures

- Note, Elem, Measure, Music, Parser classes
- TypeScript type definitions for all state dictionaries
- Mapping dictionaries (note_ornamentation_map, dynamics_map, etc.)

### 3. Port Core Algorithm Functions

All the processing functions:
- `doNote()` - note processing
- `doAttr()` - attributes (key, meter, clef, divisions)
- `doDirection()` - dynamics, tempo, wedges
- `doBarline()` - barlines and repeats
- `doNotations()` - ornaments, articulations, slurs
- `ntAbc()` - pitch conversion to ABC
- `abcdur()` - duration conversion
- `sortMeasure()` - time-based sorting and gap filling
- `insTup()` - tuplet processing
- `mkBroken()` - broken rhythm detection
- `outVoice()` - ABC string generation per measure
- `outVoices()` - voice output orchestration

### 4. API Design

```typescript
interface Xml2AbcOptions {
  unfoldRepeats?: boolean;           // -u
  midiOutput?: 0 | 1 | 2;           // -m
  creditFilter?: number;             // -c
  unitLength?: number;               // -d (must be power of 2)
  maxCharsPerLine?: number;          // -n (default 100)
  maxBarsPerLine?: number;           // -b
  voltaBehavior?: 0 | 1 | 2 | 3;    // -v
  noLineBreaks?: boolean;            // -x
  pageFormat?: string;               // -p
  jsCompatibility?: boolean;         // -j
  translatePercTab?: boolean;        // -t
  shiftNoteheads?: boolean;          // -s
  directionsToFirstVoice?: boolean;  // --v1
  skipPedal?: boolean;               // --noped
  translateStems?: boolean;          // --stems
}

function xml2abc(
  input: string | Buffer,  // XML string or .mxl file buffer
  options?: Xml2AbcOptions
): string;  // Returns ABC notation string
```

### 5. Module Structure

```
parse/
  xml2abc/
    index.ts              # Main entry point, exports xml2abc()
    parser.ts             # Parser class
    data-structures.ts    # Note, Elem, Measure, Music classes
    algorithms.ts         # doNote, doAttr, etc.
    output.ts             # ABCoutput class (minus file writing)
    helpers.ts            # setKey, addoct, simplify, etc.
    mappings.ts           # note_ornamentation_map, dynamics_map
    types.ts              # TypeScript interfaces
```

### 6. Property-Based Testing Strategy

#### A. MusicXML Generators (fast-check)

Because MusicXML is complex, we'll need **hierarchical generators**:

```typescript
// Simplified example structure
const genPitch = fc.record({
  step: fc.constantFrom('C', 'D', 'E', 'F', 'G', 'A', 'B'),
  octave: fc.integer({ min: 0, max: 8 }),
  alter: fc.option(fc.integer({ min: -2, max: 2 }))
});

const genNote = fc.record({
  pitch: genPitch,
  duration: fc.integer({ min: 1, max: 1920 }), // in divisions
  voice: fc.integer({ min: 1, max: 4 }),
  // ... other note properties
});

const genMeasure = fc.record({
  notes: fc.array(genNote, { minLength: 1, maxLength: 16 }),
  attributes: genAttributes,
  // ... other measure properties
});

const genPart = fc.record({
  id: fc.string(),
  measures: fc.array(genMeasure, { minLength: 1, maxLength: 32 })
});

const genMusicXML = fc.record({
  parts: fc.array(genPart, { minLength: 1, maxLength: 4 })
}).map(data => serializeToMusicXML(data));
```

**Challenge:** Generating **valid** MusicXML with correct timing, division alignment, and structural constraints is non-trivial.

#### B. Comparison Testing Strategy

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

async function runPythonXml2abc(xmlInput: string): Promise<string> {
  // Write XML to temp file
  // Call: python xml2abc.py tempfile.xml
  // Read ABC output
  // Return ABC string
}

describe('xml2abc comparison tests', () => {
  it('produces same output as Python version', async () => {
    await fc.assert(
      fc.asyncProperty(genMusicXML, async (xmlString) => {
        const pythonOutput = await runPythonXml2abc(xmlString);
        const tsOutput = xml2abc(xmlString);

        // Comparison strategy needed here
        expect(normalizeABC(tsOutput)).toBe(normalizeABC(pythonOutput));
      })
    );
  });
});
```

**Comparison Strategies:**

1. **String equality** (with normalization):
   - Strip whitespace differences
   - Normalize line breaks
   - Ignore comment differences

2. **Semantic equality**:
   - Parse both ABC outputs with our parser
   - Compare ASTs structurally
   - Allows different but equivalent ABC representations

3. **Hybrid approach**:
   - Start with string comparison
   - Fall back to semantic comparison if strings differ
   - Log differences for investigation

#### C. Test Corpus

Even with property-based testing, we need **real-world test cases**:

```
parse/xml2abc/__tests__/
  fixtures/
    simple-melody.xml
    multi-voice.xml
    nested-tuplets.xml
    sibelius-export.xml
    musescore-export.xml
    finale-export.xml
  comparison.test.ts
  property.test.ts
  edge-cases.test.ts
```

### 7. Key Testing Challenges

**A. Non-deterministic Output:**
Some ABC generation choices are arbitrary (e.g., when to break lines). Need to handle:
- Different but equivalent broken rhythm representations
- Different spacing choices
- Different unit length calculations

**B. Generator Complexity:**
Full MusicXML is massive. Strategy:
- Start with **minimal valid MusicXML** generators (single voice, simple notes)
- Gradually add complexity (chords, tuplets, multiple voices)
- Use **shrinking** effectively to find minimal failing cases

**C. Python Dependency:**
Tests require Python + xml2abc installed. Need:
- CI/CD setup with Python environment
- Local dev documentation for running comparison tests
- Fallback for when Python not available (skip comparison tests)

---

## Implementation Phases

### Phase 1: Foundation
- XML parser integration
- Basic data structures
- Simple note conversion (no tuplets, no multi-voice)
- Basic property-based test generators

### Phase 2: Core Features
- Multi-voice support
- Tuplet handling
- Ornaments/articulations
- Comparison testing infrastructure

### Phase 3: Edge Cases
- All MusicXML quirks xml2abc handles
- Real-world test corpus
- Sibelius/MuseScore/Finale compatibility

### Phase 4: Polish
- Performance optimization
- Error messages
- CLI integration
- Documentation

---

## Key Decisions

- **No file writing logic**: Output is returned as string, not written to files
- **Separate module**: xml2abc lives in its own module, doesn't touch existing parser code
- **Config object**: CLI options exposed as `Xml2AbcOptions` interface
- **Parser handles errors**: Malformed XML errors delegated to parser library
- **API surface**: Single `xml2abc()` function
- **Testing**: Property-based testing with fast-check + comparison against Python version
