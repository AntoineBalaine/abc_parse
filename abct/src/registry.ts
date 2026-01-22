// ABCT Registry - Transform and Selector metadata with documentation
// Used by diagnostics, hover, and auto-completion features

/**
 * Argument specification for transforms
 */
export interface ArgSpec {
  name: string;
  type: "integer" | "number" | "string" | "list" | "expression";
  required: boolean;
  description: string;
  default?: string;
}

/**
 * Transform function metadata with documentation
 */
export interface TransformInfo {
  name: string;
  description: string;
  documentation: string;
  args: ArgSpec[];
  examples: string[];
  seeAlso: string[];
}

/**
 * Selector metadata with documentation
 */
export interface SelectorInfo {
  name: string;
  shortForm: string;
  description: string;
  documentation: string;
  examples: string[];
}

/**
 * Registry of all available transform functions with their documentation.
 */
export const transformRegistry: Map<string, TransformInfo> = new Map([
  [
    "transpose",
    {
      name: "transpose",
      description: "Shift pitches by n semitones",
      documentation: `Transpose shifts all pitches in the selection by a given number of semitones.

Positive values shift up, negative values shift down. The function handles:
- Accidentals (sharps, flats, naturals)
- Octave changes when crossing boundaries
- Key signature adjustments`,
      args: [
        {
          name: "n",
          type: "integer",
          required: true,
          description: "Number of semitones to shift (positive = up, negative = down)",
        },
      ],
      examples: ["transpose 2", "transpose -5", "song.abc | @notes |= transpose 12"],
      seeAlso: ["octave"],
    },
  ],
  [
    "octave",
    {
      name: "octave",
      description: "Shift pitches by n octaves",
      documentation: `Octave shifts all pitches in the selection by a given number of octaves.

This is equivalent to transpose by n * 12 semitones, but preserves the pitch class.`,
      args: [
        {
          name: "n",
          type: "integer",
          required: true,
          description: "Number of octaves to shift (positive = up, negative = down)",
        },
      ],
      examples: ["octave 1", "octave -2", "song.abc | @chords |= octave -1"],
      seeAlso: ["transpose"],
    },
  ],
  [
    "retrograde",
    {
      name: "retrograde",
      description: "Reverse the order of notes",
      documentation: `Retrograde reverses the temporal order of all notes in the selection.

The first note becomes the last, the second becomes second-to-last, etc.
This is a common compositional technique in counterpoint and twelve-tone music.`,
      args: [],
      examples: ["retrograde", "song.abc | @notes |= retrograde"],
      seeAlso: [],
    },
  ],
  [
    "bass",
    {
      name: "bass",
      description: "Extract or generate bass line from chords",
      documentation: `Bass extracts the lowest note from each chord to create a bass line.

For single notes, the note is preserved as-is. For chords, only the lowest pitched note is kept.`,
      args: [],
      examples: ["bass", "song.abc | @chords |= bass"],
      seeAlso: [],
    },
  ],
  [
    "filter",
    {
      name: "filter",
      description: "Remove elements that do not match a predicate",
      documentation: `Filter removes notes or chords from the selection based on a comparison predicate.

Supported properties:
- pitch: MIDI pitch value (for notes). Use scientific notation: C4, D#5, Gb3.
  Uppercase without octave = octave 4 (C = C4 = MIDI 60).
  Lowercase without octave = octave 5 (c = C5 = MIDI 72).
- size/length: Number of notes in a chord.

Comparison operators: >, <, >=, <=, ==, !=

Behavior:
- Pitch filter on notes: removes non-matching notes
- Pitch filter on chords: filters notes within chords, removes empty chords
- Size filter on chords: removes non-matching chords entirely`,
      args: [
        {
          name: "predicate",
          type: "expression",
          required: true,
          description: "Comparison expression: (property op value), e.g., (pitch > C4)",
        },
      ],
      examples: [
        "filter (pitch > C4)",
        "filter (size >= 3)",
        "song.abc | @notes | filter (pitch >= D4)",
        "song.abc | @chords | filter (size == 2)",
      ],
      seeAlso: [],
    },
  ],
]);

/**
 * Registry of all available selectors with their documentation.
 */
export const selectorRegistry: Map<string, SelectorInfo> = new Map([
  [
    "chords",
    {
      name: "chords",
      shortForm: "c",
      description: "Select all chord nodes",
      documentation: `Select all chord nodes in the ABC file.

Chords are notated as [CEG] in ABC - multiple notes enclosed in square brackets
that are played simultaneously. Single notes are not selected by this selector.`,
      examples: ["@chords", "@c", "song.abc | @chords |= transpose 2"],
    },
  ],
  [
    "notes",
    {
      name: "notes",
      shortForm: "n",
      description: "Select all note nodes",
      documentation: `Select all individual note nodes in the ABC file.

This includes:
- Standalone notes
- Notes inside beams
- Notes inside grace groups
- Notes inside chords`,
      examples: ["@notes", "@n", "song.abc | @notes |= octave 1"],
    },
  ],
  [
    "voices",
    {
      name: "voices",
      shortForm: "v",
      description: "Select nodes in a specific voice",
      documentation: `Select all nodes belonging to a specific voice.

Voice is determined by V: info line or inline [V:] field declarations.
The voice identifier can be a name or number.`,
      examples: ["@V:melody", "@V:1", "@v:soprano", "song.abc | @V:bass |= octave -1"],
    },
  ],
  [
    "measures",
    {
      name: "measures",
      shortForm: "m",
      description: "Select nodes within a measure range",
      documentation: `Select all nodes within a range of measures (bars).

Measures are numbered starting from 1. The range is inclusive on both ends.
The music before the first barline is considered measure 1.`,
      examples: ["@M:1-4", "@m:5", "song.abc | @M:1-8 |= transpose 2"],
    },
  ],
  [
    "bass",
    {
      name: "bass",
      shortForm: "b",
      description: "Select the bass note (lowest note) from each chord",
      documentation: `Select the bass note (lowest-pitched note) from each chord.

This selector finds the lowest note in each chord and adds it to the selection.
Single notes are skipped - this selector only operates on chords.

Use this to target bass notes for further operations without mutating the chords.`,
      examples: ["@bass", "@b", "song.abc | @chords |= (@bass | transpose -12)"],
    },
  ],
]);

/**
 * Get transform info by name.
 * @param name - The transform name (e.g., "transpose", "bass")
 * @returns The transform info, or undefined if not found
 */
export function getTransformInfo(name: string): TransformInfo | undefined {
  return transformRegistry.get(name);
}

/**
 * Get selector info by name (supports both full and short forms).
 * @param name - The selector name (e.g., "chords", "c", "notes", "n")
 * @returns The selector info, or undefined if not found
 */
export function getSelectorInfo(name: string): SelectorInfo | undefined {
  // Try exact match first
  const exact = selectorRegistry.get(name.toLowerCase());
  if (exact) return exact;

  // Try to find by short form
  for (const info of selectorRegistry.values()) {
    if (info.shortForm === name.toLowerCase()) {
      return info;
    }
  }

  return undefined;
}

/**
 * Get all transform names.
 */
export function getAllTransformNames(): string[] {
  return Array.from(transformRegistry.keys());
}

/**
 * Get all selector names (both full and short forms).
 */
export function getAllSelectorNames(): { full: string; short: string }[] {
  return Array.from(selectorRegistry.values()).map((info) => ({
    full: info.name,
    short: info.shortForm,
  }));
}

/**
 * Find similar transform names for suggestions (used in diagnostics).
 * @param name - The unknown transform name
 * @returns Array of similar transform names
 */
export function findSimilarTransforms(name: string): string[] {
  const normalizedName = name.toLowerCase();
  const results: { name: string; distance: number }[] = [];

  for (const transformName of transformRegistry.keys()) {
    const dist = levenshteinDistance(normalizedName, transformName.toLowerCase());
    if (dist <= 3) {
      results.push({ name: transformName, distance: dist });
    }
  }

  return results.sort((a, b) => a.distance - b.distance).map((r) => r.name);
}

/**
 * Find similar selector names for suggestions.
 * @param name - The unknown selector name
 * @returns Array of similar selector names
 */
export function findSimilarSelectors(name: string): string[] {
  const normalizedName = name.toLowerCase();
  const results: { name: string; distance: number }[] = [];

  for (const info of selectorRegistry.values()) {
    const distFull = levenshteinDistance(normalizedName, info.name.toLowerCase());
    if (distFull <= 3) {
      results.push({ name: info.name, distance: distFull });
    }

    const distShort = levenshteinDistance(normalizedName, info.shortForm.toLowerCase());
    if (distShort <= 2 && !results.find((r) => r.name === info.name)) {
      results.push({ name: info.shortForm, distance: distShort });
    }
  }

  return results.sort((a, b) => a.distance - b.distance).map((r) => r.name);
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}
