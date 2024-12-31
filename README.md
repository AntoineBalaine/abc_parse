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
      FEDC &    // Missing continuation
