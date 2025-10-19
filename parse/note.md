In my parse2.ts, I’m in the process of building the parser for the information lines of my abc music notation parser. The info lines require enough care for me to qualify them as a domain-specific-language within the markdown: there’s not really much syntax, but it’s specific enough to be annoying.

Since I’m retrofitting my InfoLine expression (found in Expr2.ts) to include the new setup, I decided to just add a tagged union in my infoline expression:

```typescript
// Tagged union for parsed info line data
export type InfoLineUnion =
  | { type: "key"; data: KeyInfo }
  | { type: "meter"; data: Meter }
  | { type: "voice"; data: { id: string; properties: { [key: string]: string } } }
  | { type: "tempo"; data: TempoProperties }
  | { type: "title"; data: string }
  | { type: "composer"; data: string }
  | { type: "origin"; data: string }
  | { type: "note_length"; data: Rational }
  | { type: "clef"; data: ClefProperties }
  | { type: "directive"; data: { directive: string; args?: string } };
```
The data types of the union variants have been adapted from the ABCJS codebase - since I didn’t know where I was going with the parser, I chose to stick to ACBJS’ design.

This turns out to be a poor choice, because I’m having to overly specific logic in a context where it’s not necessary. In my parser, the pipeline is meant to go from scanning (which gathers tokens for semantic highlighting) to parsing (which groups tokens into expressions). Then the parser’s output is used by the formatter and by the interpreter (which reads the contents of the expressions to make sense of their use in context). Note that the formatter doesn’t use the output of the interpreter - only the parser’s output.

The problem here is that the tagged union that I’m using is trying to gather what the expressions are doing at the parsing step rather than waiting for the interpreting step. This is because of the reasons cited above (I didn’t know what I was doing when first building this), but I’m not sure I like that design altogether. Here’s why:

If I were to have chosen to use a simplified tagged union, I could have used some generic sub-expressions to describe the variants:

key: kvs
meter: rational (except for C or C| meters)
voice: {vx_id: kvs}
tempo: kvs
note_len: rational
clef: kvs (with some keys omitted)

This is a pain because the output of the parser is meant to be used by the formatter. If I’d had used a generic tagged union, I could have simply used a generic formatter to traverse through the tagged union. 

This is not the case, and it makes me really sad: with the current setup of the tagged union, I’m goingto have to create one sub-formatter per tagged union. Which is a pain.

there is one way around this: I’ve preserved the original token stream in the `value` property of the info lines. 
We want to make sure that KVs separated by a `=` token are re-united correctly, without any spacing around the `=`. The current implementation is in `src/infoLineFmt.ts` in `genericFmt()`: it’s incomplete in the way of handling key/value pairs. Let’s fix that, and let’s create some tests around that.