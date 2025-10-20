# ABC Parser & Language Server

A full-fledged ABC notation parser and Language Server Protocol (LSP) implementation based on the [ABC 2.2 standard](https://abcnotation.com/wiki/abc:standard:v2.2), with extensions inspired by [ABCJS](https://github.com/paulrosen/abcjs).

This monorepo contains two related packages:
- **`parse/`** - A TypeScript parser library for ABC music notation
- **`abc-lsp-server/`** - A Language Server implementation providing IDE features

## Project Vision

This project aims to create a comprehensive IDE experience for ABC music notation, with a focus on smaller-sized scores (transcriptions, lead sheets, etc.). The full suite of formatting, custom commands, semantic tokens, semantic analysis, and rendering makes writing scores with a computer keyboard practical and efficient.

**Key Goals:**
1. Build a complete IDE for ABC notation with syntax highlighting, formatting, and analysis
2. Provide CLI-level capabilities (part extraction, transposition, format conversion)
3. Achieve 1:1 output compatibility with ABCJS parser to enable substitution in the rendering pipeline
4. Extend the ABC standard with practical features while maintaining renderability

**Non-goals:**
- Playback capabilities (ABC is a markup notation, not a programming language)
- Sheet music rendering (I will NOT implement a rendering library)

## Installation & Usage

### Install Dependencies

```bash
npm install
```

This installs all dependencies for both packages at the root level.

### Building

```bash
# Build both packages
npm run build

# Build parser only
npm run build:parse

# Build LSP server only
npm run build:lsp

# Watch mode for development
npm run watch:parse
npm run watch:lsp
```

### Build Outputs

- **Parser library**: `out/parse/` (can be built and used independently)
- **LSP server**: `out/abc-lsp-server/` (depends on the parser)

### Using the Parser as a Library

```typescript
import { parse, Scanner2, ABCContext, AbcFormatter2 } from "abc-parser";

const source = `X:1\nT:Example\nK:C\nCDEF|`;
const ctx = new ABCContext();
const tokens = Scanner2(source, ctx);
const ast = parse(tokens, ctx);

// Format the parsed AST
const formatter = new AbcFormatter2(ctx);
const formatted = formatter.format(ast);
console.log(formatted);
```

### Using the LSP Server

The LSP server is meant to be integrated with editor clients such as [](https://github.com/AntoineBalaine/AbcLsp).

**LSP Features:**
- ✅ Diagnostics (errors and warnings)
- ✅ Semantic tokens (syntax highlighting)
- ✅ Document formatting (with barline alignment for multi-voice systems)
- ✅ Completions (decoration symbols triggered by `!`)

**Custom Commands:**
- `divideRhythm` / `multiplyRhythm` - Transform note durations
- `transposeUp` / `transposeDn` - Transpose by octave

## Architecture

### Parser Pipeline

```
Source Text → Scanner (scan2.ts) → Tokens → Parser (parse2.ts) → AST → Visitors (Formatter, etc.)
                                                                  ↓
                                                         Semantic Analysis
```

**Key Components:**

1. **Scanner (Lexer)**: Tokenizes ABC notation into typed tokens
   - `scan2.ts` - Main scanner
   - `scan_tunebody.ts` - Tune body specific scanning
   - `scanInfoLine2.ts` / `scanDirective.ts` - Info line and directive scanning

2. **Parser**: Builds an Abstract Syntax Tree (AST) from tokens
   - `parse2.ts` - Main parser
   - `parseInfoLine2.ts` / `parseDirective.ts` - Info line and directive parsing

3. **AST Types**: Strongly-typed expression nodes (`types/Expr2.ts`)

4. **Semantic Analyzer**: Validates info lines and directives grammar
   - `info-line-analyzer.ts` - Info line validation
   - `directive-analyzer.ts` - Directive validation

5. **Visitors**: Operate on the AST
   - `Formatter2.ts` - Pretty printer with barline alignment
   - `RhythmTransform.ts` - Rhythm manipulation
   - `Transposer.ts` - Note transposition
   - `RangeVisitor.ts` / `RangeCollector.ts` - Source range utilities

### ABC Standard Support

The parser respects most of the ABC 2.2 standard and follows ABCJS extensions where practical.

**Implemented Features:**
- ✅ Basic notation (notes, rhythms, chords, beams, tuplets)
- ✅ Info lines (tune headers: X, T, K, M, L, etc.)
- ✅ Directives (`%%` commands)
- ✅ Decorations (all standard and ABCJS decorations)
- ✅ Redefinable symbols (`U:`)
- ✅ Comments
- ✅ Barlines and repeats
- ✅ Grace notes
- ✅ Lyrics (in-tune lyric lines)
- ✅ Multi-voice music
- ✅ Voice modifiers
- ✅ Field continuation (`+:` for multi-line fields)

**Not Yet Implemented:**
- ❌ Macros (`m:` - experimental, unstable)
- ❌ Free text blocks (`%%begintext` / `%%endtext`)
- ❌ Voice overlay line continuation (`&\` at end of line)

## Compatibility with ABCJS

This project aims for 1:1 output compatibility with ABCJS parser. This would enable:
- Substituting this parser in the ABCJS rendering pipeline (or using another renderer, for that matter…)
- Adding extensions to the ABC standard while maintaining renderability
- Leveraging static typing and property-based testing

**Current Status:** Experimental - tune header parsing matches ABCJS output. Music body compatibility is a work in progress.

**Why build a separate parser?**
- ABCJS is the canonical ABC rendering library but lacks static typing
- ABCJS integrates lexer/parser/interpreter all in one step, making it hard to reuse for non-rendering tasks - such as IDE features (syntax highlighting, formatting, in-score warnings, completions, etc.).

## Development

### Running Tests

```bash
# Run parser tests
npm run test

# Run tests with coverage
npm run test:coverage
```

### Linting

```bash
npm run lint
```

### Parsing ABC Files

```bash
# Parse a folder of ABC files
npm run parse-folder -- /path/to/your/abc/files
```

## Contributing

Contributions are welcome! The project should be straightforward to set up:

```bash
git clone <repo-url>
cd abc_parse
npm install
npm run build
```

The codebase uses TypeScript with strict type checking. Tests use Mocha and property-based testing with fast-check.

### Monorepo Structure

This repository uses **npm workspaces** to manage both packages in a single monorepo with shared dependencies.

```
abc_parse/
├── parse/                  # Parser package
│   ├── parsers/           # Scanner and parser implementations
│   ├── Visitors/          # AST visitors (formatter, transformers)
│   ├── analyzers/         # Semantic analysis
│   ├── types/             # AST type definitions
│   └── package.json       # Parser package config
├── abc-lsp-server/        # Language Server package
│   ├── src/
│   │   ├── server.ts      # LSP server entry point
│   │   ├── AbcLspServer.ts # Server implementation
│   │   ├── AbcDocument.ts  # Document management
│   │   └── completions.ts  # Completion providers
│   └── package.json       # LSP package config
├── out/
│   ├── parse/             # Built parser library
│   └── abc-lsp-server/    # Built LSP server
└── package.json           # Root workspace config
```

## TODO List

### Parser (scan2) TODOs:
- `%%begintext` free text blocks until `%%endtext`
- `H: history` and free text parsing
- Voice overlay line continuation (`&\` at EOL)
- (very low priority )Improve macro support (`m:` - currently unstable)

### Info Lines TODOs:
- Replace MeterFraction type with RationalNumber
- Scanner should preserve `=` and `/` tokens in key/value pairs
- Formatter should handle comments in info lines without including them in InfoLine expressions

### Formatter TODOs:
- fix voice/system detection logic (some multi-voice scores are getting aligned where they shouldn’t)
- Group tuplets as beams in formatter's rules resolution step
- Warn about incomplete voice overlay markers
- (very low priority) Mark incomplete bars with warnings in the IDE

### want to add (to the standard): 
- `.//.` symbol for «repeat two previous bars»
- Chord symbol lines: `x: am | g | c | f/ e/g/ :|2`
- Chord symbols in `W:` lines
- Score formatting with `!` system breaks

## Related Projects

- [AbcLsp](https://github.com/AntoineBalaine/AbcLsp) - LSP client implementation
- [ABCJS](https://github.com/paulrosen/abcjs) - ABC notation rendering library
- [ABC Notation Standard](https://abcnotation.com/wiki/abc:standard:v2.2)
