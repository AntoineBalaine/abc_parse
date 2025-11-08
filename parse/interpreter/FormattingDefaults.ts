/**
 * FormattingDefaults.ts
 *
 * Because abcjs includes comprehensive default font and formatting settings,
 * we match those defaults to ensure compatibility when comparing outputs.
 *
 * These defaults were extracted from abcjs source code and verified by parsing
 * simple ABC files with the abcjs parser.
 */

export interface FontProperties {
  face: string;
  size: number;
  weight: "normal" | "bold";
  style: "normal" | "italic";
  decoration: "none" | "underline";
}

/**
 * Default formatting properties that match abcjs behavior.
 * Because abcjs initializes all font properties with sensible defaults,
 * we replicate that behavior to ensure consistent output structure.
 */
export const ABCJS_FORMATTING_DEFAULTS: Record<string, any> = {
  // Font definitions for various text elements
  composerfont: {
    face: '"Times New Roman"',
    size: 14,
    weight: "normal",
    style: "italic",
    decoration: "none",
  },
  subtitlefont: {
    face: '"Times New Roman"',
    size: 16,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  tempofont: {
    face: '"Times New Roman"',
    size: 15,
    weight: "bold",
    style: "normal",
    decoration: "none",
  },
  titlefont: {
    face: '"Times New Roman"',
    size: 20,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  footerfont: {
    face: '"Times New Roman"',
    size: 12,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  headerfont: {
    face: '"Times New Roman"',
    size: 12,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  voicefont: {
    face: '"Times New Roman"',
    size: 13,
    weight: "bold",
    style: "normal",
    decoration: "none",
  },
  tablabelfont: {
    face: '"Trebuchet MS"',
    size: 16,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  tabnumberfont: {
    face: '"Arial"',
    size: 11,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  tabgracefont: {
    face: '"Arial"',
    size: 8,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  annotationfont: {
    face: "Helvetica",
    size: 12,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  gchordfont: {
    face: "Helvetica",
    size: 12,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  historyfont: {
    face: '"Times New Roman"',
    size: 16,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  infofont: {
    face: '"Times New Roman"',
    size: 14,
    weight: "normal",
    style: "italic",
    decoration: "none",
  },
  measurefont: {
    face: '"Times New Roman"',
    size: 14,
    weight: "normal",
    style: "italic",
    decoration: "none",
  },
  partsfont: {
    face: '"Times New Roman"',
    size: 15,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  repeatfont: {
    face: '"Times New Roman"',
    size: 13,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  textfont: {
    face: '"Times New Roman"',
    size: 16,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },
  tripletfont: {
    face: "Times",
    size: 11,
    weight: "normal",
    style: "italic",
    decoration: "none",
  },
  vocalfont: {
    face: '"Times New Roman"',
    size: 13,
    weight: "bold",
    style: "normal",
    decoration: "none",
  },
  wordsfont: {
    face: '"Times New Roman"',
    size: 16,
    weight: "normal",
    style: "normal",
    decoration: "none",
  },

  // Page dimensions (in points, 72 points = 1 inch)
  // Default is US Letter: 8.5" x 11" = 612pt x 792pt
  pagewidth: 612,
  pageheight: 792,
};
