ABC Parse

An attempt at a full-fledged parser based on [ABC's 2.2 standard](https://abcnotation.com/wiki/abc:standard:v2.2)

Meant to be used in the context of a language server, such as [AbcLSP](https://github.com/AntoineBalaine/AbcLsp)

To call the parseFolder script, use:

```sh
npm run parse-folder -- /path/to/your/abc/files
```

TODO:

- mark incomplete bars with a warning in the IDE.
- group tuplets as beams in the formatter’s rules resolution step.
- warn about incomplete line-overlay markers (ampersand + line_continuation)
  [V:1] CDEF &\
   FEDC & // Missing continuation

# scan2 TODOs:

- redefinable symbols `U:`
- macros `m:`
- `I: decoration`
- `H: history` and free text
- `%%begintext` free text til `%%endtext`

# parse2 TODOs:

- remove regex matching from tuplet parsing case
- add new source of error reporting instead of using Scanner2 errors.

# info lines TODOs:
- REMOVE MeterFraction type and replace with RationalNumber
- when it comes to key/value pairs: the scanner should NOT be discarding `=` and `/` tokens. Those separator tokens should be part of the values, even if to be discarded later.
- consequently: the formatter should be able to accomodate info lines that carry comments WITHOUT including the comment in the InfoLine expression.

# Bug list:

- remove abcContext everywhere, and pass error reporter instead
- new error reporter: accomodate scan2, parse2
- sys-fmt
  - system detection logic

# features: 
- divide/multiple rhythms (bug)
- double octaves
- enharmonize
- midi input w/ appropriate accidentals
  requires gathering key signature contexts
- input mode for vim:
    <C-a> => ^a
    <M-a> => _a

# want to add (to the standard):
- `.//.` symbols to say «repeat two previous bars»
- chord symbol line: `x: am | g | c | f/ e/g/ :|2`
