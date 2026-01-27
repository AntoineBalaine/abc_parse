# ABC Kakoune Plugin

This plugin integrates ABC notation selectors with Kakoune, enabling AST-level pattern matching as native multi-selections.

## Features

- AST-based selection of ABC musical elements (notes, chords, rests)
- Selector narrowing and composition
- Integration with kak-lsp for standard LSP features (diagnostics, completions, hover, formatting)

## Installation

1. Add the `rc/` directory to your Kakoune autoload path:

```bash
ln -s /path/to/abc-kak/rc ~/.config/kak/autoload/abc
```

2. Configure kak-lsp by adding the ABC LSP server to your `kak-lsp.toml` (see `kak-lsp.toml.example`).

3. Ensure the ABC LSP server is built and accessible:

```bash
cd /path/to/abc_parse/abc-lsp-server
npm install
npm run build
```

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

Tests use kak-spec. To run:

```bash
cd abc-kak
kak-spec spec/*.kak-spec
```
