# ABC Notation Directives Reference

This document provides a comprehensive reference of directives implemented in the abcjs library, which is a reference parser and web renderer for ABC music notation.

## Font-Related Directives

| Directive | Description |
|-----------|-------------|
| `gchordfont` | For chord symbols |
| `partsfont` | For parts |
| `tripletfont` | For triplet markings |
| `vocalfont` | For vocal lyrics |
| `textfont` | For text |
| `annotationfont` | For annotations |
| `historyfont` | For history text |
| `infofont` | For information |
| `measurefont` | For measure numbers |
| `repeatfont` | For repeat markings |
| `wordsfont` | For lyrics |
| `composerfont` | For composer text |
| `subtitlefont` | For subtitle |
| `tempofont` | For tempo markings |
| `titlefont` | For title |
| `voicefont` | For voice labels |
| `footerfont` | For footer text |
| `headerfont` | For header text |
| `barlabelfont`/`barnumberfont`/`barnumfont` | For bar numbers |

### Font Directive Arguments

Font-related directives in abcjs follow a flexible format with several possible parameters:

```
%%fontdirective <face> <utf8> <size> <modifiers> <box>
```

Where:

1. **face**: Either a standard web font name or a PostScript font (which gets translated to web equivalents). This could be a single word, hyphenated words, or a quoted string. This parameter can be omitted (or replaced with an asterisk) if you only want to change other attributes without changing the font face.

2. **utf8**: An optional parameter that specifies UTF-8 encoding. This is always supported and is silently ignored.

3. **size**: The font size in pixels. This may be omitted if you're not changing the size.

4. **modifiers**: Zero or more of "bold", "italic", "underline" to specify font styling.

5. **box**: Only applies to certain font types. If present, a box is drawn around the text.

### Simplified Formats

The abcjs library also supports simplified formats:

1. **Size only**: Just specifying a number changes only the font size
   ```
   %%gchordfont 12
   ```

2. **Asterisk and size**: Using an asterisk followed by a number also changes only the size
   ```
   %%gchordfont * 14
   ```

### Font Types That Support Boxing

The following font directives support the "box" parameter:
- gchordfont
- measurefont
- partsfont
- annotationfont
- composerfont
- historyfont
- infofont
- subtitlefont
- textfont
- titlefont
- voicefont

### Examples

Here are some examples of font directive usage:

```
%%gchordfont Arial 12 bold
%%vocalfont "Times New Roman" 14 italic
%%textfont * 16
%%measurefont Helvetica 10 box
```

### Default Font Settings

The library initializes default fonts for various elements:
- annotationfont: Helvetica, 12px
- gchordfont: Helvetica, 12px
- historyfont: "Times New Roman", 16px
- infofont: "Times New Roman", 14px, italic
- measurefont: "Times New Roman", 14px, italic
- partsfont: "Times New Roman", 15px
- repeatfont: "Times New Roman", 13px
- textfont: "Times New Roman", 16px
- tripletfont: Times, 11px, italic
- vocalfont: "Times New Roman", 13px, bold
- wordsfont: "Times New Roman", 16px

## Layout and Formatting Directives

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `bagpipes` | None | Special formatting for bagpipe music |
| `flatbeams` | None | Makes beams flat instead of sloped |
| `jazzchords` | None | Uses jazz chord notation |
| `accentAbove` | None | Places accents above the note |
| `germanAlphabet` | None | Uses German alphabet notation |
| `landscape` | None | Sets page orientation to landscape |
| `papersize` | String | Sets paper size (e.g., "A4", "letter") |
| `graceslurs` | 0/false or 1/true | Controls whether slurs are drawn on grace notes |
| `lineThickness` | Number | Sets the thickness of staff lines |
| `stretchlast` | false, true, or number (0-1) | Controls stretching of the last line of music to fill the width. If no value is provided, defaults to true (1). |
| `titlecaps` | None | Capitalizes titles |
| `titleleft` | None | Aligns title to the left |
| `measurebox` | None | Draws boxes around measure numbers |

### Examples

```
%%bagpipes
%%flatbeams
%%papersize A4
%%graceslurs 0
%%lineThickness 1.5
%%stretchlast 0.8
%%titlecaps
%%titleleft
%%measurebox
```

## Positioning Directives

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `vocal` | One of: auto, above, below, hidden | Controls position of vocals |
| `dynamic` | One of: auto, above, below, hidden | Controls position of dynamics |
| `gchord` | One of: auto, above, below, hidden | Controls position of chord symbols |
| `ornament` | One of: auto, above, below, hidden | Controls position of ornaments |
| `volume` | One of: auto, above, below, hidden | Controls position of volume markings |

These directives control the vertical positioning of various musical elements. The possible values are:
- `auto`: Default positioning based on context
- `above`: Always place above the staff
- `below`: Always place below the staff
- `hidden`: Do not display

### Examples

```
%%vocal above
%%dynamic below
%%gchord above
%%ornament auto
%%volume hidden
```

## Margin and Spacing Directives

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `botmargin` | Measurement | Bottom margin of the page |
| `botspace` | Measurement | Space at the bottom of the music |
| `composerspace` | Measurement | Space after composer text |
| `indent` | Measurement | Indentation of the first line of music |
| `leftmargin` | Measurement | Left margin of the page |
| `linesep` | Measurement | Separation between lines of text |
| `musicspace` | Measurement | Space surrounding the music |
| `partsspace` | Measurement | Space between parts |
| `pageheight` | Measurement | Height of the page |
| `pagewidth` | Measurement | Width of the page |
| `rightmargin` | Measurement | Right margin of the page |
| `stafftopmargin` | Measurement | Top margin for staff |
| `staffsep` | Measurement | Separation between staves |
| `staffwidth` | Measurement | Width of the staff |
| `subtitlespace` | Measurement | Space after subtitle |
| `sysstaffsep` | Measurement | Separation between systems of staves |
| `systemsep` | Measurement | Separation between systems |
| `textspace` | Measurement | Space for text |
| `titlespace` | Measurement | Space after title |
| `topmargin` | Measurement | Top margin of the page |
| `topspace` | Measurement | Space at the top of the music |
| `vocalspace` | Measurement | Space for vocals |
| `wordsspace` | Measurement | Space for lyrics |

All of these directives take a measurement as a parameter. Measurements can be specified in various units:
- `cm` - centimeters
- `in` - inches
- `pt` - points (1/72 inch)
- If no unit is specified, points are assumed

### Examples

```
%%leftmargin 1.5cm
%%rightmargin 1.5cm
%%pagewidth 21cm
%%pageheight 29.7cm
%%titlespace 2cm
%%staffsep 16pt
%%systemsep 55pt
```

## Voice-Specific Directives

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `voicescale` | Number (float) | Scales a specific voice by the given factor |
| `voicecolor` | String (color) | Sets color for a specific voice |

These directives affect only the current voice and must be placed after a voice definition. They allow for visual customization of individual voices in multi-voice music.

### Examples

```
V:1
%%voicescale 0.8
%%voicecolor red

V:2
%%voicescale 1.2
%%voicecolor #0000FF
```

In this example:
- Voice 1 is scaled to 80% of normal size and colored red
- Voice 2 is scaled to 120% of normal size and colored blue

The `voicescale` directive accepts any positive floating-point number, where 1.0 represents normal size.
The `voicecolor` directive accepts any valid CSS color name or hexadecimal color code.

## Page and Layout Control

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `vskip` | Measurement | Adds vertical space |
| `scale` | Number | Overall scaling factor for the music |
| `sep` | 3 numbers (optional) | Draws a separator line with specified spacing above, below, and length |
| `barsperstaff` | Number | Sets the number of bars per staff |
| `staffnonote` | 0 or 1 | When set to 0, allows a staff with no notes (1 disables this feature) |
| `printtempo` | Boolean (0/1 or false/true) | Controls whether tempo is printed |
| `partsbox` | Boolean (0/1 or false/true) | When true, draws a box around parts |
| `freegchord` | Boolean (0/1 or false/true) | When true, allows free placement of chord symbols |
| `measurenb`/`barnumbers` | Number | Controls frequency of bar numbering |
| `setbarnb` | Number | Sets the current bar number to the specified value |
| `continueall` | None | Continues all elements across line breaks |

### Examples

```
%%vskip 2cm
%%scale 0.8
%%sep 10 10 150
%%barsperstaff 4
%%staffnonote 0
%%printtempo 1
%%partsbox true
%%freegchord false
%%barnumbers 5
%%setbarnb 10
%%continueall
```

The `sep` directive can be used without parameters, in which case it uses default values (14pt above, 14pt below, 85pt length).

For boolean parameters, you can use either numeric values (0/1) or text values (false/true):
```
%%printtempo 0
%%partsbox false
```
is equivalent to:
```
%%printtempo false
%%partsbox 0
```

## Text and Content Directives

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `begintext`/`endtext` | None/Text block | Defines a block of text that will be displayed with the music |
| `text` | String | Adds text to be displayed with the music |
| `center` | String | Centers text to be displayed with the music |
| `font` | None | A placeholder directive with no effect |
| `setfont` | -N followed by font parameters | Defines a font that can be referenced by number N (1-9) |

### Examples

```
%%begintext
This is a block of text that will be displayed with the music.
Multiple lines are supported.
%%endtext

%%text This is some text

%%center This text will be centered

%%setfont -1 Times 12 bold
```

The `text` and `center` directives support font changes within the text using dollar sign notation:
```
%%text This is $1normal$ and this is $2bold$
```
Where the numbers refer to fonts defined with `setfont`.

The `setfont` directive uses the same font parameter format as the font-related directives, but with a numbered reference:
```
%%setfont -1 Arial 12 bold
%%setfont -2 "Times New Roman" 14 italic
%%setfont -3 Helvetica 10
```

These fonts can then be referenced in text using the dollar sign notation:
```
%%text Regular text $1bold text$ back to $2italic text$ and $3another font$
```

## Staff and Score Organization

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `staves`/`score` | Voice IDs and grouping symbols | Defines staff layout and voice grouping |

These directives use a complex syntax to define how voices are arranged on staves:

- Voice IDs are alphanumeric identifiers
- Parentheses `()` group voices on the same staff
- Square brackets `[]` group staves with a bracket
- Curly braces `{}` group staves with a brace
- Vertical bar `|` connects bar lines between staves

### Examples

```
%%score (T1 T2) (B1 B2)
%%staves [(S A) (T B)]
%%score {RH LH}
%%staves [S A] | [T B]
```

In the examples:
- `%%score (T1 T2) (B1 B2)` puts voices T1 and T2 on one staff, and B1 and B2 on another
- `%%staves [(S A) (T B)]` puts S and A on one staff, T and B on another, with a bracket around both
- `%%score {RH LH}` puts RH and LH on separate staves with a brace connecting them (typical for piano music)
- `%%staves [S A] | [T B]` puts S and A on one staff, T and B on another, with a bracket around each and connected bar lines

The difference between `staves` and `score` is that `staves` automatically connects bar lines between adjacent staves, while `score` does not.

## Page Control

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `newpage` | Number (optional) | Forces a new page. If a number is provided, sets the page number. |

### Examples

```
%%newpage
%%newpage 2
```

The `newpage` directive without a parameter simply forces a new page. With a number parameter, it both forces a new page and sets the page number to the specified value.

## Metadata Directives

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `abc-copyright` | String | Copyright information |
| `abc-creator` | String | Creator information |
| `abc-edited-by` | String | Editor information |
| `abc-version` | String | Version information |
| `abc-charset` | String | Character set information |
| `header` | String with tab separators | Header text with left, center, and right parts |
| `footer` | String with tab separators | Footer text with left, center, and right parts |

The `header` and `footer` directives take a string that can be divided into left, center, and right parts using tab characters:
- If one part is provided, it's used as the center
- If two parts are provided, they're used as left and center
- If three parts are provided, they're used as left, center, and right

### Examples

```
%%abc-copyright Copyright © 2025 Example Music
%%abc-creator John Smith
%%abc-edited-by Jane Doe
%%abc-version 1.0
%%abc-charset utf-8
%%header "Left part"	"Center part"	"Right part"
%%footer "Page $P"	"My Music Book"	"$D"
```

In the footer example, $P and $D are special variables that will be replaced with the page number and date.

## MIDI and Sound Directives

The abcjs library implements numerous MIDI commands for playback control. These directives are prefixed with `%%MIDI` and control various aspects of MIDI playback.

### MIDI Directive Categories

| Category | Arguments | Examples |
|----------|-----------|----------|
| No parameters | None | `nobarlines`, `barlines`, `beataccents`, `nobeataccents`, `droneon`, `droneoff`, `drumon`, `drumoff`, `fermatafixed`, `fermataproportional`, `gchordon`, `gchordoff`, `controlcombo`, `temperamentnormal`, `noportamento` |
| String parameter | String | `gchord`, `ptstress`, `beatstring` |
| Integer parameter | Number | `bassvol`, `chordvol`, `c`, `channel`, `beatmod`, `deltaloudness`, `drumbars`, `gracedivider`, `makechordchannels`, `randomchordattack`, `chordattack`, `stressmodel`, `transpose`, `rtranspose`, `vol`, `volinc`, `gchordbars` |
| One integer, one optional integer | Number, Number (optional) | `program` |
| Two integers | Number, Number | `ratio`, `snt`, `bendvelocity`, `pitchbend`, `control`, `temperamentlinear` |
| Four integers | Number, Number, Number, Number | `beat` |
| Five integers | Number, Number, Number, Number, Number | `drone` |
| String and integer | String, Number | `portamento` |
| Fraction | Number/Number | `expand`, `grace`, `trim` |
| String and variable integers | String, Number... | `drum`, `chordname` |
| Integer and optional string | Number, String (optional) | `bassprog`, `chordprog` |

### Examples

```
%%MIDI program 33        % Sets the MIDI program (instrument) to 33 (acoustic bass)
%%MIDI channel 2         % Sets the MIDI channel to 2
%%MIDI transpose -12     % Transposes down one octave
%%MIDI gchord fzczcz     % Sets a guitar chord pattern
%%MIDI drum d 35 f 38 c 42  % Maps drum notes to MIDI percussion sounds
%%MIDI beat 1 2 3 4      % Sets the beat pattern
%%MIDI drone 60 69 40 50 100  % Sets a drone with specified notes and volumes
%%MIDI expand 1/2        % Expands note durations by a factor of 1/2
```

### Special Case: drummap

The `drummap` directive maps ABC notation to MIDI percussion sounds:

```
%%MIDI drummap D 35      % Maps note D to bass drum (MIDI note 35)
%%MIDI drummap ^F 41     % Maps note F# to low tom (MIDI note 41)
```

The abcjs library includes a built-in mapping of percussion sound names to MIDI note numbers (35-81), so you can also use:

```
%%MIDI drummap D acoustic-bass-drum
%%MIDI drummap ^F low-tom
```

## Percussion Mapping

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `percmap` | abc-note drum-sound [note-head] | Maps percussion notation to sounds |

The `percmap` directive maps ABC notation to percussion sounds. It takes 2 or 3 parameters:
1. `abc-note`: The ABC notation for the note (e.g., "D", "^F")
2. `drum-sound`: Either a MIDI number (35-81) or a drum name
3. `note-head`: (Optional) The note head to use for this percussion note

### Drum Sound Names

The abcjs library supports the following drum sound names, which correspond to MIDI notes 35-81:

```
acoustic-bass-drum, bass-drum-1, side-stick, acoustic-snare, hand-clap,
electric-snare, low-floor-tom, closed-hi-hat, high-floor-tom, pedal-hi-hat,
low-tom, open-hi-hat, low-mid-tom, hi-mid-tom, crash-cymbal-1,
high-tom, ride-cymbal-1, chinese-cymbal, ride-bell, tambourine,
splash-cymbal, cowbell, crash-cymbal-2, vibraslap, ride-cymbal-2,
hi-bongo, low-bongo, mute-hi-conga, open-hi-conga, low-conga,
high-timbale, low-timbale, high-agogo, low-agogo, cabasa,
maracas, short-whistle, long-whistle, short-guiro, long-guiro,
claves, hi-wood-block, low-wood-block, mute-cuica, open-cuica,
mute-triangle, open-triangle
```

### Examples

```
%%percmap D 35           % Maps note D to bass drum (MIDI note 35)
%%percmap ^F 41          % Maps note F# to low tom (MIDI note 41)
%%percmap C acoustic-snare x    % Maps note C to acoustic snare with 'x' note head
%%percmap _E crash-cymbal-1 +   % Maps note Eb to crash cymbal with '+' note head
```

## Miscellaneous Directives

| Directive | Arguments | Description |
|-----------|-----------|-------------|
| `map` | String | General mapping for various purposes |
| `playtempo` | String | Sets the tempo for playback |
| `auquality` | String | Sets the audio quality for playback |
| `continuous` | String | Controls continuous playback behavior |
| `nobarcheck` | None | Disables checking for correct bar lengths |

These directives are used for various purposes that don't fit into other categories. In the abcjs library, they are primarily passed through to the formatting object without detailed parsing.

### Examples

```
%%map color
%%playtempo 120
%%auquality high
%%continuous on
%%nobarcheck
```

Note that the specific behavior of these directives may vary depending on the ABC renderer implementation. The abcjs library stores these values but may not fully implement all functionality for each directive.

## Implementation Notes

This reference is based on the analysis of the `abc_parse_directive.js` file from the abcjs library. The actual implementation details and parameters for each directive may vary. Refer to the abcjs documentation for more specific usage information.

When implementing your own ABC notation parser, you may want to focus on the directives most relevant to your needs, perhaps starting with the basic formatting and layout directives before moving on to more specialized features.
