# ABC Parser & Language Server

A TypeScript parser and Language Server for ABC music notation. Implements the [ABC 2.2 standard](https://abcnotation.com/wiki/abc:standard:v2.2) with extensions from [ABCJS](https://github.com/paulrosen/abcjs).

This monorepo contains two packages:
- **`parse/`** - Parser library for ABC notation
- **`abc-lsp-server/`** - Language Server providing IDE features

## Goals

Build a complete IDE for ABC music notation, focused on small scores (transcriptions, lead sheets).

1. Provide syntax highlighting, formatting, and semantic analysis
2. Support CLI operations (part extraction, transposition, format conversion)
3. Match ABCJS output exactly to enable substitution in rendering pipelines
4. Extend ABC standard while maintaining renderability

This project does not provide playback or sheet music rendering.

## Installation & Usage

### Install Dependencies

```bash
npm install
```

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

Build outputs: `out/parse/` (parser, standalone) and `out/abc-lsp-server/` (LSP server, requires parser).

### Using the Parser as a Library

```typescript
import { parse, Scanner2, ABCContext, AbcFormatter } from "abc-parser";

const source = `X:1\nT:Example\nK:C\nCDEF|`;
const ctx = new ABCContext();
const tokens = Scanner2(source, ctx);
const ast = parse(tokens, ctx);

// Format the parsed AST
const formatter = new AbcFormatter(ctx);
const formatted = formatter.format(ast);
console.log(formatted);
```

### Using the LSP Server

Integrate the LSP server with editor clients like [AbcLsp](https://github.com/AntoineBalaine/AbcLsp).

**Features:**
- Diagnostics (errors and warnings)
- Semantic tokens (syntax highlighting)
- Document formatting (barline alignment for multi-voice systems)
- Completions (decoration symbols triggered by `!`)
- Custom commands: `divideRhythm`, `multiplyRhythm`, `transposeUp`, `transposeDn`

### Using the CLI

```bash
# Render ABC to SVG
node out/abc-cli/abcls-cli.js render file.abc > output.svg

# Render specific tunes by X: number
node out/abc-cli/abcls-cli.js render file.abc -t 1,2,3 > output.svg

# Format ABC files
node out/abc-cli/abcls-cli.js format file.abc

# Check ABC files for errors
node out/abc-cli/abcls-cli.js check file.abc
```

Note: SVG rendering via the CLI is experimental. The server-side DOM implementation (svgdom) has known inaccuracies in bounding box calculations (~15% deviation from browser values), which may cause minor positioning issues with text elements (lyrics, chord symbols) and path elements (slurs, ties). For production rendering, use abcjs directly in a browser environment.

## Architecture

### Parser Pipeline

```
Source Text → Scanner → Tokens → Parser → AST → Visitors
                                            ↓
                                   Semantic Analysis
```

**Components:**

1. **Scanner**: Tokenizes ABC notation (`scan2.ts`, `scan_tunebody.ts`, `scanInfoLine2.ts`, `scanDirective.ts`)
2. **Parser**: Builds AST from tokens (`parse2.ts`, `parseInfoLine2.ts`, `parseDirective.ts`)
3. **AST Types**: Strongly-typed nodes (`types/Expr2.ts`)
4. **Semantic Analyzer**: Validates info lines and directives (`info-line-analyzer.ts`, `directive-analyzer.ts`)
5. **Visitors**: Transform AST (`Formatter2.ts`, `RhythmTransform.ts`, `Transposer.ts`, `RangeVisitor.ts`, `RangeCollector.ts`)

### ABC Standard Support

Implements ABC 2.2 standard with ABCJS extensions.

**Supported:**
- Basic notation (notes, rhythms, chords, beams, tuplets)
- Info lines (X, T, K, M, L, etc.)
- Directives (`%%` commands)
- Decorations (standard and ABCJS)
- Redefinable symbols (`U:`)
- Comments, barlines, repeats, grace notes
- Lyrics, multi-voice music, voice modifiers
- Field continuation (`+:`)

**Missing:**
- Macros (`m:`)
- Free text blocks (`%%begintext`/`%%endtext`)
- Voice overlay line continuation (`&\` at EOL)

## Compatibility with ABCJS

Aims for 1:1 output compatibility with ABCJS to enable parser substitution in rendering pipelines, ABC standard extensions, and property-based testing.

**Status:** Experimental. Tune headers match ABCJS output; music body compatibility is in progress.

**Rationale:** ABCJS lacks static typing and tightly couples lexing, parsing, and interpretation, making it unsuitable for IDE features (syntax highlighting, formatting, diagnostics, completions).

## Development

```bash
# Run tests
npm run test
npm run test:coverage

# Lint
npm run lint

# Parse ABC files
npm run parse-folder -- /path/to/your/abc/files
```

## Contributing

```bash
git clone <repo-url>
cd abc_parse
npm install
npm run build
```

Uses TypeScript with strict checking. Tests use Mocha and fast-check.

### Monorepo Structure

Uses npm workspaces for shared dependencies.

```
abc_parse/
├── parse/              # Parser (parsers/, Visitors/, analyzers/, types/)
├── abc-lsp-server/     # LSP server (server.ts, AbcLspServer.ts, AbcDocument.ts, completions.ts)
└── out/                # Build output
```

## Docker

Run Claude Code in a Docker container:

```bash
# Build the image
docker build -t abc-claude .

# Run the container with the workspace mounted
docker run -it -v $(pwd):/workspace abc-claude
```

## TODO

### Parser
- `H:` history and free text
- Voice overlay line continuation (`&\` at EOL)
- Complete voice overlays (`&` in tune body)
- Linebreak directives
- Line continuations (`\\n`)
- Improve macro support (`m:`)

### Formatter
- Group tuplets as beams in rules resolution
- Warn about incomplete voice overlay markers
- Mark incomplete bars

### Standard Extensions
- `.//.` symbol for repeat two previous bars
- Chord symbol lines: `x: am | g | c | f/ e/g/ :|2`
- Chord symbols in `W:` lines
- Score formatting with `!` system breaks

### Format Conversion
- MusicXML to ABC conversion (research porting xml2abc or alternative approaches)
- ABC to MusicXML conversion (research porting abc2xml or leveraging existing parser pipeline)

## Related Projects

- [AbcLsp](https://github.com/AntoineBalaine/AbcLsp) - LSP client implementation
- [ABCJS](https://github.com/paulrosen/abcjs) - ABC notation rendering library
- [ABC Notation Standard](https://abcnotation.com/wiki/abc:standard:v2.2)
