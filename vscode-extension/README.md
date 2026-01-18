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

ABCx is a simplified ABC format that focuses on chord symbols. The extension automatically converts ABCx files to standard ABC for rendering.

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
npm run build && npm run package && code --install-extension <extension_vsix> --force
```

Then reload VSCode to pick up the changes.

## Release Notes

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## Attribution

The renderer component is based on [abcjs-vscode](https://github.com/abcjs-music/abcjs-vscode) by Alen Siljak, licensed under GPL-3.0-or-later.

## License

This extension is licensed under GPL-3.0-or-later. See the LICENSE file for details.
