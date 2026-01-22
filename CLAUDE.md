

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

When a refactor requires moving some functions from a file to the next, renaming variables,finding references, quick fixes and other such refactorings, make sure to use the ts-lsp skill, which contains the tutorial on howto do refactors using the typescrip language server.


# Testing

Before committing or moving onto any other task, make sure that all of the tests are passing, using `npm run test`.

make sure to rely on the skills that we have for understanding the workings of the codebase.

# Planning

Every plan file used in the project must be at the root of the repo, in a `plans/` directory.
Prefix every plan file name with a number. Start at 1, and increment the prefix number at every new file created.
```
plans
  1.firstplan.md
  2.secondplan.md
```
Every plan file must start with a table of contents.

You MUST ask clarification questions for the plan. The plans should be as thorough as possible, and leave absolutely no ambiguities as to what the intent or goals or implementation approaches are. The plans should not only be very thorough, they should be AS technical as possible.

Plan must specify: Copy the plan file into the plans directory, and once you are done with the implementation of each of the phases of the plan, make sure to call the code review agent on the current phase and address any feedback that the code review agent might have. After you are done with the feedback and all the tests are passing, commit the changes and then move onto the next phase. Do this until finished.

The build and the tests MUST work by calling `npm run build` from the root of the repo. New features MUST be integrated in the root build sequence.

- make sure to include a «to do» list in the plan files, so that it’s easy to understand what steps are going to be taken in the implementation. 
- If the plan requires to be adding a new parameter to a function, you want to make sure that the data type of the parameter is indicated, as well as where the data type is created so that we know from where it needs to be imported.
- make sure to be as thorough as possible in the plan: which functions need to be updated, and where. Must any imports be updated as well?
- the goal of the plan is for the plan to be readable and implementable by somebody else, not by you.

# Committing
DO NOT MODIFY THE GITCONFIG.

Every commit must be prefixed with a word followed by a colon (i.e. `chore: <restofmessage>`) and the word describes to what the changes are being applied. For instance, if it's anything that is relatively administrative or non-code related, it should be a `chore`. Anything that is a small bug fix that required very few lines of code to fix should be a `fix:`. Otherwise, for any code that is either implementation feature or something more serious of a change, should be prefixed with the name of the module or the name of the feature that is being modified or implemented.

Every new commit must have a successful build and successfully-running tests. If the build fails or the tests are not passing, it meant that the code is not ready to be committed.

# Architecture
Here is the list of all the pre-made skills that are written as tutorials:

abcjs-multi-staff
abcjs-voice-overlays
abcx-standard
add-expression-tutorial
architecture-guide
documentation_website_overview
header-footer-implementation
interpreter-multi-voice
midi-implementation-part1-simple-commands
midi-implementation-part2-multi-param
midi-implementation-part3-fractions
midi-implementation-part4-octave-param
midi-implementation-part5-special-cases
multi-staff-implementation
multi-staff-implementation-guide
setfont-implementation
skill-writing-guide
ts-lsp
testing-patterns

You MUST use the skills when making updates to the abc_parse codebase, starting with the architecture guide. The architecture goes: scanner -> parser -> formatter -> semantic analyzer -> interpreter -> language server ->  editor extension. Any update in the pipeline requires that the changes be integrated at posterior steps in the pipeline. For instance, new things added to the scanner require updates to the parser, the formatter, the semantic analyzer, and the interpreter, and maybe even the language server. 
For each of these steps in the pipeline, you MUST use the skills that correspond so as to gather intelligence about the approach to take.

# Code reviews

When provided with a comments file and some code review feedback in the form of a list, each issue must be addressed separately following this workflow:

1. Implement the fix
2. Write/update tests (scanner, parser, semantic analyzer, interpreter as applicable)
3. Run `npm run test` to verify all tests pass
4. Amend the original commit in which the issue was found using `git commit --amend`
5. Only then proceed to the next issue

Each addressed comment in the comments file should be have its `content` field prefixed with a checkmark glyph for later reference.
