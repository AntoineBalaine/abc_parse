import { CompletionItem, CompletionItemKind, InsertTextFormat, MarkupKind } from "vscode-languageserver";

/**
 * {@property label} is the string that will be inserted into the editor,
 * using the format `!<symbol>!`.
 *
 * {@property documentation} is the string that will be displayed in the hover.
 */
type DecorationSymbol = { label: string; documentation: string };

/**
 * Array of decoration symbols used by the abc standard.
 * Typically, these will be fingerings, dynamics, and articulations.
 */
export const DECORATION_SYMBOLS: Array<DecorationSymbol> = [
  { label: "!+!", documentation: "left-hand pizzicato, or rasp for French horns" },
  { label: "!0!", documentation: "fingerings" },
  { label: "!1!", documentation: "fingerings" },
  { label: "!2!", documentation: "fingerings" },
  { label: "!3!", documentation: "fingerings" },
  { label: "!4!", documentation: "fingerings" },
  { label: "!5!", documentation: "fingerings" },
  { label: "!<(!", documentation: "same as !crescendo(!" },
  { label: "!<)!", documentation: "same as !crescendo)!" },
  { label: "!>!", documentation: "accent (> mark)" },
  { label: "!>(!", documentation: "same as !diminuendo(!" },
  { label: "!>)!", documentation: "same as !diminuendo)!" },
  { label: "!D.C.!", documentation: "the letters D.C. (=either Da Coda or Da Capo)" },
  { label: "!D.C.alcoda!", documentation: "the words 'D.C.al coda'" },
  { label: "!D.C.alfine!", documentation: "the words 'D.C.al fine'" },
  { label: "!D.S.!", documentation: "the letters D.S. (=Da Segno)" },
  { label: "!D.S.alcoda!", documentation: "the words 'D.S.al coda'" },
  { label: "!D.S.alfine!", documentation: "the words 'D.S.al fine'" },
  { label: "!^!", documentation: "marcato (inverted V)" },
  { label: "!accent!", documentation: "same as !>!" },
  { label: "!arpeggio!", documentation: "vertical squiggle" },
  { label: "!breath!", documentation: "a breath mark (apostrophe-like) after note" },
  { label: "!coda!", documentation: "𝄌 - a ring with a cross in it" },
  { label: "!courtesy!", documentation: "adds a courtesy accidental (sharp, fla" },
  { label: "!crescendo(!", documentation: "start of a < crescendo mark" },
  { label: "!crescendo)!", documentation: "end of a < crescendo mark, placed after the last note" },
  { label: "!dacapo!", documentation: "the words 'Da Capo'" },
  { label: "!dacoda!", documentation: "the word 'Da' followed by a Coda sign" },
  { label: "!diminuendo(!", documentation: "start of a > diminuendo mark" },
  { label: "!diminuendo)!", documentation: "end of a > diminuendo mark, placed after the last note" },
  { label: "!downbow!", documentation: "squared n mark" },
  { label: "!editorial!", documentation: "places the subsequent accidental above the notehead - see Section 4.2, Accidentals" },
  { label: "!emphasis!", documentation: "same as !>!" },
  { label: "!fermata!", documentation: "fermata or hold (arc above dot)" },
  { label: "!pppp!", documentation: "for Christ's sake, you're too loud!" },
  { label: "!ppp!", documentation: "pia-pianissimo" },
  { label: "!pp!", documentation: "pianissimo" },
  { label: "!p!", documentation: "piano" },
  { label: "!mp!", documentation: "mezzo-piano" },
  { label: "!mf!", documentation: "mezzo-forte" },
  { label: "!f!", documentation: "forte" },
  { label: "!ff!", documentation: "fortissimo" },
  { label: "!fff!", documentation: "friggin' fortissimo!" },
  { label: "!ffff!", documentation: "ultra friggin' fortissimo!" },
  { label: "!sfz!", documentation: "sforzando" },
  { label: "!fine!", documentation: "the word 'fine'" },
  { label: "!invertedfermata!", documentation: "upside down fermata" },
  { label: "!invertedturn!", documentation: "an inverted turn mark" },
  { label: "!invertedturnx!", documentation: "an inverted turn mark with a line through it" },
  { label: "!longphrase!", documentation: "same, but extending 3/4 of the way down" },
  { label: "!lowermordent!", documentation: "short /|/|/ squiggle with a vertical line through it" },
  { label: "!marcato!", documentation: "same as !^!" },
  { label: "!mediumphrase!", documentation: "same, but extending down to the centre line" },
  { label: "!mordent!", documentation: "same as !lowermordent!" },
  { label: "!open!", documentation: "small circle above note indicating open string or harmonic" },
  { label: "!plus!", documentation: "same as !+!" },
  { label: "!pralltriller!", documentation: "same as !uppermordent!" },
  { label: "!roll!", documentation: "a roll mark (arc) as used in Irish music" },
  { label: "!segno!", documentation: "2 ornate s-like symbols separated by a diagonal line" },
  { label: "!shortphrase!", documentation: "vertical line on the upper part of the staff" },
  { label: "!slide!", documentation: "slide up to a note, visually similar to a half slur" },
  { label: "!snap!", documentation: "snap-pizzicato mark, visually similar to !thumb!" },
  { label: "!tenuto!", documentation: "horizontal line to indicate holding note for full duration" },
  { label: "!thumb!", documentation: "cello thumb symbol" },
  { label: "!trill!", documentation: "'tr' (trill mark)" },
  { label: "!trill(!", documentation: "start of an extended trill" },
  { label: "!trill)!", documentation: "end of an extended trill" },
  { label: "!turn!", documentation: "a turn mark (also known as gruppetto)" },
  { label: "!turnx!", documentation: "a turn mark with a line through it" },
  { label: "!upbow!", documentation: "V mark" },
  { label: "!uppermordent!", documentation: "short /|/|/ squiggle" },
  { label: "!wedge!", documentation: "small filled-in wedge mark" },
];

// =============================================================================
// Directive Completions
// =============================================================================

export type DirectiveCompletion = {
  label: string;
  documentation: string;
};

export const ABCLS_DIRECTIVES: DirectiveCompletion[] = [
  {
    label: "abcls-fmt",
    documentation: "Formatter configuration directive. Options: system-comments, voice-markers=inline/infoline",
  },
  {
    label: "abcls-parse",
    documentation: "Parser configuration directive. Options: linear",
  },
  {
    label: "abcls-voices",
    documentation: "Voice filtering directive. Syntax: show/hide <voiceIds...>",
  },
  {
    label: "MIDI",
    documentation: "MIDI playback configuration. Type space after MIDI to see available commands.",
  },
];

export const ABCLS_PARSE_OPTIONS: DirectiveCompletion[] = [
  {
    label: "linear",
    documentation: "Enable linear (interleaved voice) parsing mode",
  },
];

export const ABCLS_FMT_OPTIONS: DirectiveCompletion[] = [
  {
    label: "system-comments",
    documentation: "Insert empty comment lines between systems in linear tunes",
  },
  {
    label: "voice-markers=inline",
    documentation: "Convert voice markers to inline [V:id] style",
  },
  {
    label: "voice-markers=infoline",
    documentation: "Convert voice markers to info line V:id style",
  },
];

export const ABCLS_VOICES_OPTIONS: DirectiveCompletion[] = [
  {
    label: "show",
    documentation: "Include only the specified voices in output",
  },
  {
    label: "hide",
    documentation: "Exclude the specified voices from output",
  },
];

// =============================================================================
// Font Directive Completions
// =============================================================================

// Common font faces offered as suggestions. Users can type any font name.
export const FONT_FACES = ["Arial", "Times", "Helvetica", "Courier"];
export const FONT_MODIFIERS = ["normal", "bold", "italic", "underline"];

export const FONT_DIRECTIVES_WITH_BOX = [
  "titlefont",
  "gchordfont",
  "composerfont",
  "subtitlefont",
  "voicefont",
  "partsfont",
  "textfont",
  "annotationfont",
  "historyfont",
  "infofont",
  "measurefont",
  "barlabelfont",
  "barnumberfont",
  "barnumfont",
];

export const FONT_DIRECTIVES_WITHOUT_BOX = [
  "tempofont",
  "footerfont",
  "headerfont",
  "tripletfont",
  "vocalfont",
  "repeatfont",
  "wordsfont",
  "tablabelfont",
  "tabnumberfont",
  "tabgracefont",
];

export function buildFontSnippet(hasBox: boolean): string {
  const fontChoices = FONT_FACES.join(",");
  const modifierChoices = FONT_MODIFIERS.join(",");

  let snippet = `\${1|${fontChoices}|} \${2:12} \${3|${modifierChoices}|}`;

  if (hasBox) {
    // VS Code doesn't handle empty first choice well, so we put box first.
    // User can select empty (second option) to omit the box parameter.
    snippet += ` \${4|box, |}`;
  }

  return snippet;
}

export function getFontDirectiveCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  const items: CompletionItem[] = [];

  for (const directive of FONT_DIRECTIVES_WITH_BOX) {
    if (directive.toLowerCase().startsWith(prefix.toLowerCase())) {
      items.push({
        label: directive,
        kind: CompletionItemKind.Keyword,
        detail: "Font directive",
        documentation: {
          kind: MarkupKind.Markdown,
          value: `Sets the font for \`${directive.replace("font", "")}\` text.\n\n**Format:** \`%%${directive} <fontface> <size> <modifier> [box]\`\n\nOptional \`box\` draws a border around the text.`,
        },
        insertText: supportsSnippets ? directive + " " + buildFontSnippet(true) : directive,
        insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
        data: { type: "font-directive", directive },
      });
    }
  }

  for (const directive of FONT_DIRECTIVES_WITHOUT_BOX) {
    if (directive.toLowerCase().startsWith(prefix.toLowerCase())) {
      items.push({
        label: directive,
        kind: CompletionItemKind.Keyword,
        detail: "Font directive",
        documentation: {
          kind: MarkupKind.Markdown,
          value: `Sets the font for \`${directive.replace("font", "")}\` text.\n\n**Format:** \`%%${directive} <fontface> <size> <modifier>\``,
        },
        insertText: supportsSnippets ? directive + " " + buildFontSnippet(false) : directive,
        insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
        data: { type: "font-directive", directive },
      });
    }
  }

  return items;
}

// =============================================================================
// Measurement Directive Completions
// =============================================================================

export const MEASUREMENT_UNITS = ["pt", "in", "cm", "mm"];

export const MEASUREMENT_DIRECTIVES = [
  "botmargin",
  "botspace",
  "composerspace",
  "indent",
  "leftmargin",
  "linesep",
  "musicspace",
  "partsspace",
  "pageheight",
  "pagewidth",
  "rightmargin",
  "stafftopmargin",
  "staffsep",
  "staffwidth",
  "subtitlespace",
  "sysstaffsep",
  "systemsep",
  "textspace",
  "titlespace",
  "topmargin",
  "topspace",
  "vocalspace",
  "wordsspace",
  "vskip",
];

// The sep directive takes 3 measurement parameters
export const SEP_DIRECTIVE = "sep";

export function buildMeasurementSnippet(): string {
  const unitChoices = MEASUREMENT_UNITS.join(",");
  return `\${1}\${2|${unitChoices}|}`;
}

export function buildSepSnippet(): string {
  const unitChoices = MEASUREMENT_UNITS.join(",");
  return `\${1}\${2|${unitChoices}|} \${3}\${4|${unitChoices}|} \${5}\${6|${unitChoices}|}`;
}

export function getMeasurementDirectiveCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  const items: CompletionItem[] = [];

  for (const directive of MEASUREMENT_DIRECTIVES) {
    if (directive.toLowerCase().startsWith(prefix.toLowerCase())) {
      items.push({
        label: directive,
        kind: CompletionItemKind.Keyword,
        detail: "Measurement directive",
        documentation: {
          kind: MarkupKind.Markdown,
          value: `Sets \`${directive}\` measurement.\n\n**Format:** \`%%${directive} <value><unit>\`\n\nUnits: pt, in, cm, mm`,
        },
        insertText: supportsSnippets ? directive + " " + buildMeasurementSnippet() : directive,
        insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
        data: { type: "measurement-directive", directive },
      });
    }
  }

  // Handle the special sep directive (3 measurement parameters)
  if (SEP_DIRECTIVE.toLowerCase().startsWith(prefix.toLowerCase())) {
    items.push({
      label: SEP_DIRECTIVE,
      kind: CompletionItemKind.Keyword,
      detail: "Separator directive",
      documentation: {
        kind: MarkupKind.Markdown,
        value: `Inserts a separator line.\n\n**Format:** \`%%sep <space-above> <line-height> <space-below>\`\n\nAll values use measurement units (pt, in, cm, mm).`,
      },
      insertText: supportsSnippets ? SEP_DIRECTIVE + " " + buildSepSnippet() : SEP_DIRECTIVE,
      insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
      data: { type: "measurement-directive", directive: SEP_DIRECTIVE },
    });
  }

  return items;
}

// =============================================================================
// Boolean Flag Directive Completions
// =============================================================================

export type BooleanFlagDirective = {
  label: string;
  documentation: string;
};

export const BOOLEAN_FLAG_DIRECTIVES: BooleanFlagDirective[] = [
  // Layout and formatting
  { label: "bagpipes", documentation: "Enable bagpipe-specific notation (drones, grace note handling)" },
  { label: "flatbeams", documentation: "Draw beams horizontally (flat) instead of following note stems" },
  { label: "jazzchords", documentation: "Use jazz-style chord symbol notation" },
  { label: "accentAbove", documentation: "Place accent marks above notes instead of below" },
  { label: "germanAlphabet", documentation: "Use German note naming (H for B natural, B for B flat)" },
  { label: "landscape", documentation: "Render in landscape orientation" },
  { label: "titlecaps", documentation: "Render title text in all capitals" },
  { label: "titleleft", documentation: "Align title to the left instead of center" },
  { label: "measurebox", documentation: "Draw a box around measure numbers" },
  { label: "continueall", documentation: "Continue all lines without line breaks" },
  // Music behavior
  { label: "nobarcheck", documentation: "Disable bar length checking warnings" },
];

export function getBooleanFlagDirectiveCompletions(prefix: string): CompletionItem[] {
  return BOOLEAN_FLAG_DIRECTIVES.filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase())).map((directive) => ({
    label: directive.label,
    kind: CompletionItemKind.Keyword,
    detail: "Flag directive",
    documentation: {
      kind: MarkupKind.Markdown,
      value: `${directive.documentation}\n\n**Format:** \`%%${directive.label}\`\n\nPresence enables the feature.`,
    },
    insertText: directive.label,
    insertTextFormat: InsertTextFormat.PlainText,
    data: { type: "boolean-flag-directive", directive: directive.label },
  }));
}

// =============================================================================
// Position Directive Completions
// =============================================================================

// NOTE: These choices must match POSITION_CHOICE_PARAM.choices in parse/types/directive-specs.ts
export const POSITION_CHOICES = ["auto", "above", "below", "hidden"];

export type PositionDirective = {
  label: string;
  documentation: string;
};

export const POSITION_DIRECTIVES: PositionDirective[] = [
  { label: "vocal", documentation: "Control placement of lyrics and vocal text" },
  { label: "dynamic", documentation: "Control placement of dynamic markings (p, f, mf, etc.)" },
  { label: "gchord", documentation: "Control placement of guitar chord symbols" },
  { label: "ornament", documentation: "Control placement of ornament symbols (trill, mordent, etc.)" },
  { label: "volume", documentation: "Control placement of volume marks" },
];

export function buildPositionSnippet(): string {
  const choices = POSITION_CHOICES.join(",");
  return `\${1|${choices}|}`;
}

export function getPositionDirectiveCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  return POSITION_DIRECTIVES.filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase())).map((directive) => ({
    label: directive.label,
    kind: CompletionItemKind.Keyword,
    detail: "Position directive",
    documentation: {
      kind: MarkupKind.Markdown,
      value: `${directive.documentation}\n\n**Format:** \`%%${directive.label} <auto|above|below|hidden>\``,
    },
    insertText: supportsSnippets ? directive.label + " " + buildPositionSnippet() : directive.label,
    insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    data: { type: "position-directive", directive: directive.label },
  }));
}

// =============================================================================
// Boolean Value Directive Completions
// =============================================================================

// NOTE: Boolean value directives require an explicit true/false or 0/1 parameter,
// unlike boolean flag directives which enable a feature by presence alone.
// These directives are defined in parse/types/directive-specs.ts with params: [{ type: "boolean" }]
export const BOOLEAN_VALUE_CHOICES = ["true", "false"];

export type BooleanValueDirective = {
  label: string;
  documentation: string;
};

export const BOOLEAN_VALUE_DIRECTIVES: BooleanValueDirective[] = [
  { label: "graceslurs", documentation: "Enable or disable slurs on grace notes" },
  { label: "staffnonote", documentation: "Show or hide staff when no notes are present" },
  { label: "printtempo", documentation: "Show or hide tempo marking in output" },
  { label: "partsbox", documentation: "Draw a box around part labels" },
  { label: "freegchord", documentation: "Allow freeform chord symbols without validation" },
];

export function buildBooleanValueSnippet(): string {
  const choices = BOOLEAN_VALUE_CHOICES.join(",");
  return `\${1|${choices}|}`;
}

export function getBooleanValueDirectiveCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  return BOOLEAN_VALUE_DIRECTIVES.filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase())).map((directive) => ({
    label: directive.label,
    kind: CompletionItemKind.Keyword,
    detail: "Boolean directive",
    documentation: {
      kind: MarkupKind.Markdown,
      value: `${directive.documentation}\n\n**Format:** \`%%${directive.label} <true|false>\``,
    },
    insertText: supportsSnippets ? directive.label + " " + buildBooleanValueSnippet() : directive.label,
    insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    data: { type: "boolean-value-directive", directive: directive.label },
  }));
}

// =============================================================================
// Parameter Completion Functions (for secondary completions)
// =============================================================================

// These functions provide completions for directive parameters when the user
// has already typed a directive name and is now completing the parameter value.

export function getMeasurementUnitCompletions(prefix: string): CompletionItem[] {
  return MEASUREMENT_UNITS.filter((unit) => unit.toLowerCase().startsWith(prefix.toLowerCase())).map((unit) => ({
    label: unit,
    kind: CompletionItemKind.Unit,
    detail: "Measurement unit",
    documentation: {
      kind: MarkupKind.Markdown,
      value: `**Unit:** \`${unit}\``,
    },
    insertText: unit,
    insertTextFormat: InsertTextFormat.PlainText,
    data: { type: "measurement-unit", unit },
  }));
}

export function getPositionChoiceCompletions(prefix: string): CompletionItem[] {
  return POSITION_CHOICES.filter((choice) => choice.toLowerCase().startsWith(prefix.toLowerCase())).map((choice) => ({
    label: choice,
    kind: CompletionItemKind.EnumMember,
    detail: `Position value: ${choice}`,
    documentation: {
      kind: MarkupKind.Markdown,
      value: `**Position:** \`${choice}\`\n\nSets the placement of the element.`,
    },
    insertText: choice,
    insertTextFormat: InsertTextFormat.PlainText,
    data: { type: "position-choice", choice },
  }));
}

export function getBooleanChoiceCompletions(prefix: string): CompletionItem[] {
  return BOOLEAN_VALUE_CHOICES.filter((choice) => choice.toLowerCase().startsWith(prefix.toLowerCase())).map((choice) => ({
    label: choice,
    kind: CompletionItemKind.EnumMember,
    detail: "Boolean value",
    documentation: {
      kind: MarkupKind.Markdown,
      value: `**Value:** \`${choice}\``,
    },
    insertText: choice,
    insertTextFormat: InsertTextFormat.PlainText,
    data: { type: "boolean-choice", choice },
  }));
}

// =============================================================================
// Number Directive Completions
// =============================================================================

// NOTE: Number directives accept a single numeric parameter.
// These directives are defined in parse/types/directive-specs.ts with params: [{ type: "number", ... }]
// MIDI directives with number parameters are excluded (handled separately in MIDI completions).
export type NumberDirective = {
  label: string;
  documentation: string;
  defaultValue: string;
};

export const NUMBER_DIRECTIVES: NumberDirective[] = [
  { label: "lineThickness", documentation: "Line thickness multiplier (1 = normal)", defaultValue: "1" },
  { label: "stretchlast", documentation: "Stretch factor for last line (0-1, optional)", defaultValue: "0.8" },
  { label: "fontboxpadding", documentation: "Padding around font boxes in em units", defaultValue: "0.1" },
  { label: "voicescale", documentation: "Voice scaling factor (1 = normal)", defaultValue: "1" },
  { label: "scale", documentation: "Global scaling factor (1 = normal)", defaultValue: "1" },
  { label: "barsperstaff", documentation: "Number of bars per staff line (minimum: 1)", defaultValue: "4" },
  { label: "measurenb", documentation: "Measure numbering interval (0 = disabled)", defaultValue: "1" },
  { label: "barnumbers", documentation: "Bar number display interval (0 = disabled)", defaultValue: "1" },
  { label: "setbarnb", documentation: "Set starting bar number (minimum: 1)", defaultValue: "1" },
  { label: "newpage", documentation: "Start new page (optional page number)", defaultValue: "" },
];

export function buildNumberSnippet(defaultValue: string): string {
  return `\${1:${defaultValue}}`;
}

export function getNumberDirectiveCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  return NUMBER_DIRECTIVES.filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase())).map((directive) => ({
    label: directive.label,
    kind: CompletionItemKind.Keyword,
    detail: "Number directive",
    documentation: {
      kind: MarkupKind.Markdown,
      value: `${directive.documentation}\n\n**Format:** \`%%${directive.label} <number>\``,
    },
    insertText: supportsSnippets ? directive.label + " " + buildNumberSnippet(directive.defaultValue) : directive.label,
    insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    data: { type: "number-directive", directive: directive.label },
  }));
}

// =============================================================================
// Identifier Directive Completions
// =============================================================================

// NOTE: Identifier directives accept a single identifier or string parameter.
// These directives are defined in parse/types/directive-specs.ts with params: [{ type: "identifier" }]
// MIDI commands with identifier parameters (gchord, ptstress, beatstring) are excluded
// because they will be handled separately in MIDI directive completions.
export type IdentifierDirective = {
  label: string;
  documentation: string;
  defaultValue: string;
};

export const IDENTIFIER_DIRECTIVES: IdentifierDirective[] = [
  { label: "papersize", documentation: "Paper size (e.g., a4, letter, legal, A3, tabloid)", defaultValue: "a4" },
  { label: "voicecolor", documentation: "Voice color (CSS color name or hex code like #FF0000)", defaultValue: "black" },
  { label: "map", documentation: "Note mapping name for custom note rendering", defaultValue: "" },
  { label: "playtempo", documentation: "Play tempo configuration", defaultValue: "" },
  { label: "auquality", documentation: "Audio output quality setting", defaultValue: "" },
  { label: "continuous", documentation: "Continuous playback mode setting", defaultValue: "" },
];

export function buildIdentifierSnippet(defaultValue: string): string {
  return `\${1:${defaultValue}}`;
}

export function getIdentifierDirectiveCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  return IDENTIFIER_DIRECTIVES.filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase())).map((directive) => ({
    label: directive.label,
    kind: CompletionItemKind.Keyword,
    detail: "Identifier directive",
    documentation: {
      kind: MarkupKind.Markdown,
      value: `${directive.documentation}\n\n**Format:** \`%%${directive.label} <value>\``,
    },
    insertText: supportsSnippets ? directive.label + " " + buildIdentifierSnippet(directive.defaultValue) : directive.label,
    insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    data: { type: "identifier-directive", directive: directive.label },
  }));
}

// =============================================================================
// Text/Annotation Directive Completions
// =============================================================================

// NOTE: Text directives accept a single annotation/text parameter.
// These directives are defined in parse/types/directive-specs.ts with params: [{ type: "annotation" }]
export type TextDirective = {
  label: string;
  documentation: string;
  placeholder: string;
};

export const TEXT_DIRECTIVES: TextDirective[] = [
  { label: "text", documentation: "Insert text into the score", placeholder: "text here" },
  { label: "center", documentation: "Insert centered text into the score", placeholder: "centered text" },
  { label: "abc-copyright", documentation: "Copyright metadata for the ABC file", placeholder: "Copyright notice" },
  { label: "abc-creator", documentation: "Creator or author of the ABC file", placeholder: "Creator name" },
  { label: "abc-edited-by", documentation: "Editor of the ABC file", placeholder: "Editor name" },
  { label: "abc-version", documentation: "ABC standard version used", placeholder: "2.1" },
  { label: "abc-charset", documentation: "Character encoding of the ABC file", placeholder: "utf-8" },
];

export function buildTextSnippet(placeholder: string): string {
  return `\${1:${placeholder}}`;
}

export function getTextDirectiveCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  return TEXT_DIRECTIVES.filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase())).map((directive) => ({
    label: directive.label,
    kind: CompletionItemKind.Keyword,
    detail: "Text directive",
    documentation: {
      kind: MarkupKind.Markdown,
      value: `${directive.documentation}\n\n**Format:** \`%%${directive.label} <text>\``,
    },
    insertText: supportsSnippets ? directive.label + " " + buildTextSnippet(directive.placeholder) : directive.label,
    insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    data: { type: "text-directive", directive: directive.label },
  }));
}

// =============================================================================
// Complex Directive Completions
// =============================================================================

// NOTE: Complex directives have multiple parameters or special syntax.
// These provide basic scaffolding to help users get started.
export type ComplexDirective = {
  label: string;
  documentation: string;
  snippet: string;
};

export const COMPLEX_DIRECTIVES: ComplexDirective[] = [
  {
    label: "begintext",
    documentation: "Start a text block with alignment mode (obey, fill, justify, skip, center, right, none)",
    snippet: "begintext ${1|obey,fill,justify,skip,center,right,none|}",
  },
  {
    label: "setfont",
    documentation: "Register a font number (1-4) with font name and size. Format: %%setfont-N fontname size",
    snippet: "setfont-${1|1,2,3,4|} ${2:Times-Roman} ${3:12}",
  },
  {
    label: "staves",
    documentation: "Define staff layout with voice groupings. Use [] for braces, {} for brackets",
    snippet: "staves ${1:V1 V2 | V3 V4}",
  },
  {
    label: "score",
    documentation: "Define score layout (alias for staves). Use [] for braces, {} for brackets",
    snippet: "score ${1:V1 V2 | V3 V4}",
  },
  {
    label: "header",
    documentation: "Page header with three tab-separated sections: left, center, right",
    snippet: "header ${1:left}\t${2:center}\t${3:right}",
  },
  {
    label: "footer",
    documentation: "Page footer with three tab-separated sections: left, center, right",
    snippet: "footer ${1:left}\t${2:center}\t${3:right}",
  },
  {
    label: "deco",
    documentation: "Define a custom decoration. Format: %%deco name type params",
    snippet: "deco ${1:name} ${2:definition}",
  },
  {
    label: "percmap",
    documentation: "Map ABC note to percussion sound. Format: %%percmap note midi_number [notehead]",
    snippet: "percmap ${1:C} ${2:38} ${3:x}",
  },
];

export function getComplexDirectiveCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  return COMPLEX_DIRECTIVES.filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase())).map((directive) => ({
    label: directive.label,
    kind: CompletionItemKind.Keyword,
    detail: "Complex directive",
    documentation: {
      kind: MarkupKind.Markdown,
      value: directive.documentation,
    },
    insertText: supportsSnippets ? directive.snippet : directive.label,
    insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    data: { type: "complex-directive", directive: directive.label },
  }));
}

// =============================================================================
// MIDI Directive Completions
// =============================================================================

// NOTE: MIDI commands are defined in parse/types/directive-specs.ts MIDI_COMMAND_SPECS
export type MidiCommand = {
  label: string;
  documentation: string;
  snippet: string;
};

// Commands with no parameters
const MIDI_NO_PARAM_COMMANDS: MidiCommand[] = [
  { label: "nobarlines", documentation: "Disable bar lines in MIDI output", snippet: "nobarlines" },
  { label: "barlines", documentation: "Enable bar lines in MIDI output", snippet: "barlines" },
  { label: "beataccents", documentation: "Enable beat accents", snippet: "beataccents" },
  { label: "nobeataccents", documentation: "Disable beat accents", snippet: "nobeataccents" },
  { label: "droneon", documentation: "Enable drone", snippet: "droneon" },
  { label: "droneoff", documentation: "Disable drone", snippet: "droneoff" },
  { label: "drumon", documentation: "Enable drum track", snippet: "drumon" },
  { label: "drumoff", documentation: "Disable drum track", snippet: "drumoff" },
  { label: "fermatafixed", documentation: "Use fixed duration for fermatas", snippet: "fermatafixed" },
  { label: "fermataproportional", documentation: "Use proportional duration for fermatas", snippet: "fermataproportional" },
  { label: "gchordon", documentation: "Enable guitar chord accompaniment", snippet: "gchordon" },
  { label: "gchordoff", documentation: "Disable guitar chord accompaniment", snippet: "gchordoff" },
  { label: "controlcombo", documentation: "Enable control combination mode", snippet: "controlcombo" },
  { label: "temperamentnormal", documentation: "Use normal temperament", snippet: "temperamentnormal" },
  { label: "noportamento", documentation: "Disable portamento", snippet: "noportamento" },
];

// Commands with one integer parameter
const MIDI_ONE_INT_COMMANDS: MidiCommand[] = [
  { label: "bassvol", documentation: "Bass volume (0-127)", snippet: "bassvol ${1:64}" },
  { label: "chordvol", documentation: "Chord volume (0-127)", snippet: "chordvol ${1:64}" },
  { label: "c", documentation: "Set MIDI channel (1-16)", snippet: "c ${1:1}" },
  { label: "channel", documentation: "Set MIDI channel (1-16)", snippet: "channel ${1:1}" },
  { label: "beatmod", documentation: "Beat modification value", snippet: "beatmod ${1:100}" },
  { label: "deltaloudness", documentation: "Delta loudness adjustment", snippet: "deltaloudness ${1:0}" },
  { label: "drumbars", documentation: "Number of drum bars", snippet: "drumbars ${1:1}" },
  { label: "gracedivider", documentation: "Grace note divider", snippet: "gracedivider ${1:4}" },
  { label: "makechordchannels", documentation: "Create chord channels", snippet: "makechordchannels ${1:0}" },
  { label: "randomchordattack", documentation: "Random chord attack (ms)", snippet: "randomchordattack ${1:0}" },
  { label: "chordattack", documentation: "Chord attack delay (ms)", snippet: "chordattack ${1:0}" },
  { label: "stressmodel", documentation: "Stress model number", snippet: "stressmodel ${1:1}" },
  { label: "transpose", documentation: "Transpose semitones", snippet: "transpose ${1:0}" },
  { label: "rtranspose", documentation: "Relative transpose semitones", snippet: "rtranspose ${1:0}" },
  { label: "vol", documentation: "Volume (0-127)", snippet: "vol ${1:64}" },
  { label: "volinc", documentation: "Volume increment", snippet: "volinc ${1:0}" },
  { label: "gchordbars", documentation: "Guitar chord bars", snippet: "gchordbars ${1:1}" },
];

// Commands with one identifier parameter
const MIDI_ONE_ID_COMMANDS: MidiCommand[] = [
  { label: "gchord", documentation: "Guitar chord pattern string", snippet: "gchord ${1:pattern}" },
  { label: "ptstress", documentation: "Stress pattern file", snippet: "ptstress ${1:filename}" },
  { label: "beatstring", documentation: "Beat pattern string", snippet: "beatstring ${1:pattern}" },
];

// Commands with two integer parameters
const MIDI_TWO_INT_COMMANDS: MidiCommand[] = [
  { label: "ratio", documentation: "Rhythm ratio (e.g., 3:2 for swing)", snippet: "ratio ${1:3} ${2:2}" },
  { label: "snt", documentation: "Set note timing", snippet: "snt ${1:0} ${2:0}" },
  { label: "bendvelocity", documentation: "Bend velocity parameters", snippet: "bendvelocity ${1:0} ${2:0}" },
  { label: "pitchbend", documentation: "Pitch bend parameters", snippet: "pitchbend ${1:0} ${2:0}" },
  { label: "control", documentation: "MIDI control change (controller, value)", snippet: "control ${1:7} ${2:64}" },
  { label: "temperamentlinear", documentation: "Linear temperament parameters", snippet: "temperamentlinear ${1:0} ${2:0}" },
];

// Commands with special parameter patterns
const MIDI_SPECIAL_COMMANDS: MidiCommand[] = [
  { label: "program", documentation: "MIDI program number (0-127), optional channel", snippet: "program ${1:0}" },
  { label: "beat", documentation: "Beat pattern (accent1, accent2, accent3, accent4)", snippet: "beat ${1:90} ${2:75} ${3:60} ${4:50}" },
  { label: "drone", documentation: "Drone parameters (program, pitch1, pitch2, vol1, vol2)", snippet: "drone ${1:70} ${2:45} ${3:33} ${4:80} ${5:80}" },
  { label: "portamento", documentation: "Portamento (on/off, duration)", snippet: "portamento ${1:on} ${2:50}" },
  { label: "expand", documentation: "Expand note duration (fraction)", snippet: "expand ${1:1/2}" },
  { label: "grace", documentation: "Grace note duration (fraction)", snippet: "grace ${1:1/8}" },
  { label: "trim", documentation: "Trim note duration (fraction)", snippet: "trim ${1:1/8}" },
  { label: "drum", documentation: "Drum pattern (pattern, midi notes...)", snippet: "drum ${1:d2zd2z} ${2:35} ${3:38}" },
  { label: "chordname", documentation: "Define chord (name, intervals...)", snippet: "chordname ${1:m} ${2:0} ${3:3} ${4:7}" },
  { label: "bassprog", documentation: "Bass program (0-127), optional octave=N", snippet: "bassprog ${1:0}" },
  { label: "chordprog", documentation: "Chord program (0-127), optional octave=N", snippet: "chordprog ${1:0}" },
  { label: "drummap", documentation: "Map note to drum sound (note, midi/name)", snippet: "drummap ${1:C} ${2:38}" },
];

export const MIDI_COMMANDS: MidiCommand[] = [
  ...MIDI_NO_PARAM_COMMANDS,
  ...MIDI_ONE_INT_COMMANDS,
  ...MIDI_ONE_ID_COMMANDS,
  ...MIDI_TWO_INT_COMMANDS,
  ...MIDI_SPECIAL_COMMANDS,
];

export function getMidiCommandCompletions(prefix: string, supportsSnippets: boolean = true): CompletionItem[] {
  const trimmedPrefix = prefix.trim();
  return MIDI_COMMANDS.filter((cmd) => cmd.label.toLowerCase().startsWith(trimmedPrefix.toLowerCase())).map((command) => ({
    label: command.label,
    kind: CompletionItemKind.Keyword,
    detail: "MIDI command",
    documentation: {
      kind: MarkupKind.Markdown,
      value: command.documentation,
    },
    insertText: supportsSnippets ? command.snippet : command.label,
    insertTextFormat: supportsSnippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    data: { type: "midi-command", command: command.label },
  }));
}

// =============================================================================
// Directive Completion Context Detection
// =============================================================================

export type DirectiveCompletionContext =
  | { type: "none" }
  | { type: "directive-name"; prefix: string }
  | { type: "abcls-parse-options"; prefix: string }
  | { type: "abcls-fmt-options"; prefix: string }
  | { type: "abcls-voices-options"; prefix: string }
  | { type: "midi-command"; prefix: string }
  | { type: "measurement-unit"; prefix: string }
  | { type: "position-choice"; prefix: string }
  | { type: "boolean-choice"; prefix: string };

/**
 * Determines the type of directive completion needed based on the line content
 * and cursor position. Because textBeforeCursor is the text from the start of
 * the line up to the cursor, the regex /^%%/ only matches when %% appears at
 * the very beginning of the line with no preceding whitespace.
 */
export function getDirectiveCompletionContext(lineText: string, charPosition: number): DirectiveCompletionContext {
  const textBeforeCursor = lineText.slice(0, charPosition);

  // Check if we're after %% at line start (no leading whitespace allowed)
  if (!textBeforeCursor.match(/^%%/)) {
    return { type: "none" };
  }

  // Extract what's after %%
  const afterPercent = textBeforeCursor.slice(2);

  // Check for MIDI command context - must be after "%%MIDI " (case-insensitive)
  const midiMatch = afterPercent.match(/^midi\s+(.*)$/i);
  if (midiMatch) {
    return { type: "midi-command", prefix: midiMatch[1].trim() };
  }

  // Check for specific directive contexts (case-insensitive)
  // We trim the captured prefix to handle multiple spaces gracefully
  const abclsParseMatch = afterPercent.match(/^abcls-parse\s+(.*)$/i);
  if (abclsParseMatch) {
    return { type: "abcls-parse-options", prefix: abclsParseMatch[1].trim() };
  }

  const abclsFmtMatch = afterPercent.match(/^abcls-fmt\s+(.*)$/i);
  if (abclsFmtMatch) {
    return { type: "abcls-fmt-options", prefix: abclsFmtMatch[1].trim() };
  }

  const abclsVoicesMatch = afterPercent.match(/^abcls-voices\s+(.*)$/i);
  if (abclsVoicesMatch) {
    return { type: "abcls-voices-options", prefix: abclsVoicesMatch[1].trim() };
  }

  // Check for parameter completion context: %%<directive-name> <partial-param>
  // This regex captures the directive name and optional parameter prefix
  const paramMatch = afterPercent.match(/^(\w+)\s+(.*)$/i);
  if (paramMatch) {
    const directiveName = paramMatch[1].toLowerCase();
    const paramPrefix = paramMatch[2];

    // Check if we're completing a measurement unit
    if (MEASUREMENT_DIRECTIVES.map((d) => d.toLowerCase()).includes(directiveName)) {
      return { type: "measurement-unit", prefix: paramPrefix };
    }

    // Check if we're completing a position choice
    if (POSITION_DIRECTIVES.map((d) => d.label.toLowerCase()).includes(directiveName)) {
      return { type: "position-choice", prefix: paramPrefix };
    }

    // Check if we're completing a boolean value
    if (BOOLEAN_VALUE_DIRECTIVES.map((d) => d.label.toLowerCase()).includes(directiveName)) {
      return { type: "boolean-choice", prefix: paramPrefix };
    }
  }

  // If just %% or %%<partial>, offer directive names
  return { type: "directive-name", prefix: afterPercent };
}

/**
 * Creates completion items from a directive options array, filtering by prefix.
 * This consolidated helper is used for all directive option completions.
 */
export function getDirectiveCompletions(options: DirectiveCompletion[], prefix: string, kind: CompletionItemKind): CompletionItem[] {
  return options
    .filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((directive, index) => ({
      label: directive.label,
      kind,
      detail: "Directive option",
      documentation: {
        kind: MarkupKind.Markdown,
        value: directive.documentation,
      },
      insertText: directive.label,
      data: { type: "directive-completion", index },
    }));
}
