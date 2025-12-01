---
name: m-research-xml-to-abc-conversion
branch: none
status: pending
created: 2025-12-01
---

# XML to ABC Conversion Research

## Problem/Goal
We need to determine the feasibility of enabling XML to ABC conversion in our TypeScript codebase. The reference implementation exists in Python at https://github.com/SpotlightKid/xml2abc. We need to investigate:

1. How complex would porting xml2abc to TypeScript be?
2. If porting is not practical, what alternative approaches could we take?
3. What dependencies and external libraries would be required?
4. How would this integrate with our existing ABC parser infrastructure?

## Success Criteria
- [ ] Comprehensive analysis of xml2abc Python codebase completed
- [ ] Complexity assessment documented (key algorithms, data structures, conversion logic)
- [ ] Clear recommendation on whether to port or pursue alternatives
- [ ] If porting: documented plan with key challenges and implementation approach
- [ ] If not porting: documented alternative approaches with trade-offs
- [ ] Final recommendation documented in this task file

## Context Manifest

### How XML to ABC Conversion Currently Works: The xml2abc Python Implementation

The xml2abc tool is a mature Python implementation (~1586 lines) that converts MusicXML files into ABC notation format. The conversion process is fundamentally a transformation pipeline that parses MusicXML using Python's ElementTree XML parser, builds an intermediate representation in memory, and then generates ABC notation strings by serializing this representation.

#### High-Level Architecture and Data Flow

When xml2abc receives a MusicXML file, it first determines if it's a compressed .mxl file (which is a ZIP archive) or a plain .xml file. For .mxl files, it extracts the embedded XML using Python's ZipFile module. The main conversion process happens in the `Parser` class's `parse()` method, which takes a file object and coordinates the entire conversion pipeline.

The conversion starts by parsing the MusicXML document structure using `E.parse(fobj)` where E is either `xml.etree.cElementTree` or `xml.etree.ElementTree`. Because MusicXML represents a complete music score with metadata, multiple parts (instruments/voices), and detailed notation information, the parser must extract three distinct categories of information: (1) file-level metadata like title, composer, and page formatting, (2) structural information about parts, staves, and voice mappings, and (3) the actual musical content including notes, rhythms, dynamics, and articulations.

#### Core Data Structures: Building the ABC Representation

The xml2abc implementation uses three primary data classes to represent musical content during conversion:

The `Note` class represents individual notes or rests with complete notation information. Each Note stores the time position in XML divisions (`tijd`), duration (`dur`), tuplet information (`fact` for time modification, `tup` for start/stop markers, and `tupabc` for the ABC tuplet string), beam grouping (`beam`), grace note flag (`grace`), and most importantly two string lists: `before` containing ABC decorations/ornaments that appear before the note, and `after` for elements like ties that follow. The note also stores pitch information in `ns` (a list because chords contain multiple pitches), lyrics as a dictionary mapping verse numbers to syllables, and tablature data if present.

The `Measure` class maintains measure-level state. It tracks the part and measure indices, the measure duration in divisions (`mdur`), the current number of divisions per quarter note (`divs`), and the time signature (`mtr`). It also builds up ABC strings: `attr` accumulates measure signatures and tempo changes, `lline` and `rline` hold left and right barlines (with `lline` specifically capturing repeat starts with ':'), and `lnum` stores volta bracket numbers.

The `Music` class orchestrates voice management and measure accumulation across an entire part. It maintains the current time position (`tijd`) and maximum time in a measure (`maxtime`), accumulates completed measures in `gMaten` (a list of voice dictionaries, where each voice dictionary maps voice IDs to lists of Note/Elem objects), and manages lyrics separately in `gLyrics`. The class tracks all voice IDs used in a part through `vnums`, maintains a global voice counter (`vceCnt`) that increments across all parts to create unique ABC voice numbers, and provides helper methods like `appendNote()`, `appendElem()`, and `addBar()` that build the ABC representation incrementally.

The fourth key class is `Elem`, which is a catch-all container for any ABC string that isn't a note (like clef changes, key signatures, tempo marks, inline fields). Each Elem has a time position and a string.

#### MusicXML Parsing: Extracting Musical Semantics

The parsing happens hierarchically, mirroring MusicXML's structure. After parsing the XML tree, the code first calls `mkTitle()` to extract file header information (title, composer, copyright) and `doPartList()` to build a hierarchical representation of parts and their groupings (for ABC's %%score directive).

For each `<part>` element in the MusicXML, the parser processes all `<measure>` elements sequentially. Within each measure, the parser iterates through child elements handling different MusicXML element types:

When encountering a `<note>` element, `doNote()` extracts comprehensive information. It determines the voice number from the `<voice>` element (with a Sibelius-specific bug workaround that multiplies by 100 times the staff number). For pitches, it reads `<pitch/step>`, `<pitch/octave>`, and `<pitch/alter>` (the MIDI alteration), with special handling for unpitched percussion notes. Duration comes from `<duration>` elements (in MusicXML division units), and tuplet information is extracted from `<time-modification>` (with `<actual-notes>` and `<normal-notes>` defining the time modification ratio) and `<notations/tuplet>` elements (which have 'start' and 'stop' type attributes for nesting).

The pitch-to-ABC conversion in `ntAbc()` is particularly sophisticated. Because ABC notation uses relative pitch with octave marks (e.g., C, C', c, c') while MusicXML uses absolute pitch (step + octave number), the function must apply the current clef's octave-change value. Accidentals require careful handling: the code maintains `msralts` (measure alterations from the key signature) and `curalts` (passing accidentals within a measure per voice), checking whether an explicit accidental is needed by comparing against both the key signature and previous alterations in the voice. For tied notes, it doesn't add accidentals since they carry from the previous note.

Ornaments and articulations are mapped from MusicXML's `<notations>` hierarchy to ABC decoration syntax using the `note_ornamentation_map` dictionary. For example, `ornaments/trill-mark` becomes 'T', `articulations/staccato` becomes '.', and `articulations/accent` becomes '!>!'. Slurs are more complex because they can span multiple notes and even cross voice boundaries; the `matchSlur()` method uses a `slurBuf` dictionary keyed by slur number to match start and stop elements, only keeping slurs that begin and end in the same voice.

When processing `<attributes>` elements via `doAttr()`, the parser handles meter changes (extracting `<time/beats>` and `<time/beat-type>`), key signatures (reading `<key/fifths>` and calling `setKey()` to compute both the ABC key string like "Gmin" and a dictionary of implied alterations), clef changes (mapping MusicXML clef elements to ABC clef syntax like "treble", "bass", "alto"), and divisions updates (which define the time unit resolution for that measure).

Direction elements (`<direction>`) are processed by `doDirection()` and include tempo markings, dynamics (mapped via `dynamics_map`, e.g., 'pp' → '!pp!'), wedges (crescendo/diminuendo rendered as ABC decorations), words (text expressions), pedal marks, and rehearsal marks. These typically get inserted into the voice at the current time position, with special handling to route them to the appropriate voice based on staff assignment.

Barline elements (`<barline>`) affect measure boundaries and repeats. The parser reads `<bar-style>` (for barline types like double, heavy, light-heavy), `<repeat>` (with direction='forward' for :| and direction='backward' for |:), and `<ending>` (for volta brackets with type='start'/'stop' and number attribute). These get accumulated into the Measure object's `lline`, `rline`, and `lnum` attributes.

#### Time Management and Voice Synchronization

Because MusicXML allows multiple voices per staff and represents time explicitly through division units, the Music class must carefully track time for each voice independently. When a `<note>` element with `<chord>` appears, it doesn't advance time—instead, `addChord()` appends the note to the last note's `ns` list. For normal notes, `appendNote()` advances time by the note's duration. The `<backup>` and `<forward>` elements move the current time position backward or forward respectively, enabling voice layering within a single staff.

The `sortMeasure()` function ensures all items in a voice are properly ordered by time before converting to ABC. This is critical because MusicXML can specify elements out of order (e.g., a direction element might appear after notes it should precede), and ABC requires sequential output.

#### Tuplet Processing: Nested Time Modifications

Tuplet conversion is one of the most complex aspects. MusicXML represents tuplets through a combination of `<time-modification>` (which specifies the actual-notes/normal-notes ratio for playback) and `<notations/tuplet>` markers (which specify start/stop for notation purposes). Because tuplets can nest, the `insTup()` function recursively processes tuplet starts, computing the ABC tuplet notation.

For example, if the outer tuplet is (3:2) and a nested tuplet within it is (3:2) at the current level, the combined ratio becomes (3:2) × (3:2) = (9:4) in musical time. The function walks through notes, counting tuplet elements, handling nested starts recursively, and stopping when it finds the matching 'stop' marker. It then constructs the ABC tuplet prefix string: "(3" for the standard triplet (3:2:3), or the full form "(p:q:r" for other ratios where p=actual notes, q=normal notes, r=count of notes in the group.

#### Rhythm Conversion: From Divisions to ABC Durations

ABC rhythm notation uses a different system than MusicXML's division-based durations. The `abcdur()` function converts by computing a rational duration: (xml_duration × unit_length) / (divisions × 4). This rational is then simplified and formatted into ABC syntax. For example, if the note duration is 480 divisions, the measure uses 480 divisions per quarter, and the unit length L:1/8, then the calculation yields: (480 × 8) / (480 × 4) = 1, meaning the note is exactly one unit length (an eighth note), rendered without an explicit duration number in ABC.

The `mkBroken()` function optimizes output by detecting broken rhythm patterns. When it finds two adjacent beamed notes where one duration is exactly 3× the other, it converts them to broken rhythm notation (< or >) rather than explicit durations. For instance, a dotted eighth followed by a sixteenth becomes "C>D" instead of "C3/2D/2".

#### Multi-Staff and Multi-Voice Organization

The parser maintains complex mappings to handle MusicXML's staff/voice structure. The `locStaffMap()` function analyzes all measures in a part to determine which XML voices belong to which XML staves (since voices can move between staves). It builds `stfMap` (mapping staff numbers to lists of voice numbers) and `vce2stf` (the reverse mapping).

When outputting ABC, the code creates a global voice numbering scheme through `vceCnt`, which increments across all parts to ensure unique voice IDs. The `addStaffMap()` method builds the part structure for ABC's %%score directive, preserving MusicXML's part groups (braces and brackets). This allows ABC renderers to recreate the original score layout.

Voice assignments in ABC use the V: directive, and the code carefully manages when to insert clef changes, key signature changes, and other voice-specific modifications. The `addBar()` method is responsible for finalizing each measure across all voices, ensuring they all have the same time length (padding with invisible rests if needed), handling volta brackets correctly (with the `nvlt` option controlling whether voltas appear on all voices or just the first), and inserting barlines at the correct time positions.

#### Output Generation: Building ABC Strings

The final stage happens in `outVoices()`, which processes all accumulated measures for a part. For each voice with actual notes (empty voices are skipped), it first computes the optimal unit length using `compUnitLength()`, which analyzes all note durations to find the most compact representation. Then for each measure, `outVoice()` generates the ABC string by:

1. Walking through all Note objects, setting tuplet prefixes by calling `insTup()` recursively for nested tuplets
2. For each Note, calling `abcdur()` to compute the rhythm string, prepending decorations from `before`, outputting the note(s) (with '[' ']' for chords), appending the rhythm and tie, and adding `after` content
3. For each Elem, simply outputting its string
4. Managing spacing: beamed notes and notes within beams have no spaces between them, while other elements are space-separated

The accumulated measure strings are then organized into lines, respecting the bars-per-line (`bpl`) or characters-per-line (`cpl`) limits specified by command-line options. Lyrics are output separately after each line of music using w: fields, with measure boundaries marked by | symbols.

Finally, `ABCoutput.mkHeader()` assembles the complete ABC file header. It builds the %%score directive from the staff map, determines the most common unit length across all voices, outputs all V: voice definitions with their clefs, includes MIDI settings if requested, writes page formatting directives if specified, and adds the title, key, and meter fields.

#### Key Algorithmic Challenges

Several aspects of xml2abc are algorithmically complex:

**Accidental Management**: Because ABC notation is relative (accidentals carry within a measure) while MusicXML is absolute (every note specifies its exact pitch), the code must track the accidental state for each pitch in each voice, compare against the key signature, and decide when to emit explicit accidentals, naturals, or nothing.

**Tuplet Nesting**: MusicXML allows arbitrary nesting of tuplets with different time modifications. The recursive `insTup()` function must correctly compute compound ratios, track start/stop markers across nested levels, and generate ABC's linear tuplet syntax.

**Broken Rhythm Detection**: The `mkBroken()` function must scan beamed note sequences looking for the specific 3:1 duration ratio pattern, verify the notes aren't in tuplets, and rewrite both the durations and the Note's `after` field to use < or > symbols.

**Voice and Staff Assignment**: With MusicXML's flexible voice/staff model (voices can switch staves mid-piece, one staff can contain multiple voices), the parser must analyze the entire part first, determine stable voice→staff mappings, track current staff per voice, and insert I:staff directives when voices move between staves.

**Time Synchronization**: Because different voices can have different durations in a measure (especially with grace notes, invisible rests, or notation errors), the code tracks `maxtime` (the longest voice) and `vtimes` (end time per voice), ensures all voices reach the same endpoint, and sorts all elements by time before output.

### For XML to ABC Implementation in TypeScript

Because we need to implement XML to ABC conversion in our TypeScript codebase, we face several architectural decisions. We have an existing ABC parser pipeline that produces a strongly-typed AST and an interpreter that transforms that AST into a semantic representation. The question is whether to port xml2abc's approach or leverage our existing infrastructure.

#### Option 1: Direct Port of xml2abc

We could port the xml2abc Python implementation relatively directly to TypeScript. This would involve:

**XML Parsing**: TypeScript has several XML parsing libraries available:
- `fast-xml-parser`: A lightweight, fast parser that converts XML to JavaScript objects
- `xml2js`: A mature library that parses XML into JavaScript objects with callback-based API
- `@xmldom/xmldom`: A DOM implementation similar to browser's DOMParser, closest to Python's ElementTree

Since xml2abc uses ElementTree's simple `findall()`, `findtext()`, `find()`, and `get()` API, `fast-xml-parser` or `xml2js` would require more adaptation. The `@xmldom/xmldom` library with its DOM API would map more directly to the ElementTree usage pattern, but we'd need to adapt the traversal code to use DOM methods instead of ElementTree's Python-style iteration.

**Data Structure Translation**: The Note, Measure, Music, and Elem classes would translate straightforwardly to TypeScript classes. We'd use proper TypeScript types: `tijd: number`, `dur: number`, `fact: [number, number] | null`, `tup: string[]`, `before: string[]`, `ns: string[]`, `lyrs: Record<number, string>`, etc. The Python dictionaries become TypeScript `Map` or `Record` types, and lists become arrays.

**Algorithm Translation**: The core algorithms (key signature calculation, duration conversion, tuplet processing, broken rhythm detection, accidental management) would port relatively directly since Python and TypeScript have similar control flow. The main differences would be:
- Python's dynamic typing vs TypeScript's static types (which is actually beneficial for catching errors)
- Python's tuple unpacking vs TypeScript's array destructuring
- Python's default parameters work similarly in TypeScript
- Python's list comprehensions become array methods like `map()`, `filter()`, and `reduce()`

**Complexity Estimate for Direct Port**: Approximately 2000-2500 lines of TypeScript (the Python is 1586 lines, but TypeScript often needs more due to type annotations). The translation would be largely mechanical for the core algorithms, but the XML parsing adaptation would require careful work to ensure we read MusicXML correctly. Testing would be critical because the Python version has been refined over years with many real-world MusicXML files from different notation programs (MuseScore, Sibelius, Finale, etc.), each with their own quirks.

#### Option 2: Build on Our Existing Parser Infrastructure

Alternatively, we could leverage the fact that we already have a complete ABC parser and AST. The conversion workflow would be:
1. Parse MusicXML into a JavaScript/TypeScript representation
2. Transform that representation into our ABC AST node types
3. Use our existing `AbcFormatter` to generate ABC notation strings

This approach has significant advantages: we already have a proven ABC AST that represents all ABC constructs correctly, and our `AbcFormatter` handles the serialization logic. The work would focus on the MusicXML → ABC AST transformation.

**However**, this has a critical architectural mismatch. Our ABC AST is designed for **parsing text into a tree**, not for **generating trees from semantic data**. The AST nodes require Token objects from our scanner, and those tokens contain lexeme strings, source positions, and line numbers. To generate our AST from MusicXML, we'd need to either:

- Create "fake" tokens for every ABC element we generate (note letters, octave marks, rhythms, accidentals, barlines, decorations), assigning them lexeme strings, positions, and line numbers that don't correspond to any source text
- Or extend our AST to support an alternative "semantic mode" where nodes can exist without tokens

Neither option is clean. The first option (fake tokens) is hacky and would produce misleading position information for any code that tries to use the AST for location-based features (like an LSP). The second option (dual-mode AST) adds complexity to every AST node and visitor.

#### Option 3: Generate ABC Strings Directly

A third option: parse MusicXML into an intermediate representation, then generate ABC notation strings directly using a dedicated MusicXML→ABC converter class, without going through our AST. This would be similar to xml2abc's approach but specifically adapted to TypeScript.

The intermediate representation would be simpler than full AST nodes—just enough to hold the semantic information:
```typescript
interface MXNote {
  pitch?: { step: string; octave: number; alter?: number };
  duration: number;
  isRest: boolean;
  isChord: boolean;
  decorations: string[];
  lyrics: Record<number, string>;
  tupletFactor?: [number, number];
  beamed: boolean;
  tie?: boolean;
  // ... other properties
}

interface MXMeasure {
  notes: MXNote[];
  barline: string;
  attributes?: { clef?: string; key?: string; meter?: string };
  // ... other properties
}
```

Then a `MusicXMLToABC` class would have methods like:
```typescript
class MusicXMLToABC {
  convertNote(note: MXNote, divisions: number, unitLength: number): string { ... }
  convertMeasure(measure: MXMeasure): string { ... }
  buildTuneHeader(metadata: MXMetadata): string { ... }
}
```

This approach is the cleanest architecturally. It doesn't force-fit MusicXML data into an AST designed for parsing, and it gives us full control over the ABC generation logic. The downside is we can't reuse `AbcFormatter`, but given the architectural mismatch, that's actually not a significant loss.

#### Recommendation Analysis

**Porting Complexity**: The xml2abc codebase is mature and handles many edge cases from various notation software. A direct port would preserve this battle-tested logic. The main implementation challenges are:

1. **XML Parsing Adaptation**: We need to choose an XML library and adapt xml2abc's ElementTree traversal patterns. Estimated effort: 3-5 days.

2. **Core Algorithm Translation**: The Note, Measure, Music classes and core functions like `doNote()`, `doAttr()`, `outVoice()`, `insTup()`, `mkBroken()`, `abcdur()`, and `ntAbc()` would port relatively mechanically. Estimated effort: 5-7 days.

3. **Edge Case Handling**: xml2abc has special handling for Sibelius bugs, percussion notation, tablature, multiple time modifications, measure repeats, pedal marks, dynamics placement, and many other details. Each needs careful translation and testing. Estimated effort: 4-6 days.

4. **Testing Against Real Files**: We'd need a substantial test corpus of MusicXML files from different sources to verify correctness. xml2abc has been tested on thousands of files over many years. Estimated effort: 5-8 days.

**Total Estimated Effort for Direct Port**: 17-26 days of focused development and testing.

**Alternative Implementation Complexity**: Building on our AST would require:
1. Generating fake tokens (2-3 days) or extending the AST for semantic mode (4-6 days)
2. MusicXML parsing and transformation to AST (6-8 days)
3. Handling the semantic mismatch issues (3-5 days)
4. Testing (5-8 days)

**Total Estimated Effort for AST-Based Approach**: 16-27 days, with higher architectural complexity and unclear benefits.

**Direct String Generation Complexity**:
1. MusicXML parsing (4-5 days)
2. Intermediate representation design (2-3 days)
3. ABC string generation logic (8-10 days)
4. Testing (5-8 days)

**Total Estimated Effort**: 19-26 days.

### Technical Reference: Key Functions and Data Structures

#### XML Parsing Entry Point
```python
def parse(s, fobj):
    e = E.parse(fobj)  # Parse entire MusicXML document
    s.mkTitle(e)       # Extract title, composer, etc.
    s.doDefaults(e)    # Extract page formatting defaults
    partlist = s.doPartList(e)  # Build part hierarchy for %%score
    parts = e.findall('part')
    for ip, p in enumerate(parts):
        maten = p.findall('measure')
        # ... process all measures
```

#### Core Data Classes
```python
class Note:
    tijd: int              # Time position in divisions
    dur: int               # Duration in divisions
    fact: Tuple[int, int]  # Tuplet ratio (actual, normal)
    tup: List[str]         # Tuplet start/stop markers
    tupabc: str           # ABC tuplet string like "(3"
    beam: int             # Beaming flag
    grace: int            # Grace note flag
    before: List[str]     # Decorations before note
    after: str            # Tie, fermata after note
    ns: List[str]         # Note pitches (list for chords)
    lyrs: Dict[int, str]  # Lyrics by verse number
    tab: Tuple[str, str]  # Tablature (string, fret)
    ntdec: str            # Note decorations

class Measure:
    ixp: int    # Part number
    ixm: int    # Measure number
    mdur: int   # Measure duration in divisions
    divs: int   # Divisions per quarter note
    mtr: Tuple[int, int]  # Time signature (beats, beat-type)
    attr: str   # Measure attributes (key, clef, meter changes)
    lline: str  # Left barline (repeat start)
    rline: str  # Right barline
    lnum: str   # Volta number

class Music:
    tijd: int           # Current time position
    maxtime: int        # Maximum time in current measure
    gMaten: List[Dict]  # All measures: [{voice: [Note|Elem]}]
    gLyrics: List[Dict] # All lyrics: [{voice: {num: (str, melis)}}]
    vnums: Dict         # Voice IDs in this part
    vceCnt: int         # Global voice counter
```

#### Pitch Conversion
```python
def ntAbc(s, ptc, oct, note, v, ntrec, isTab):
    """Convert MusicXML pitch to ABC notation

    Args:
        ptc: Pitch step (C, D, E, F, G, A, B)
        oct: Octave number (4 is middle octave)
        note: XML note element
        v: Voice number
        ntrec: Note record
        isTab: Tablature flag

    Returns:
        ABC note string like "^c'" for C#5
    """
    # Apply clef octave change
    oct += s.clefOct.get(s.curStf[v], 0)

    # Get alteration from XML or infer from context
    alt = note.findtext('pitch/alter')
    if alt is None and s.msralts.get(ptc, 0):
        alt = 0  # Natural needed (key has alteration)
    if alt is None and (p, v) in s.curalts:
        alt = 0  # Natural needed (previous note had alteration)

    # Check if tied note (no accidental needed)
    tieElms = note.findall('tie') + note.findall('notations/tied')
    if 'stop' in [e.get('type') for e in tieElms]:
        return p  # Don't alter tied notes

    # Build ABC pitch: accidental + letter + octave
    p = addoct(ptc, oct)  # e.g., "c'" for C5
    if alt:
        s.curalts[(p, v)] = alt
        p = ['__', '_', '=', '^', '^^'][alt+2] + p
    return p
```

#### Duration Conversion
```python
def abcdur(nx, divs, uL):
    """Convert MusicXML duration to ABC rhythm string

    Args:
        nx: Note object with dur, fact (tuplet ratio)
        divs: Divisions per quarter note
        uL: Unit length denominator (from L:1/uL)

    Returns:
        ABC rhythm string like "3/2" or "/4" or ""
    """
    if nx.grace: return '0'

    # Basic conversion: (duration * unitLength) / (divisions * 4)
    d = nx.dur * uL
    div = divs * 4

    # Simplify fraction
    a, b = simplify(d, div)

    # Format as ABC rhythm
    if a == 1 and b == 1: return ''      # Unit length
    if a == 1 and b == 2: return '/'     # Half
    if a == 1: return '/%d' % b          # 1/b
    if b == 1: return '%d' % a           # a
    return '%d/%d' % (a, b)              # a/b
```

#### Tuplet Processing
```python
def insTup(ix, notes, fact):
    """Recursively process nested tuplets

    Args:
        ix: Index of tuplet start note
        notes: List of Note objects
        fact: Parent tuplet ratio (num, den)

    Returns:
        (end_index, note_count)
    """
    nx = notes[ix]
    fn, fd = fact
    fnum, fden = nx.fact
    tupfact = fnum//fn, fden//fd  # Compound ratio

    tupcnt = 0
    while ix < len(notes):
        nx = notes[ix]
        if 'start' in nx.tup:
            ix, count = insTup(ix, notes, tupfact)  # Recurse
            tupcnt += count
        elif nx.fact:
            tupcnt += 1
        if 'stop' in nx.tup:
            break
        ix += 1

    # Build ABC tuplet prefix
    tup = (tupfact[0], tupfact[1], tupcnt)
    if tup == (3, 2, 3):
        notes[ix].tupabc = '(3' + notes[ix].tupabc
    else:
        notes[ix].tupabc = '(%d:%d:%d' % tup + notes[ix].tupabc

    return ix, tupcnt
```

#### Key Signature Calculation
```python
def setKey(fifths, mode):
    """Calculate ABC key string and alterations

    Args:
        fifths: Number of sharps (positive) or flats (negative)
        mode: Mode string ('major', 'minor', 'mixolydian', etc.)

    Returns:
        (key_string, alterations_dict)
        e.g., ('Gmin', {'E': -1, 'B': -1})
    """
    sharpness = ['Fb','Cb','Gb','Db','Ab','Eb','Bb','F','C',
                 'G','D','A','E','B','F#','C#','G#','D#','A#','E#','B#']
    offTab = {'maj':8, 'min':11, 'mix':9, 'dor':10,
              'phr':12, 'lyd':7, 'loc':13}

    mode = mode.lower()[:3]
    key = sharpness[offTab[mode] + fifths]
    if offTab[mode] != 8:  # Not major
        key += mode

    # Build alterations dict
    accs = ['F','C','G','D','A','E','B']  # Circle of fifths
    if fifths >= 0:
        msralts = {acc: 1 for acc in accs[:fifths]}
    else:
        msralts = {acc: -1 for acc in accs[fifths:]}

    return key, msralts
```

#### Measure Processing
```python
def parse(s, fobj):
    # ... setup ...
    for ip, p in enumerate(parts):
        maten = p.findall('measure')
        s.msr = Measure(ip)

        while s.msr.ixm < len(maten):
            maat = maten[s.msr.ixm]
            s.msr.reset()
            s.curalts = {}  # Reset accidentals each measure

            for e in maat.getchildren():
                if e.tag == 'note':
                    s.doNote(e)
                elif e.tag == 'attributes':
                    s.doAttr(e)
                elif e.tag == 'direction':
                    s.doDirection(e, i, es)
                elif e.tag == 'barline':
                    herhaal = s.doBarline(e)
                elif e.tag == 'backup':
                    s.msc.incTime(-int(e.findtext('duration')))
                elif e.tag == 'forward':
                    s.msc.incTime(int(e.findtext('duration')))

            s.msc.addBar(lbrk, s.msr)  # Finalize measure
            s.msr.ixm += 1
```

#### File Locations and Dependencies

**Source Files**:
- Main implementation: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/xml/xml2abc/xml2abc.py`
- Setup: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/xml/xml2abc/setup.py`
- Changelog: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/xml/xml2abc/xml2abc_changelog.html`

**Dependencies**:
- Python standard library only: `xml.etree.ElementTree`, `math`, `os`, `re`, `sys`, `types`, `glob`, `optparse`, `zipfile`
- No external dependencies required

**Our ABC Parser Infrastructure** (relevant for understanding potential integration):
- Parser: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/parsers/parse2.ts`
- AST Types: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/types/Expr2.ts`
- Formatter: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/Visitors/Formatter2.ts`
- Interpreter: `/Users/antoine/Documents/personnel/experiments/abc/abc_parse/parse/interpreter/TuneInterpreter.ts`

**TypeScript XML Parsing Options**:
- `fast-xml-parser` (npm): Fast, lightweight, converts to JS objects
- `xml2js` (npm): Mature, callback-based
- `@xmldom/xmldom` (npm): DOM implementation, closest to ElementTree
- Native browser DOMParser (for browser environment)

### Configuration and Options

xml2abc supports numerous command-line options that would need equivalent configuration in our TypeScript implementation:

- `-u`: Unfold simple repeats
- `-m [0|1|2]`: MIDI settings output (0=none, 1=minimal, 2=all)
- `-c C`: Credit text filter level
- `-d D`: Set unit length L:1/D explicitly
- `-n CPL`: Max characters per line
- `-b BPL`: Max bars per line
- `-o DIR`: Output directory
- `-v V`: Volta typesetting behavior (0=all voices, 1=first voice only, 2=first voice per part, 3=lowest voice in part 0)
- `-x`: No line breaks
- `-p PFMT`: Page format (scale, height, width, margins)
- `-j`: JavaScript version compatibility
- `-t`: Translate percussion/tab to ABC %%map
- `-s`: Shift noteheads (tablature option)
- `--v1`: Route start/stop directions to first voice of staff
- `--noped`: Skip pedal directions
- `--stems`: Translate stem directions

## User Notes
The user provided the reference implementation at https://github.com/SpotlightKid/xml2abc for investigation.

The xml2abc codebase has been copied locally to the xml directory for analysis.

## Work Log
<!-- Updated as work progresses -->
