# ABC Kakoune Plugin

This plugin integrates ABC notation selectors with Kakoune, enabling AST-level pattern matching as native multi-selections.

## Features

- AST-based selection of ABC musical elements (notes, chords, rests)
- Selector narrowing and composition
- Integration with kak-lsp for standard LSP features (diagnostics, completions, hover, formatting)

## Installation

1. Build the bundled LSP server:

```bash
cd /path/to/abc_parse
npm install
npm run build:kak
```

This creates `abc-kak/dist/server.js`, a self-contained bundle with all dependencies.

2. Add the `rc/` directory to your Kakoune autoload path:

```bash
ln -s /path/to/abc-kak/rc ~/.config/kak/autoload/abc
```

3. Configure kak-lsp by adding the ABC LSP server to your `kak-lsp.toml` (see `kak-lsp.toml.example`). Update the path to point to your `abc-kak/dist/server.js`.

## Configuration

The plugin provides the following options:

- `abc_client_cmd`: Path to the abc-kak-client.js script (auto-detected relative to plugin)
- `abc_socket_path`: Unix socket path for ABC LSP server communication (auto-computed)
- `abc_timeout`: Request timeout in milliseconds (default: 5000)

## Commands

### Type Selectors

- `abc-select-chords`: Select all chord nodes
- `abc-select-notes`: Select all note nodes
- `abc-select-non-chord-notes`: Select notes not inside chords
- `abc-select-chord-notes`: Select notes inside chords
- `abc-select-rests`: Select all rest nodes

### Rhythm Selectors

- `abc-select-rhythm`: Select all rhythm expressions (e.g., /2, 3, 3/2)
- `abc-select-rhythm-parent`: Select notes, chords, rests, or spacers with explicit rhythm

### Structure Selectors

- `abc-select-tune`: Select individual tunes (for multi-tune files)

### Chord Note Selectors

- `abc-select-top`: Select the top note of each chord
- `abc-select-bottom`: Select the bottom note of each chord
- `abc-select-nth-from-top N`: Select the Nth note from top (0-indexed)
- `abc-select-all-but-top`: Select all notes except the top of each chord
- `abc-select-all-but-bottom`: Select all notes except the bottom of each chord

### State Management

- `abc-select-reset`: Clear stored cursor node IDs (breaks narrowing chain)

## Selector Narrowing

Selectors can be chained to narrow results:

1. `abc-select-chords` - Select all chords
2. `abc-select-top` - Narrow to top note of each selected chord
3. (edit as needed)

The narrowing chain is automatically cleared when:
- The buffer is modified
- Selections change (user moves cursor or uses standard Kakoune motions)

Use `abc-select-reset` to manually clear the narrowing state.

## Limitations

- Selectors only work with `.abc` files, not `.abcx` files
- Requires kak-lsp for full LSP integration
- The first Kakoune session to open an ABC file owns the socket; closing that session may affect selectors in other sessions

## Testing

Tests use Mocha/Chai with a custom `KakouneSession` helper that runs Kakoune in headless daemon mode.

### Running Tests

```bash
# From monorepo root
npm test -w abc-kak

# Or from abc-kak directory
npm test
```

### How It Works

Because Kakoune requires a TTY for its UI, we cannot run it directly for automated testing. Instead, we use a headless daemon pattern:

1. Start a Kakoune daemon: `kak -d -s <session>`
2. Send commands via: `kak -p <session>`
3. Capture results via a named FIFO (blocking read for synchronization)

The `KakouneSession` class in `test/helpers/kakoune-session.ts` wraps this pattern:

```typescript
import { KakouneSession } from './helpers/kakoune-session';

describe('my test', () => {
  let kak: KakouneSession;
  let testFile: string;

  beforeEach(() => {
    kak = new KakouneSession();
    testFile = `/tmp/test-${kak.session}.abc`;
    kak.start();
  });

  afterEach(() => {
    kak.cleanup();
    unlinkSync(testFile);
  });

  it('selects a note', () => {
    writeFileSync(testFile, 'X:1\nK:C\nCDEF\n');
    kak.edit(testFile);

    // executeAndQuery combines key execution with state query
    // in a single call to preserve selection state
    const selection = kak.executeAndQuery('gg2j', '$kak_selection');

    expect(selection).to.equal('C');
  });
});
```

### Key Methods

- `start()` / `cleanup()` - session lifecycle
- `edit(path)` - open a file (sets current buffer context)
- `executeKeys(keys)` - run execute-keys in buffer context
- `executeAndQuery(keys, expr)` - execute keys and query state in a single call
- `getSelection()` / `getSelections()` / `getSelectionsDesc()` - query helpers

### Legacy kak-spec Tests

The `spec/` directory contains older kak-spec tests. To run them:

```bash
kak-spec spec/*.kak-spec
```
