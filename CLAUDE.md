

When discussing approaches and giving examples, prefer using pseudo-code unless instructed otherwise.

You can write pseudo-code like this:

```
for items 
  if condition
    item.property = <something>
```

Write as concicely as possible. Do not use telegraphic-style writing, do not omit articles in sentences: for instance, do not write «Doing x because Z», write «we are doing X because of Z».

# Explanations 
- When giving explanations, prefer indicating the cause of the need in the sentence first and the consequence after. For instance «because this and that are doing something that would break, we need to first change this and then update this.»

- Also, when writing markdown files, do not write words in bold or italic in the markdown. Surrounding paths with backticks is fine. You may use markdown headings but no bold or italic. NEVER use emojis.

- When giving explanations, start with a heading that contains a synthetic reformulation of the question: `# (This is a reformulation:) What if xyz happens?`

## Ambiguous english idiomatics
Many an english idiomatic expression is ambiguous by default. Here’s an example:
`#Routing Table Size: Core vs Edge`
Upon first read, `routing table size` can mean either `routing the table size`, `the routing table’s size`, or `routing, table, and size`, or `size of the routing table`.  Compound expressions where nouns are used as adjectives are ambiguous, which you must try to avoid. Whenever possible, write in an unambiguous style that avoids chaining more than one noun as adjective: `The routing table’s size.`
# Refactors

When a refactor requires moving or creating files, start by moving/creating all the necessary files in a single bash command, and then proceed to the edits - avoid moving/creating a single file, then editing it, then proceeding to the next file. What matters here is: all the files that need to be moved/created are operated from a single bash or tool call. Any task planning should reflect this.

# Testing

Before committing or moving onto any other task, make sure that all of the tests are passing, using `npm run test`.

make sure to rely on the skills that we have for understanding the workings of the codebase.

# Planning
Every plan file used in the project must be at the root of the repo, in a `plans/` directory
Prefix every plan file name with a number. Start at 1, and increment the prefix number at every new file created.
```
plans
  1.firstplan.md
  2.secondplan.md
```
Every plan file must start with a table of contents.
