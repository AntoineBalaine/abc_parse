---
name: m-research-abc-to-xml-conversion
branch: none
status: pending
created: 2025-12-01
---

# ABC to XML Conversion Research

## Problem/Goal
We need to determine the feasibility of enabling ABC to XML conversion in our TypeScript codebase. The reference implementation exists in Python at https://github.com/delaudio/abc2xml. We need to investigate:

1. How complex would porting abc2xml to TypeScript be?
2. Can we leverage our existing parser pipeline (AST or interpreter's semantic tree output) for the conversion?
3. What dependencies and external libraries would be required?
4. How would this integrate with our existing ABC parser infrastructure?
5. What advantages would using our own parser give us compared to porting the Python implementation?

## Success Criteria
- [ ] Comprehensive analysis of abc2xml Python codebase completed
- [ ] Complexity assessment documented (key algorithms, data structures, conversion logic)
- [ ] Analysis of how our existing AST/interpreter output could be used for conversion
- [ ] Clear recommendation on whether to port or build on top of our existing pipeline
- [ ] If using our pipeline: documented plan showing how AST/semantic tree maps to XML
- [ ] If porting: documented plan with key challenges and implementation approach
- [ ] Final recommendation documented in this task file

## Context Manifest
<!-- Added by context-gathering agent -->

### Executive Summary: Two Approaches to ABC to MusicXML Conversion

We have two viable architectural approaches for implementing ABC to MusicXML conversion in our TypeScript codebase:

**Option 1: Port abc2xml.py** - Directly translate the Python implementation to TypeScript, preserving its parsing approach
**Option 2: Leverage Our Pipeline** - Build an XML generator that consumes our existing TypeScript AST and interpreter output

The critical insight is that abc2xml.py uses its own parser (pyparsing-based) that produces an intermediate representation (pObj tree), then walks this tree to generate MusicXML. Because our TypeScript parser already produces a rich AST and semantic tree through the interpreter, we can bypass re-parsing and directly convert our existing data structures to MusicXML.

---

### How abc2xml.py Currently Works

#### Architecture Overview

The abc2xml.py implementation (2248 lines, Python 2.7/3 compatible) follows this pipeline:

```
ABC Text → pyparsing Grammar → pObj Tree → MusicXML Elements → XML Document
```

#### Key Components

**1. Parsing Phase (Lines 56-262)**

The script defines a complete ABC grammar using pyparsing combinators. Because ABC notation has context-sensitive syntax (headers vs voice lines vs lyrics), the grammar is split into three main parsers:

- `abc_header` - Parses info fields like `X:`, `T:`, `K:`, `M:`, etc.
- `abc_voice` - Parses the music notation (notes, chords, barlines, decorations, tuplets, grace notes)
- `abc_scoredef` - Parses multi-staff grouping instructions (`%%score`, `%%staves`)
- `abc_percmap` - Parses percussion mapping directives

The grammar uses parse actions to immediately transform matched text into `pObj` instances. For example, when a note is matched, `noteActn()` is called to create a `pObj('note', ...)` with nested `pObj` children for pitch, duration, decorations, etc.

**2. pObj Tree Structure (Lines 263-323)**

`pObj` is the universal node type for the intermediate representation. Every meaningful ABC element becomes a pObj with:
- `name` - Identifies the type (e.g., 'note', 'chord', 'rest', 'rbar', 'lbar', 'tup', 'deco')
- `t` - List of literal values (strings, numbers) that aren't themselves pObjs
- Dynamic attributes - Nested pObj instances become attributes (e.g., `note.pitch`, `note.dur`, `chord.note`)
- `objs` - Ordered list of children when sequence matters (lyrics, chord notes)

Example: The ABC note `^C/2` becomes:
```python
pObj('note', [
    pObj('bbrk', [False]),  # beam break
    pObj('pitch', ['^', 'C', 0]),  # accidental, step, octave
    pObj('dur', (1, 4))  # numerator, denominator (simplified)
])
```

**3. Measure Transformation (Lines 325-423)**

Before XML generation, each measure undergoes transformations:

- `convertBroken()` - Converts broken rhythm notation (`>`, `<`) into explicit duration changes
- `convertChord()` - Explodes chord notation `[CEG]` into sequences of notes (MusicXML style: first note + subsequent <chord/> tagged notes)
- `doGrace()` - Flags all notes in grace sequences with `grace` attribute

These transformations normalize the ABC into a form that maps more directly to MusicXML semantics.

**4. MusicXML Generation (Lines 424-2079)**

The `MusicXml` class (line 808) maintains conversion state and generates XML using Python's ElementTree. Key methods:

- `mkNote()` - Converts pObj note to MusicXML <note> element with pitch, duration, type, accidentals, ties, slurs, tuplets, beams
- `mkMeasure()` - Processes a measure's pObj list, handling barlines, clefs, key changes, tempo, decorations, text
- `mkPart()` - Creates a <part> from all measures of a voice
- `parse()` - Orchestrates: parse ABC → split voices → convert each voice → merge staves/grand staves → assemble <score-partwise>

**State Management:**

The `MusicXml` class tracks complex state across measures:
- `ties` - Open ties by pitch tuple, for cross-barline note connections
- `slurstack` - Stack of active slur numbers (supports nested/overlapping slurs)
- `msreAlts` - Accidentals active within current measure
- `keyAlts` - Key signature alterations
- `tupnts` - Tuplet note tracking for irregular tuplets
- `prevNote` - Previous note for beam continuation logic
- `gStaffNums` / `gNstaves` - Grand staff mapping
- `percMap` - Percussion note head mapping

**Critical Algorithms:**

1. **Duration Calculation** - Combines ABC rhythm notation, unit length (L:), tuplet modifiers, and broken rhythms
2. **Beam Detection** - Uses `detectBeamBreak()` to analyze whitespace between notes in source text
3. **Chord Sorting** - Orders chord notes by MIDI pitch (highest first) if `orderChords` flag set
4. **Voice Merging** - Implements overlay voices (`&`) and staff grouping per `%%score` directive
5. **Tie vs Slur Disambiguation** - Checks pitch continuity; illegal ties become slurs

#### Data Flow Example

ABC input:
```abc
M:4/4
L:1/8
K:G
[CEG]2 D2|
```

Parsing produces:
```python
measure = [
    pObj('chord', [
        pObj('note', [pitch('C'), dur(2,1)]),
        pObj('note', [pitch('E'), dur(2,1)]),
        pObj('note', [pitch('G'), dur(2,1)]),
        pObj('dur', (2,1))
    ]),
    pObj('note', [pitch('D'), dur(2,1)]),
    pObj('rbar', ['|'])
]
```

After `convertChord()`:
```python
measure = [
    pObj('note', [pitch('C'), dur(2,1)]),  # first note, normal
    pObj('note', [pitch('E'), dur(2,1), chord(1)]),  # marked as chord note
    pObj('note', [pitch('G'), dur(2,1), chord(1)]),  # marked as chord note
    pObj('note', [pitch('D'), dur(2,1)]),
    pObj('rbar', ['|'])
]
```

MusicXML generation loops these notes, calling `mkNote()` for each, which:
1. Computes XML duration: `divisions * 2 * unitL` = `2520 * 2 * 1/8` = `630`
2. Determines type from denominator: `8 → 'eighth'`
3. Creates `<pitch><step>C</step><octave>4</octave></pitch>`
4. Adds `<chord/>` element for notes 2 and 3
5. Wraps in `<note>` element with `<duration>`, `<voice>`, `<type>`

---

### How Our TypeScript Parser Works

#### Architecture Overview

Our codebase implements a complete ABC parser with three-phase pipeline:

```
ABC Text → Scanner → Tokens → Parser → AST → Semantic Analysis → Interpreter → ABCJS Tune
```

The parser is designed to be **statically typed**, **error-tolerant**, and produce output compatible with the ABCJS rendering library.

#### Key Components

**1. Scanner Phase (scan2.ts, scan_tunebody.ts)**

Tokenizes ABC notation character-by-character into typed tokens. Because ABC has mode-dependent syntax (e.g., `C` can mean "common time" in M: field or "C note" in music), the scanner tracks context:

- File header mode (before first X: field)
- Tune header mode (X: to K: field)
- Tune body mode (after K:, the music itself)
- Info line mode (inside `[]` brackets or after `:`)
- Directive mode (after `%%`)

**Token Types (TT enum):** Includes NOTE_LETTER, BARLINE, SHARP, FLAT, NUMBER, LEFTBRKT, RIGHTPAREN, WHITESPACE, etc.

**2. Parser Phase (parse2.ts, parseInfoLine2.ts, voices2.ts)**

Recursive descent parser that consumes tokens and builds AST. Because ABC grammar has ambiguities (e.g., `[` starts chords, inline fields, or staff groupings depending on context), the parser uses lookahead and backtracking.

**Parser Structure:**
- `parse()` - Main entry, orchestrates file parsing
- `tune()` - Parses a single tune (X: through double-newline)
- `tune_header()` - Parses header fields
- `tune_body()` - Parses music notation
- `music_code()` - Parses a single measure or line of music
- `note()`, `chord()`, `grace_group()`, `tuplet()` - Parse musical elements
- `parseInfoLine()` - Parses info field values (K:, M:, etc.)
- `parseDirective()` - Parses %% directives

**3. AST Types (types/Expr2.ts)**

Strongly-typed expression tree nodes. Every syntactic element inherits from `Expr` base class and implements `accept<R>(visitor: Visitor<R>)` for the visitor pattern.

**Key AST Nodes:**

```typescript
File_structure {
  file_header: File_header | null
  contents: Array<Tune | Token>
}

Tune {
  header: Tune_header
  body: Tune_Body
}

Tune_header {
  info_lines: Array<Info_line | Comment | Directive>
  voices: string[]  // voice IDs found in header
}

Tune_Body {
  systems: System[]  // grouped by voice overlays/staves
}

Info_line {
  key: Token  // 'X', 'T', 'K', etc.
  value: Token[]
  parsed?: InfoLineUnion  // semantic data after analysis
}

Note {
  pitch: Pitch
  rhythm: Rhythm | null
  decorations: Decoration[]
}

Pitch {
  alteration?: Token  // '^', '_', '='
  noteLetter: Token  // 'C', 'D', etc.
  octave?: Token  // ',', "'"
}

Chord {
  notes: Array<Note | Rest>
  rhythm: Rhythm | null
}
```

**4. Semantic Analysis (semantic-analyzer.ts, info-line-analyzer.ts, directive-analyzer.ts)**

After parsing, analyzers walk the AST to validate and extract semantic meaning from info lines and directives. Because ABC field syntax is complex (e.g., `K:Gm clef=bass octave=-1`), dedicated analyzers parse the field content.

The semantic analyzer populates `Info_line.parsed` with typed data:

```typescript
type InfoLineUnion =
  | { type: "key"; data: KeyInfo }
  | { type: "meter"; data: Meter }
  | { type: "voice"; data: VoiceProperties }
  | { type: "tempo"; data: TempoProperties }
  | { type: "note_length"; data: IRational }
  // ... etc
```

**5. Interpreter Phase (TuneInterpreter.ts)**

Walks the AST and builds ABCJS-compatible `Tune` output structure. Because ABCJS expects a specific format for rendering, the interpreter transforms our AST into ABCJS's intermediate representation.

**Interpreter State (InterpreterState.ts):**

```typescript
InterpreterState {
  semanticData: Map<ExprID, SemanticData>
  fileDefaults: FileDefaults  // shared across tunes
  tuneDefaults: TuneDefaults  // per-tune defaults
  currentVoice: string
  measureNumber: number
  voices: Map<VoiceID, VoiceState>

  // Multi-staff tracking
  stavesNomenclatures: StaffNomenclature[]
  vxNomenclatures: Map<VoiceID, VxNomenclature>

  tune: Tune  // output being constructed
}

VoiceState {
  id: string
  currentKey: KeySignature
  currentClef: ClefProperties
  measureAccidentals: Map<string, AccidentalType>

  // Beam/tie/slur tracking
  potentialStartBeam?: NoteElement
  pendingTies: Map<number, {}>
  pendingStartSlurs: number[]

  // Tuplet tracking
  tupletNotesLeft: number
  tupletP: number  // (p:q:r notation

  // Broken rhythm
  nextNoteDurationMultiplier?: IRational
}
```

**Interpreter Output (types/abcjs-ast.ts):**

```typescript
Tune {
  metaText: MetaText  // title, composer, etc.
  formatting: TuneFormatting  // directives
  media: MediaType
  systems: USystem[]  // StaffSystem | TextLine | SubtitleLine
}

StaffSystem {
  staff: Staff[]  // parallel staves
}

Staff {
  voices: VoiceElement[][]  // array of voices, each voice is array of elements
  clef?: ClefProperties
  key?: KeyElement
  meter?: MeterElement
}

NoteElement {
  el_type: 'note'
  pitches: Pitch[]  // chord = multiple pitches
  duration: number  // in divisions (1/4 note = 1)
  startChar: number
  endChar: number

  // Optional properties
  gracenotes?: GraceNote[]
  decoration?: string[]
  startTie?: { [pitch: number]: {}}
  endTie?: { [pitch: number]: {}}
  startSlur?: number[]
  endSlur?: number[]
  startTriplet?: { num: number, numNotes: number }
  endTriplet?: boolean
}
```

---

### Comparison: abc2xml vs Our Pipeline

| Aspect | abc2xml.py | Our TypeScript Pipeline |
|--------|-----------|------------------------|
| **Parsing** | pyparsing library, single-pass, grammar-based | Hand-written recursive descent, multi-pass with semantic analysis |
| **Intermediate Rep** | pObj tree (untyped, dynamic) | Strongly-typed AST (Expr subclasses) |
| **State Tracking** | Mutable MusicXml class with ~50 state variables | Hierarchical InterpreterState with VoiceState per voice |
| **Chord Representation** | Exploded to note sequences during parsing | Preserved as Chord nodes, exploded during interpretation |
| **Duration Model** | Rational fractions (num, den) | IRational with GCD simplification |
| **Beam Detection** | Source text whitespace analysis | AST-based with duration thresholds |
| **Multi-staff** | %%score directive parsing + voice merging | StaffNomenclature + VxNomenclature mapping |
| **Output Format** | MusicXML (ElementTree) | ABCJS Tune (TypeScript objects) |

#### Key Architectural Differences

**1. Type Safety**

abc2xml uses Python's dynamic typing - pObj attributes are created on-the-fly. Our TypeScript AST has explicit types for every node, enabling compile-time error detection and IDE autocomplete.

**2. Error Recovery**

abc2xml halts on parse errors. Our parser is error-tolerant - it inserts ErrorExpr nodes and continues, enabling IDE features like partial syntax highlighting and diagnostics on incomplete code.

**3. Semantic Separation**

abc2xml mingles parsing and interpretation (parse actions immediately create pObjs). We separate concerns:
- Parser produces syntactic AST
- Semantic analyzer validates and extracts meaning
- Interpreter transforms to output format

Because semantic analysis is separate, we can swap output formats (ABCJS, MusicXML, MIDI) without re-parsing.

**4. State Management**

abc2xml uses a monolithic MusicXml class with ~50 mutable fields. Our InterpreterState is hierarchical:
- FileDefaults (shared across tunes)
- TuneDefaults (per-tune)
- VoiceState (per-voice within tune)

Because state is scoped appropriately, voice-specific data (ties, slurs, accidentals) can't accidentally leak between voices.

---

### Option 1: Porting abc2xml to TypeScript

#### What Would Change

**1. pyparsing → Hand-written Parser**

pyparsing provides combinator-based grammar DSL. We'd need to translate to recursive descent functions:

```python
# abc2xml.py
note_length = Optional(number, 1) + Group(ZeroOrMore('/')) + Optional(number, 2)
note = pitch + note_length + Optional(tie) + Optional(slur_ends)
```

Becomes:

```typescript
// abc2xml.ts
function parseNoteLength(): NoteLengthPObj {
  const num1 = match(NUMBER) ?? 1;
  const slashes = matchRepeated('/');
  const num2 = match(NUMBER) ?? 2;
  return pObj('dur', (num1, (num2 << slashes.length) >> 1));
}

function parseNote(): NotePObj {
  const pitch = parsePitch();
  const length = parseNoteLength();
  const tie = matchOptional(tiePattern);
  const slurs = matchOptional(slurEnds);
  return pObj('note', [pitch, length, tie, slurs]);
}
```

**2. pObj → TypeScript Class**

The pObj system works well in Python because of dynamic attribute assignment. TypeScript needs explicit typing:

```typescript
class PObj<T extends string = string> {
  name: T
  t: Array<string | number | boolean>  // literals
  objs: PObj[]  // ordered children

  // Make attributes type-safe with mapped types
  attrs: PAttrs[T]  // e.g., note has 'pitch', 'dur', 'tie'
}

interface PAttrs {
  note: { pitch?: PObj<'pitch'>, dur: PObj<'dur'>, tie?: PObj<'tie'> }
  pitch: { alteration?: string, step: string, octave: number }
  chord: { note: PObj<'note'>[], dur: PObj<'dur'> }
  // ... etc for 50+ pObj types
}
```

Because pObj attributes are discovered dynamically during parsing, we'd need to either:
- Use TypeScript's `any` (loses type safety)
- Explicitly type all 50+ pObj variants (verbose but safe)
- Use discriminated unions (best but complex)

**3. ElementTree → xml2js or Manual XML Building**

Python's ElementTree provides a clean API for building XML. TypeScript alternatives:

```typescript
// Option A: Use xmlbuilder2 library
import { create } from 'xmlbuilder2';

const note = create({ version: '1.0' })
  .ele('note')
    .ele('pitch')
      .ele('step').txt('C').up()
      .ele('octave').txt('4').up()
    .up()
    .ele('duration').txt('630').up()
  .up();
```

```typescript
// Option B: Manual string building (abc2xml style)
function mkNote(n: PObj<'note'>): string {
  let xml = '<note>\n';
  xml += mkPitch(n.attrs.pitch);
  xml += `  <duration>${calcDuration(n)}</duration>\n`;
  xml += '</note>\n';
  return xml;
}
```

**4. State Management**

The MusicXml class state variables would translate directly - Python and TypeScript are similar here. Main changes:

```python
# Python
s.ties = {}  # any keys, any values
s.keyAlts = {}  # loose structure
```

```typescript
// TypeScript
ties: Map<PitchTuple, TieInfo>  // explicit key/value types
keyAlts: Map<string, string>  // step → alteration
```

Where:
```typescript
type PitchTuple = [step: string, octave: number];
interface TieInfo {
  alter: string;
  notation: ElementNode;
  voiceNum: number;
  noteElement: ElementNode;
}
```

#### Implementation Complexity Assessment

**Lines of Code Estimate:**
- Core parsing logic: ~1500 lines (replicate grammar + parse actions)
- pObj infrastructure: ~200 lines (class + helper functions)
- MusicXml class: ~1800 lines (mostly mechanical translation)
- Utilities (string parsing, duration calc): ~300 lines
- **Total: ~3800 lines** (vs 2248 in Python, due to type annotations)

**Estimated Effort:**
- Parsing layer: 2-3 weeks (complex due to pyparsing translation)
- State management: 1 week (straightforward translation)
- XML generation: 2 weeks (translate ElementTree to TypeScript XML lib)
- Testing & debugging: 2-3 weeks (many edge cases in ABC notation)
- **Total: 7-9 weeks**

**Risk Factors:**

1. **Parsing complexity** - pyparsing handles backtracking, error recovery, and lookahead automatically. Hand-rolling this is error-prone.

2. **State bugs** - The MusicXml class has intricate state interdependencies (e.g., ties interact with chords, slurs, voice overlays). Translating without fully understanding the invariants risks subtle bugs.

3. **ABC dialect differences** - abc2xml might handle some ABC constructs differently than our parser (e.g., broken rhythm precedence, decoration syntax). Divergence would require disambiguation logic.

4. **Maintenance burden** - We'd maintain a second parser parallel to our main one. Changes to ABC handling would need to propagate to both.

#### Advantages of Porting

1. **Proven algorithm** - abc2xml is mature (10+ years, used in production). Its MusicXML output is accepted by Finale, MuseScore, Sibelius.

2. **Complete feature set** - Handles all ABC constructs our parser doesn't yet support (macros, some directives).

3. **No dependency on ABCJS** - Direct ABC → MusicXML conversion, no need to match ABCJS intermediate format.

#### Disadvantages of Porting

1. **Duplicate parsing** - We'd have two ABC parsers (ours for AST/IDE features, ported abc2xml for XML). Divergent behavior would confuse users.

2. **Loss of type safety** - pObj system is inherently untyped. TypeScript translation would either compromise type safety or require extensive type annotations.

3. **Miss existing infrastructure** - Our parser has error recovery, position tracking, semantic analysis. abc2xml doesn't - we'd need to retrofit these.

4. **Beam detection fragility** - abc2xml detects beams by analyzing whitespace in source text. Because our parser operates on tokens (whitespace discarded), we'd need to preserve original text or implement alternative beam logic.

---

### Option 2: Building on Our Existing Pipeline

#### How It Would Work

Because we already parse ABC into a rich AST and interpret to ABCJS format, we can add a new visitor that walks the ABCJS Tune structure and generates MusicXML elements.

**Pipeline:**

```
ABC Text → [Our Parser] → AST → [Our Interpreter] → ABCJS Tune → [New: XML Generator] → MusicXML
```

The XML Generator would be a pure transformation function:

```typescript
function generateMusicXML(tune: Tune): string {
  const xml = new MusicXMLBuilder();

  // Generate score-partwise root
  xml.startScorePartwise();

  // Identification section (title, composer, etc.)
  xml.writeIdentification(tune.metaText);

  // Part list (instruments/voices)
  xml.startPartList();
  for (const voice of getVoiceList(tune)) {
    xml.writeScorePart(voice.id, voice.name);
  }
  xml.endPartList();

  // Parts (musical content)
  for (const voice of getVoiceList(tune)) {
    xml.startPart(voice.id);
    for (let measureNum = 1; measureNum <= countMeasures(tune); measureNum++) {
      writeMeasure(xml, tune, voice, measureNum);
    }
    xml.endPart();
  }

  xml.endScorePartwise();
  return xml.toString();
}
```

#### Mapping ABCJS Tune to MusicXML

**1. Structure Mapping**

| ABCJS | MusicXML | Notes |
|-------|----------|-------|
| `Tune` | `<score-partwise>` | Root element |
| `Tune.metaText` | `<identification>` | Title, composer, etc. |
| `Tune.formatting` | `<defaults>` | Page layout, staff spacing |
| `StaffSystem` | Multiple `<measure>` | One system = one row of music |
| `Staff` | `<part>` | One staff = one instrument/voice |
| `Staff.voices` | `<note>` elements | Multiple voices = layered notes |
| `NoteElement` | `<note>` | Pitch + duration + attributes |
| `BarElement` | `<barline>` | Bar style + repeats + volta |

**2. Element Conversion**

**Notes:**

```typescript
// ABCJS format
interface NoteElement {
  el_type: 'note'
  pitches: Pitch[]  // [{ step: 'C', octave: 4, accidental: 'sharp' }]
  duration: number  // 1.0 = quarter note
  decoration?: string[]  // ['staccato', 'fermata']
  startTie?: { [pitch: number]: {} }
  startSlur?: number[]
  startTriplet?: { num: number, numNotes: number }
}

// MusicXML output
<note>
  <pitch>
    <step>C</step>
    <alter>1</alter>  <!-- sharp -->
    <octave>4</octave>
  </pitch>
  <duration>480</duration>  <!-- divisions * duration -->
  <type>quarter</type>
  <accidental>sharp</accidental>
  <notations>
    <articulations>
      <staccato/>
    </articulations>
    <fermata type="upright"/>
    <tied type="start"/>
    <slur number="1" type="start"/>
    <tuplet type="start" number="1"/>
  </notations>
</note>
```

Conversion logic:

```typescript
function writeNote(xml: XMLBuilder, note: NoteElement, state: ConversionState) {
  xml.startNote();

  // Chord notes after first note need <chord/> tag
  if (state.isChordNote && note !== state.chordNotes[0]) {
    xml.writeEmptyElement('chord');
  }

  // Pitch
  for (const pitch of note.pitches) {
    xml.startPitch();
    xml.writeElement('step', pitch.step);
    if (pitch.accidental) {
      xml.writeElement('alter', accidentalToAlter(pitch.accidental));
    }
    xml.writeElement('octave', String(pitch.octave));
    xml.endPitch();
  }

  // Duration (convert from ABCJS relative to MusicXML divisions)
  const divisions = state.divisions;  // e.g., 480 (common choice)
  const xmlDuration = Math.round(note.duration * divisions * 4);  // ABCJS duration is in quarter notes
  xml.writeElement('duration', String(xmlDuration));

  // Type (whole, half, quarter, eighth, etc.)
  const type = durationToType(note.duration);
  xml.writeElement('type', type);

  // Accidental display
  if (note.pitches[0].accidental && shouldDisplayAccidental(note, state)) {
    xml.writeElement('accidental', accidentalToName(note.pitches[0].accidental));
  }

  // Notations (ties, slurs, articulations, tuplets)
  if (hasNotations(note)) {
    xml.startNotations();

    if (note.startTie) {
      for (const pitch in note.startTie) {
        xml.writeEmptyElement('tied', { type: 'start' });
      }
    }
    if (note.endTie) {
      for (const pitch in note.endTie) {
        xml.writeEmptyElement('tied', { type: 'stop' });
      }
    }

    if (note.startSlur) {
      for (const slurNum of note.startSlur) {
        xml.writeEmptyElement('slur', { number: String(slurNum), type: 'start' });
      }
    }
    if (note.endSlur) {
      for (const slurNum of note.endSlur) {
        xml.writeEmptyElement('slur', { number: String(slurNum), type: 'stop' });
      }
    }

    if (note.startTriplet) {
      xml.writeEmptyElement('tuplet', { type: 'start', number: '1' });
      // Also need <time-modification> in note (outside notations)
    }
    if (note.endTriplet) {
      xml.writeEmptyElement('tuplet', { type: 'stop', number: '1' });
    }

    if (note.decoration) {
      writeDecorations(xml, note.decoration);
    }

    xml.endNotations();
  }

  xml.endNote();
}
```

**Key Conversions:**

```typescript
// Duration to note type
function durationToType(duration: number): string {
  // ABCJS duration: 1.0 = quarter, 0.5 = eighth, 2.0 = half, etc.
  const types: Record<number, string> = {
    4: 'whole',
    2: 'half',
    1: 'quarter',
    0.5: 'eighth',
    0.25: '16th',
    0.125: '32nd',
    0.0625: '64th'
  };

  // Handle dotted notes (duration * 1.5)
  if (duration * 2 / 3 in types) {
    return types[duration * 2 / 3];  // Will need <dot/> element
  }

  return types[duration] || 'quarter';
}

// Accidental conversion
function accidentalToAlter(acc: AccidentalType): string {
  const map: Record<AccidentalType, string> = {
    'sharp': '1',
    'flat': '-1',
    'natural': '0',
    'dblsharp': '2',
    'dblflat': '-2',
    'quartersharp': '0.5',
    'quarterflat': '-0.5'
  };
  return map[acc];
}

// Decoration to MusicXML articulation/ornament
function writeDecorations(xml: XMLBuilder, decorations: string[]) {
  const articulations = ['staccato', 'accent', 'tenuto', 'marcato', 'staccatissimo'];
  const ornaments = ['trill', 'mordent', 'turn'];

  const arts = decorations.filter(d => articulations.includes(d));
  const orns = decorations.filter(d => ornaments.includes(d));

  if (arts.length > 0) {
    xml.startArticulations();
    arts.forEach(art => xml.writeEmptyElement(art));
    xml.endArticulations();
  }

  if (orns.length > 0) {
    xml.startOrnaments();
    orns.forEach(orn => xml.writeEmptyElement(ornamentMap[orn]));
    xml.endOrnaments();
  }
}
```

**3. State Tracking During Conversion**

Because MusicXML requires certain attributes (like key signature alterations applying to subsequent notes), we need to track state:

```typescript
interface ConversionState {
  // Per-measure state
  divisions: number;  // How many divisions per quarter note (e.g., 480)
  measureNumber: number;

  // Per-voice state
  currentKey: KeySignature;
  currentMeter: Meter;
  currentClef: ClefProperties;
  measureAccidentals: Map<string, AccidentalType>;  // step+octave → accidental

  // Chord handling
  isChordNote: boolean;
  chordNotes: NoteElement[];

  // Beam handling (if we implement beaming)
  beamStack: number[];
}

function shouldDisplayAccidental(note: NoteElement, state: ConversionState): boolean {
  const pitch = note.pitches[0];
  const step = pitch.step;
  const octave = pitch.octave;
  const key = `${step}${octave}`;

  // Check if key signature already has this alteration
  const keyAlt = state.currentKey.accidentals?.find(a => a.note === step)?.acc;
  if (keyAlt === pitch.accidental) {
    return false;  // Key signature covers it
  }

  // Check if this measure already has this accidental
  const measureAlt = state.measureAccidentals.get(key);
  if (measureAlt === pitch.accidental) {
    return false;  // Earlier note in measure covers it
  }

  // Need to display accidental
  state.measureAccidentals.set(key, pitch.accidental!);
  return true;
}
```

**4. Measure Organization**

Because ABCJS uses `StaffSystem` (one line of music across all staves) but MusicXML uses `<part>` (all measures of one voice), we need to reorganize:

```typescript
function writeMeasure(
  xml: XMLBuilder,
  tune: Tune,
  voiceId: string,
  measureNum: number
) {
  xml.startMeasure(measureNum);

  // Find all systems that contain this measure number
  for (const system of tune.systems) {
    if (system.type !== 'staff-system') continue;

    const staff = system.staff.find(s => hasVoice(s, voiceId));
    if (!staff) continue;

    const voice = staff.voices.find(v => v.id === voiceId);
    if (!voice) continue;

    // Write all elements from this voice in this measure
    const elementsInMeasure = voice.filter(e => e.measureNumber === measureNum);
    for (const element of elementsInMeasure) {
      writeElement(xml, element, state);
    }
  }

  xml.endMeasure();
}
```

Actually, because ABCJS doesn't explicitly track measure numbers, we'd need to infer them from BarElements:

```typescript
function organizeMeasures(tune: Tune): Map<VoiceID, NoteElement[][]> {
  const measuresByVoice = new Map<string, NoteElement[][]>();

  for (const system of tune.systems) {
    if (system.type !== 'staff-system') continue;

    for (const staff of system.staff) {
      for (const voiceElements of staff.voices) {
        const voiceId = inferVoiceId(voiceElements);

        if (!measuresByVoice.has(voiceId)) {
          measuresByVoice.set(voiceId, []);
        }

        const measures = measuresByVoice.get(voiceId)!;
        let currentMeasure: VoiceElement[] = [];

        for (const element of voiceElements) {
          if (element.el_type === 'bar') {
            // End of measure
            measures.push(currentMeasure);
            currentMeasure = [];
          } else {
            currentMeasure.push(element);
          }
        }

        // Handle last measure if no trailing bar
        if (currentMeasure.length > 0) {
          measures.push(currentMeasure);
        }
      }
    }
  }

  return measuresByVoice;
}
```

#### Implementation Complexity Assessment

**Lines of Code Estimate:**
- XML generation infrastructure: ~300 lines (XMLBuilder class, element helpers)
- Note conversion: ~400 lines (pitch, duration, ties, slurs, tuplets, decorations)
- Measure organization: ~200 lines (reorganize ABCJS structure to MusicXML parts)
- Metadata conversion: ~150 lines (title, composer, key, meter, tempo)
- State management: ~200 lines (ConversionState, accidental tracking)
- **Total: ~1250 lines**

**Estimated Effort:**
- Infrastructure (XMLBuilder): 3 days
- Basic note conversion: 1 week
- Advanced features (ties, slurs, tuplets): 1 week
- Metadata & attributes: 3 days
- Testing & edge cases: 1 week
- **Total: 3-4 weeks**

**Risk Factors:**

1. **ABCJS Tune completeness** - Our interpreter might not populate all fields needed for XML conversion (e.g., beaming information). We'd need to enhance the interpreter.

2. **Measure organization** - ABCJS's system-based layout doesn't align with MusicXML's part-based layout. Reorganization logic could be complex for multi-voice scores.

3. **Semantic gaps** - Some ABC constructs might be preserved in our AST but lost in ABCJS Tune format (e.g., certain decorations, directives). We might need to reference the AST during conversion.

4. **MusicXML compliance** - MusicXML schema is complex (~400 elements). Our output would initially be incomplete; iterative refinement needed.

#### Advantages of This Approach

1. **Reuse existing infrastructure** - Leverages our parser, semantic analyzer, and interpreter. No duplicate parsing.

2. **Type safety** - ABCJS Tune structure is well-typed. Conversion logic benefits from TypeScript's type checking.

3. **Separation of concerns** - XML generation is orthogonal to parsing. Changes to ABC handling automatically flow through.

4. **Incremental development** - We can start with basic notes/measures and iteratively add ties, slurs, tuplets, dynamics, etc.

5. **Testing leverage** - Our existing parser test suite validates the input to XML generation. We only need to test XML output.

#### Disadvantages of This Approach

1. **Dependency on interpreter completeness** - If our interpreter doesn't capture all ABC semantics, XML output will be incomplete. We'd need to enhance the interpreter.

2. **Potential information loss** - ABC → AST → ABCJS Tune → MusicXML could lose information that's preserved in AST but not ABCJS Tune. Might need hybrid approach (AST + Tune).

3. **MusicXML learning curve** - MusicXML schema is large and intricate. Even basic output requires understanding elements, attributes, ordering constraints.

4. **Voice splitting complexity** - ABCJS collapses multi-voice music into StaffSystem. Separating back into MusicXML parts could be non-trivial.

---

### Recommendation

**Build on our existing pipeline (Option 2), with fallback to AST when ABCJS Tune is insufficient.**

**Rationale:**

1. **Lower effort** - 3-4 weeks vs 7-9 weeks for porting
2. **Better integration** - Single source of truth (our parser) vs maintaining two parsers
3. **Type safety** - Strongly-typed ABCJS Tune vs untyped pObj tree
4. **Incremental path** - Can ship basic note/measure conversion quickly, then enhance
5. **Extensibility** - When we add new ABC features to parser/interpreter, XML generation gets them automatically

**Implementation Plan:**

**Phase 1: MVP (Week 1)**
- XMLBuilder infrastructure
- Basic notes (pitch, duration, type)
- Simple measures (no attributes)
- Single-voice tunes only
- Output: Playable but minimal MusicXML

**Phase 2: Metadata (Week 2)**
- Identification section (title, composer)
- Key signatures, meter, tempo
- Part list with voice names
- Output: Complete header information

**Phase 3: Advanced Notation (Week 3)**
- Ties, slurs, tuplets
- Decorations (articulations, ornaments)
- Accidentals (display logic)
- Dynamics
- Output: Expressive notation

**Phase 4: Multi-Voice (Week 4)**
- Voice splitting from StaffSystem
- Measure alignment across parts
- Grand staff notation (piano)
- Output: Full ensemble scores

**Phase 5: Polish (Week 5, optional)**
- Beaming information
- Layout hints (line breaks, page breaks)
- Lyrics
- Chord symbols
- Output: Print-ready scores

**Critical Success Factors:**

1. **Test corpus** - Use abc2xml test files to validate output
2. **MusicXML validator** - Use schema validation to catch structural errors
3. **Roundtrip testing** - ABC → XML → notation software → visual inspection
4. **Incremental validation** - Test each phase's output in MuseScore/Finale/Sibelius

**Fallback Strategy:**

If we discover that ABCJS Tune loses critical information (e.g., explicit linebreaks, certain directive semantics), we can modify the conversion function to accept both AST and Tune:

```typescript
function generateMusicXML(ast: Tune_AST, tune: Tune): string {
  // Use Tune for primary structure
  // Reference AST for lost information
}
```

Because our AST preserves all source information (including whitespace, comments, error tokens), it can fill any gaps in ABCJS Tune.

---

### Technical Reference

#### MusicXML Element Structure (Simplified)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.0 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.0">
  <identification>
    <creator type="composer">J.S. Bach</creator>
    <encoding>
      <software>abc2xml</software>
      <encoding-date>2025-12-01</encoding-date>
    </encoding>
  </identification>

  <defaults>
    <scaling>
      <millimeters>7</millimeters>
      <tenths>40</tenths>
    </scaling>
  </defaults>

  <part-list>
    <score-part id="P1">
      <part-name>Violin</part-name>
    </score-part>
  </part-list>

  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key>
          <fifths>1</fifths>
          <mode>major</mode>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>

      <note>
        <pitch>
          <step>C</step>
          <octave>5</octave>
        </pitch>
        <duration>480</duration>
        <type>quarter</type>
      </note>

      <note>
        <pitch>
          <step>D</step>
          <octave>5</octave>
        </pitch>
        <duration>480</duration>
        <type>quarter</type>
      </note>

      <barline location="right">
        <bar-style>light-heavy</bar-style>
        <repeat direction="backward"/>
      </barline>
    </measure>
  </part>
</score-partwise>
```

#### ABCJS Tune Structure Reference

```typescript
{
  "version": "2.2",
  "media": "screen",
  "metaText": {
    "title": "Example Tune",
    "composer": "Trad.",
    "rhythm": "jig"
  },
  "formatting": {
    "titlefont": { "face": "serif", "size": 20, "weight": "bold" },
    "gchordfont": { "face": "serif", "size": 12 },
    // ... many formatting options
  },
  "systems": [
    {
      "type": "staff-system",
      "staff": [
        {
          "voices": [
            [
              { "el_type": "clef", "type": "treble" },
              { "el_type": "key", "root": "G", "mode": "" },
              { "el_type": "meter", "type": "specified", "value": [{ "num": 6, "den": 8 }] },
              { "el_type": "note", "pitches": [{ "step": "E", "octave": 4 }], "duration": 0.5 },
              { "el_type": "note", "pitches": [{ "step": "A", "octave": 4 }], "duration": 0.5 },
              { "el_type": "bar", "type": "bar_thin" }
            ]
          ]
        }
      ]
    }
  ]
}
```

#### abc2xml Key Data Structures

```python
# pObj examples from actual parsing
pObj('note', [
    pObj('bbrk', [False]),      # beam break
    pObj('pitch', ['^', 'C', 0]), # accidental, step, octave
    pObj('dur', (1, 4)),         # (numerator, denominator)
    pObj('tie', ['.-']),         # dotted tie
    pObj('slurs', [')'])         # slur end
])

pObj('chord', [
    pObj('note', [...]),
    pObj('note', [...]),
    pObj('dur', (2, 1))
])

pObj('rbar', [':|'])  # right bar with repeat
pObj('lbar', ['|:', '1'])  # left bar with volta 1
pObj('tup', [3, 2, 3])  # triplet (3 notes in time of 2)
pObj('deco', ['!trill!', '!accent!'])
```

#### File Locations

**abc2xml Implementation:**
- Main script: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/xml/abc2xml/abc2xml.py`
- Test file: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/xml/abc2xml/test.abc`
- Output example: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/xml/abc2xml/output.xml`

**Our TypeScript Parser:**
- AST types: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/types/Expr2.ts`
- ABCJS types: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/types/abcjs-ast.ts`
- Interpreter: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/interpreter/TuneInterpreter.ts`
- Interpreter state: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/interpreter/InterpreterState.ts`
- Scanner: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/parsers/scan2.ts`
- Parser: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/parsers/parse2.ts`

**Where to implement XML generation:**
- New directory: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/xml-export/`
- Main file: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/xml-export/MusicXMLGenerator.ts`
- Builder: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/xml-export/XMLBuilder.ts`
- Utilities: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/xml-export/conversion-utils.ts`

## User Notes
The user noted that we have a full parser pipeline implemented in this codebase, so we could potentially re-use the AST or interpreter's output semantic tree to run the conversion, rather than porting the Python implementation directly.

Reference implementation: https://github.com/delaudio/abc2xml/blob/main/abc2xml.py

The abc2xml codebase has been copied locally to the xml directory for analysis.

## Work Log
<!-- Updated as work progresses -->
