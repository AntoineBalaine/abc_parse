# AbcLsp: Language server for ABC music notation

Language features for [ABC music notation](https://abcnotation.com/)

## Features
- Syntax highlighting.

![side by side view of syntax highlighting and score](assets/lsp_side_sm.jpg "Syntax Highlighting")
- Diagnostics warning when the server can't read the score.

![diagnostics view of abc score](assets/lsp_diagnostic_sm.jpg "Abc diagnostics" )

- Code formatter.

![abc score formatting](./assets/lsp_format.gif "Abc score formatting" )
- `Divide rhythms`, and `Multiply rhythms` commands: select some notes and the commands will divide/multiple their time value by two.
- Single note midi input from you midi keyboard (Chord-input from midi will come at some point)

- Live preview of ABC and ABCx scores (integrated renderer)
- Export to HTML and SVG
- Print preview

## ABCx Support

ABCx is a simplified ABC format designed for chord sheets and lead sheets. Instead of writing full musical notation, you write chord symbols directly in the tune body. The extension automatically converts `.abcx` files to standard ABC for rendering.

### File Structure

ABCx files use the same header fields as standard ABC:

```abcx
X:1
T:Song Title
C:Composer
M:4/4
L:1/4
K:C
C Am | F G |
Em Am | Dm G |
```

### Chord Symbol Syntax

Chord symbols follow this pattern: `Root[accidental][quality][extension][alteration][/bass]`

| Component  | Options                            | Example        |
|------------|------------------------------------|----------------|
| Root       | A-G (or lowercase a,c,d,e,f,g)     | C, A, g        |
| Accidental | # or b                             | F#, Bb         |
| Quality    | maj, min, m, M, dim, aug, sus, add | Am, Cmaj, Bdim |
| Extension  | 7, 9, 11, 13, 6                    | G7, Am9        |
| Alteration | #5, b5, #9, b9                     | Dm7b5          |
| Bass       | /[note]                            | C/E, Bb/D      |

Examples: `C`, `Am`, `G7`, `Cmaj7`, `Dm7b5`, `F#m7`, `Bb/D`, `A-7b5/D`

### Other Supported Elements

- Barlines: `|`, `||`, `|]`, `[|`, `:|`, `|:`, `::`, `[1`, `[2`
- Annotations: `"text above staff"`
- Multi-measure rests: `Z4` (4 bars rest)
- Inline fields: `[K:G]`, `[M:3/4]`
- Part markers: `P:A`, `P:Chorus`
- Comments: `% this is a comment`

### Example

```
X:1
T:Autumn Leaves
M:4/4
K:G
P:A
Am7 | D7 | Gmaj7 | Cmaj7 |
F#m7b5 | B7 | Em | Em |
P:B
Am7 | D7 | Gmaj7 | Cmaj7 |
F#m7b5 | B7 | Em | Em ||
```

## Known Issues

- Doesn't support lyric sections yet.
- Doesn't support ranges in repeat bars (`|1-2` or `|1,2`).
- Doesn't allow rhythms in grace note groups.
- `Divide rhythms` or `Multiply rhythms` might accidentally duplicate the last character in a text selection.

## Maybe coming to the extension

- Arranging routine capabilities
- Live preview of the score

## Development

To build and install the extension locally:

```bash
cd vscode-extension
npm run build && npm run package:vscode && code --install-extension <extension_vsix> --force
```

Then reload VSCode to pick up the changes.

### MuseSampler Playback (Native Binary)

The extension includes optional playback support via MuseSampler. This requires a native `mscore` binary that communicates with the MuseSampler library (installed via MuseHub).

The build process copies the binary from `native/build/` to `vscode-extension/bin/` via the `copy-binary` script. This is a temporary solution for local development.

For distribution, this should be replaced with platform-specific extension builds (see `platform-specific-extensions.md` at the repo root). The proper approach is to:

1. Build the `mscore` binary for each target platform (darwin-x64, darwin-arm64, linux-x64, win32-x64)
2. Package separate `.vsix` files for each platform using `vsce package --target <platform>`
3. Publish all variants so VS Code downloads the correct one for the user's system

## Release Notes

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## Attribution

The renderer component is based on [abcjs-vscode](https://github.com/abcjs-music/abcjs-vscode) by Alen Siljak, licensed under GPL-3.0-or-later.

## License

This extension is licensed under GPL-3.0-or-later. See the LICENSE file for details.
