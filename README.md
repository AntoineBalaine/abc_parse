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

# Bug list:

- scanner - refine generator for tune bodies
- parser property tests
- fix align bars
- remove abcContext everywhere, and pass error reporter instead
- new error reporter: accomodate scan2, parse2
- remove legacy parser-scanner
  Dependent upon align bars tests.
- symbol-line formatting
  _The formatting of symbol lines needs to be done AFTER formatting music lines. These are dependent lines, which means we shouldn’t be worried about system-wide formatting: s-lines come after *any* music formatting._
  - scan line
    all time-sensitive elements, `*` and chord symbols.
  - Scan chord symbols - requires scanning the fundamental name, any possible polychords, and the ciphering which might represent up to 11 notes. For our purposes, we don’t need to go that far: we just want to find the boundaries of the chord symbols.
    So this means we can probably use a regex to delimit the section of the chord symbol. How can I discern whether the annotation is NOT a chord symbol? What’s AbcJs’ policy? Do annotations get aligned too?
  - parse into expressions: «symbol-line extends Expr»
  - add time - mapping logic
- sys-fmt
  - system detection logic
