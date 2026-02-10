import { CompletionItem, CompletionItemKind } from "vscode-languageserver";

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
// Directive Completion Context Detection
// =============================================================================

export type DirectiveCompletionContext =
  | { type: "none" }
  | { type: "directive-name"; prefix: string }
  | { type: "abcls-parse-options"; prefix: string }
  | { type: "abcls-fmt-options"; prefix: string }
  | { type: "abcls-voices-options"; prefix: string };

/**
 * Determines the type of directive completion needed based on the line content
 * and cursor position. Because textBeforeCursor is the text from the start of
 * the line up to the cursor, the regex /^%%/ only matches when %% appears at
 * the very beginning of the line with no preceding whitespace.
 */
export function getDirectiveCompletionContext(
  lineText: string,
  charPosition: number
): DirectiveCompletionContext {
  const textBeforeCursor = lineText.slice(0, charPosition);

  // Check if we're after %% at line start (no leading whitespace allowed)
  if (!textBeforeCursor.match(/^%%/)) {
    return { type: "none" };
  }

  // Extract what's after %%
  const afterPercent = textBeforeCursor.slice(2);

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

  // If just %% or %%<partial>, offer directive names
  return { type: "directive-name", prefix: afterPercent };
}

/**
 * Creates completion items from a directive options array, filtering by prefix.
 * This consolidated helper is used for all directive option completions.
 */
export function getDirectiveCompletions(
  options: DirectiveCompletion[],
  prefix: string,
  kind: CompletionItemKind
): CompletionItem[] {
  return options
    .filter((d) => d.label.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((directive, index) => ({
      label: directive.label,
      kind,
      documentation: directive.documentation,
      insertText: directive.label,
      data: { type: "directive-completion", index },
    }));
}
