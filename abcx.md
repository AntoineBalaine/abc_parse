Ok, that’s good. 
Now, we want to be adding a new task: 
We are going to create a subset of the ABC syntax. The file format will be called abcx. The goal is for users to be able to do chord sheet transcriptions on the fly.
We're going to reuse the abc file structure, meaning each tune has a tune header that contains some information lines and then has the tune body, which is parsed and scanned separately.

The tune-body:
  annotations, comments, bar lines (any kind of them), Multi-measure rests (including number of bars for which to rest), and the most important: chord symbols separated by spaces. 

so, my typical tune would look like.
```
X:1
T: my title
P:some section name
Bm | Bm | G | A G "4x" :|
[P: other section] Gm | Gm | C | D A "4x" :|
```

So, as far as I can tell, we can reuse most of the scanner functions and most of the bars expressions - the only new expression that we need to implement is the scanner for the chord symbols. This also means that all of the tunes are single voice, they cannot be multi-voice.

When it comes to the usage we want to make out of this:
1. Syntax highlighting
2. rendering via the abcjs library, which means we’ll need to convert to abc music notation with the use of
3. formatter. 

1. Syntax highlighting
Needs to be done using the same semantic token types that we currently have in the codebase. For now we’ll only add the chord symbol token type. Setting the up the syntax highlighting does mean that we’ll need to have a language server for this, that can provide syntax highlighting.
3. formatter
We can re-use the base formatter visitor that we have, which means we’ll need a parser after the scanning step. Most of the sub functions that we already have in place. We just need to make sure that we have a separate expression and separate sub function for the chord symbols.
We will not have an interpreter step, which means this will be relatively simple to do. Also, when it comes to the form, we do not need to have multi line formatting. So formatting rules can be relatively simple and the same as the ones we have in place for the single line formatter.

2. rendering via the abcjs library needs to be done by converting abcx to abc. 
I'm thinking about it: we have a ABCx to ABC formatter that is - in the background - going to be inserting some specific expressions and tokens inside of the parse tree and then visit those and convert them into ABC notation by stringifying, so that it's possible for us to stream the result and pass it over to the ABCJS library renderer. 
Here’s an example:

```
Bm | Bm | G | A G "4x" :|
```
In this case, we want to be wrapping all the chord symbols in quotes so that they’re appearing as annotations, and then add invisible rests right after them. 
How long should the rests be? The formatter should be doing a best effort to balance the lengths of the rests equally across all of the chord symbols that are present in a bar. 1 chord symbol means `X` (full bar-length.) 2 chord symbols means `x4` if the tune note lengths is `1/8` or `x2` if the tune note length is `1/4`. This will require some calculations.

Make sure to use the property-based testing all along the way.

Also, we’ll need to be able to call the abcx 2 abc formatter from the cli to run conversions when the user wants to convert his chord sheet into an actual score. 

That’s the gist of the setup. 
Let’s make sure to create the plan file for this project 




MAKE SURE TO Ask me all the needed clarifying questions before proceeding to the implementation. 
Make sure to create the plan file at the root of this repo instead of anywhere else. 

