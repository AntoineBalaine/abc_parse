# Manual Testing Guide for ABC Kakoune Plugin

This document describes how to manually test the ABC selector integration in Kakoune.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Test Cases](#test-cases)
   - [Basic Selector Commands](#basic-selector-commands)
   - [Narrowing Chain](#narrowing-chain)
   - [Scope Filtering](#scope-filtering)
   - [State Management](#state-management)
   - [Error Handling](#error-handling)
4. [Troubleshooting](#troubleshooting)

---

## Prerequisites

1. Kakoune editor installed
2. kak-lsp installed and configured
3. Node.js (v18 or later)
4. The ABC LSP server built:
   ```bash
   cd /path/to/abc_parse
   npm install
   npm run build:parse && npm run build:abct && npm run build:abct2 && npm run build:lsp
   ```

---

## Setup

### 1. Configure kak-lsp

Add to your `~/.config/kak-lsp/kak-lsp.toml`:

```toml
[language_server.abc-lsp]
filetypes = ["abc"]
roots = [".git"]
command = "node"
args = ["/path/to/abc_parse/abc-lsp-server/out/server.js", "--stdio", "--socket=auto"]
```

Replace `/path/to/abc_parse` with the actual path.

### 2. Load the Kakoune plugin

Add to your `~/.config/kak/kakrc`:

```kak
source /path/to/abc_parse/abc-kak/rc/abc.kak
source /path/to/abc_parse/abc-kak/rc/abc-selectors.kak
```

Or symlink the `rc/` directory to your autoload:

```bash
ln -s /path/to/abc_parse/abc-kak/rc ~/.config/kak/autoload/abc
```

### 3. Restart Kakoune

Close and reopen Kakoune to load the new configuration.

---

## Test Cases

### Test File

Create a test file `test.abc` with the following content:

```abc
X:1
T:Test Tune
K:C
[CEG]2 A2 B2 | [FAC]2 G2 z2 |
[GBD]2 C2 D2 | E2 F2 [ACE]2 |
```

Open it in Kakoune:

```bash
kak test.abc
```

Wait a moment for the LSP to connect (you should see diagnostics if there are any issues).

---

### Basic Selector Commands

#### Test 1: Select all chords

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Expected: 4 selections, one for each chord (`[CEG]`, `[FAC]`, `[GBD]`, `[ACE]`)
4. Verify: The status line should show 4 selections

#### Test 2: Select all notes

1. Open `test.abc`
2. Run `:abc-select-notes`
3. Expected: Multiple selections covering all notes (including notes inside chords)
4. Verify: Count should include A, B, G, C, D, E, F and all chord notes

#### Test 3: Select all rests

1. Open `test.abc`
2. Run `:abc-select-rests`
3. Expected: 1 selection for the `z2` rest
4. Verify: The selection should be on line 4, covering `z2`

#### Test 4: Select top note of chords

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Run `:abc-select-top`
4. Expected: 4 selections, one for the top note of each chord (G, C, D, E)

#### Test 5: Select bottom note of chords

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Run `:abc-select-bottom`
4. Expected: 4 selections, one for the bottom note of each chord (C, F, G, A)

#### Test 6: Select Nth note from top

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Run `:abc-select-nth-from-top 1`
4. Expected: 4 selections for the second note from the top in each chord (E, A, B, C)

---

### Narrowing Chain

#### Test 7: Narrowing from chords to notes

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Verify: 4 chord selections
4. Run `:abc-select-notes`
5. Expected: Only notes inside the chords are selected (12 notes total, 3 per chord)
6. The standalone notes (A2, B2, G2, C2, D2, E2, F2) should NOT be selected

#### Test 8: Multi-step narrowing

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Run `:abc-select-top`
4. Verify: Top notes of all 4 chords selected
5. The narrowing chain should be preserved for further operations

#### Test 9: Reset narrowing chain

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Run `:abc-select-top`
4. Run `:abc-select-reset`
5. Run `:abc-select-notes`
6. Expected: All notes in the document are now selected (not just chord notes)

---

### Scope Filtering

#### Test 10: Scope to visual selection

1. Open `test.abc`
2. Select only the first line of music (line 4): `4Gx` to select line 4
3. Run `:abc-select-chords`
4. Expected: Only 2 chords selected (`[CEG]` and `[FAC]`), not the chords on line 5

#### Test 11: Multiple scope regions

1. Open `test.abc`
2. Create multiple selections covering lines 4 and 5 but not the header
3. Run `:abc-select-notes`
4. Expected: Only notes within the selected regions are matched

---

### State Management

#### Test 12: State clears on buffer modification

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Verify: Chords are selected
4. Enter insert mode and add a space somewhere, then exit insert mode
5. Run `:abc-select-notes`
6. Expected: All notes are selected (narrowing chain was cleared due to buffer modification)

#### Test 13: State clears on selection change

1. Open `test.abc`
2. Run `:abc-select-chords`
3. Move cursor with `j` or `l`
4. Run `:abc-select-notes`
5. Expected: All notes are selected (narrowing chain was cleared due to selection change)

---

### Error Handling

#### Test 14: No matches found

1. Create a file with only header lines (no music):
   ```abc
   X:1
   T:Empty
   K:C
   ```
2. Run `:abc-select-chords`
3. Expected: Message "No matches found" displayed

#### Test 15: LSP not running

1. Stop the LSP server (if running separately) or use a file type that the LSP does not handle
2. Try running `:abc-select-chords`
3. Expected: Error message about LSP server not running or socket not found

#### Test 16: ABCx file rejection

1. Create a file `test.abcx`
2. Open it in Kakoune
3. Try running `:abc-select-chords`
4. Expected: Error message indicating selectors are not supported for ABCx files

---

## Troubleshooting

### The socket is not created

1. Check that the LSP server is running with the `--socket=auto` argument
2. Verify the socket path exists:
   ```bash
   ls -la ${XDG_RUNTIME_DIR:-/tmp/abc-lsp-$USER}/abc-lsp.sock
   ```

### Commands do nothing

1. Ensure the filetype is set to `abc`:
   ```kak
   :echo %opt{filetype}
   ```
2. Check that kak-lsp is enabled:
   ```kak
   :lsp-status
   ```

### Selections are incorrect

1. Verify the document has been synced with the LSP (make a small edit and undo)
2. Check that there are no parse errors in the document (`:lsp-diagnostics`)

### Debug logging

To see what the client is sending/receiving, you can manually run the client:

```bash
echo '{"id":1,"method":"abc.applySelector","params":{"uri":"file:///path/to/test.abc","selector":"selectChords","cursorNodeIds":[]}}' | \
  node /path/to/abc_parse/abc-kak/bin/abc-kak-client.js \
    --socket="${XDG_RUNTIME_DIR:-/tmp/abc-lsp-$USER}/abc-lsp.sock" \
    --uri="file:///path/to/test.abc" \
    --selector="selectChords" \
    --buffer-file="/path/to/test.abc"
```
