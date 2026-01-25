# Testing the VSCode Transforms Integration PR

This document describes how to test the VSCode transform integration implemented in this PR.

## Prerequisites

1. Build the project:
   ```bash
   npm run build:parse && npm run build:abct && npm run build:abct2 && npm run build:lsp && npm run build:vscode
   ```

2. Open the extension in VSCode:
   - Open the `vscode-extension` folder in VSCode
   - Press F5 to launch the Extension Development Host

## Test Cases

### 1. Basic Transform Commands

Open an ABC file with content like:
```abc
X:1
K:C
CDE FGA|
```

#### Transpose

1. Place cursor on a note (e.g., on `C`)
2. Run command `ABC: Transpose` (Ctrl+Shift+T / Cmd+Shift+T on Mac)
3. Enter a number of semitones (e.g., `2`)
4. Verify the note changes (C becomes D)

Preset transpose commands:
- `ABC: Transpose Octave Up` (Ctrl+Shift+Up) - transposes by 12 semitones
- `ABC: Transpose Octave Down` (Ctrl+Shift+Down) - transposes by -12 semitones
- `ABC: Transpose Half Step Up` - transposes by 1 semitone
- `ABC: Transpose Half Step Down` - transposes by -1 semitone

#### Enharmonize

1. Create a note with an accidental: `^C` (C sharp)
2. Select the note using selector commands or place cursor on it
3. Run command `ABC: Enharmonize`
4. Verify `^C` becomes `_D` (D flat)

#### Set Rhythm

1. Select a note (e.g., `C2`)
2. Run command `ABC: Set Rhythm`
3. Enter a rhythm value (e.g., `3/4`)
4. Verify the note's rhythm changes to `C3/4`

#### Add to Rhythm

1. Select a note with rhythm (e.g., `C2`)
2. Run command `ABC: Add to Rhythm`
3. Enter a value to add (e.g., `1`)
4. Verify the rhythm increases (C2 becomes C3)

#### Convert to Rest

1. Select a note (e.g., `C2`)
2. Run command `ABC: To Rest`
3. Verify the note becomes a rest with same rhythm (`z2`)

#### Unwrap Single-Note Chord

1. Create a single-note chord: `[C]2`
2. Select the chord
3. Run command `ABC: Unwrap Single`
4. Verify `[C]2` becomes `C2`

#### Remove

1. Select a note
2. Run command `ABC: Remove`
3. Verify the note is removed from the score

#### Add Voice

1. Open an ABC file
2. Run command `ABC: Add Voice`
3. Enter a voice ID (e.g., `T1`)
4. Verify a `V:T1` line is added to the tune header before the K: line

### 2. Selector + Transform Workflow

The transforms work with the selector system. Test the combined workflow:

1. Open an ABC file with multiple notes
2. Use selector commands to select notes:
   - `ABC: Select Notes` to select all notes
   - `ABC: Select Chords` to select chords
3. Apply a transform to all selected notes:
   - Run `ABC: Transpose` with value `7`
4. Verify all selected notes are transposed

### 3. Cursor State Preservation

Test that cursor state is preserved across transforms:

1. Select multiple notes using selectors
2. Apply a transform (e.g., transpose)
3. Verify the status bar still shows the selection count
4. Apply another transform
5. Verify the selection persists

### 4. Multi-Cursor Support

Test with multiple independent cursors:

1. Use selectors to create multiple cursors on different notes
2. Apply a transform
3. Verify each cursor's note is transformed independently

### 5. Edge Cases

#### Empty Selection
1. Clear any selection
2. Run a transform command
3. Verify the command applies to the entire document or handles gracefully

#### Invalid Input
1. Run `ABC: Transpose` and enter non-numeric input
2. Verify appropriate error handling

#### Chords
1. Create a chord: `[CEG]2`
2. Select the chord
3. Run transpose
4. Verify all notes in the chord are transposed

## Running Automated Tests

Run the integration tests:
```bash
npx mocha --require tsx 'abc-lsp-server/src/transformIntegration.spec.ts'
```

Run all abct2 tests:
```bash
npm run test -w abct2
```

## Known Limitations

1. The native binary warning during build can be ignored for extension testing
2. Some pre-existing parse tests may fail (unrelated to this PR)

## Verification Checklist

- [ ] All transform commands appear in the command palette
- [ ] Keyboard shortcuts work as documented
- [ ] Transforms modify the document correctly
- [ ] Cursor/selection state persists after transforms
- [ ] Status bar updates appropriately
- [ ] Error messages display for invalid operations
- [ ] Undo (Ctrl+Z) reverts transform changes
