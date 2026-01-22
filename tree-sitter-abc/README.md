# tree-sitter-abc

TreeSitter grammar for ABC music notation.

## Build Dependencies

This package requires native compilation. Before building, ensure you have:

### Ubuntu/Debian
```bash
sudo apt-get install -y build-essential libpcre2-dev pkg-config
```

### macOS
```bash
brew install pcre2 pkg-config
```

### Windows
Use vcpkg to install PCRE2, or build manually.

## Building

```bash
# From this directory
npm install
npm run build

# Or from the monorepo root
npm run build:treesitter
```

## Architecture

This grammar uses a custom external scanner (`src/scanner.c`) that mirrors the
architecture of the TypeScript scanner in `parse/parsers/scan2.ts`. The scanner
uses PCRE2 for regex pattern matching, enabling the same pattern-based approach
as the TypeScript implementation.

All 84 token types from the TypeScript TT enum are handled by the external
scanner, giving full control over tokenization behavior including context-
sensitive constructs like macros and user-defined symbols.

## Testing

Tests are run via the comparison framework in `parse/comparison/`, which
validates that TreeSitter output matches the TypeScript parser output using
a child-sibling tree representation.

```bash
npm run test
```
