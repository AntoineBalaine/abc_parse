/**
 * Articulation Mapping
 *
 * Maps ABC decorations (from ABCJS Decorations enum) to MuseSampler
 * articulation flags (from NoteArticulation).
 */

import { Decorations } from "../types/abcjs-ast";
import { NoteArticulation, NoteArticulation2, NoteArticulationFlags } from "./types";

/**
 * Maps ABC decorations to MuseSampler articulation flags.
 *
 * Not all ABC decorations have a direct MuseSampler equivalent.
 * Unmapped decorations will be ignored during conversion.
 */
const DECORATION_TO_ARTICULATION: Partial<Record<Decorations, bigint>> = {
  // Basic articulations
  [Decorations.Staccato]: NoteArticulation.Staccato,
  [Decorations.Accent]: NoteArticulation.Accent,
  [Decorations.Tenuto]: NoteArticulation.Tenuto,
  [Decorations.Marcato]: NoteArticulation.Marcato,
  [Decorations.UMarcato]: NoteArticulation.Marcato,

  // Ornaments
  [Decorations.Trill]: NoteArticulation.Trill,
  [Decorations.Mordent]: NoteArticulation.MordentSemi,
  [Decorations.Pralltriller]: NoteArticulation.MordentSemi,
  [Decorations.LowerMordent]: NoteArticulation.MordentInvertedSemi,
  [Decorations.UpperMordent]: NoteArticulation.MordentSemi,
  [Decorations.Turn]: NoteArticulation.TurnSemiWhole,
  [Decorations.TurnX]: NoteArticulation.TurnSemiWhole,
  [Decorations.InvertedTurn]: NoteArticulation.TurnInvertedSemiWhole,
  [Decorations.InvertedTurnX]: NoteArticulation.TurnInvertedSemiWhole,

  // Tremolo
  [Decorations.Trem1]: NoteArticulation.Tremolo1,
  [Decorations.Trem2]: NoteArticulation.Tremolo2,
  [Decorations.Trem3]: NoteArticulation.Tremolo3,
  [Decorations.Trem4]: NoteArticulation.Tremolo3, // No Tremolo4 in MuseSampler

  // String techniques
  [Decorations.Upbow]: NoteArticulation.None, // No direct mapping
  [Decorations.Downbow]: NoteArticulation.None, // No direct mapping
  [Decorations.Open]: NoteArticulation.Open,
  [Decorations.Snap]: NoteArticulation.SnapPizzicato,

  // Jazz articulations
  [Decorations.Slide]: NoteArticulation.Glissando,

  // Arpeggio
  [Decorations.Arpeggio]: NoteArticulation.ArpeggioUp,

  // Other
  [Decorations.Fermata]: NoteArticulation.None, // Handled via duration adjustment
  [Decorations.InvertedFermata]: NoteArticulation.None,
  [Decorations.Breath]: NoteArticulation.None, // Gap between notes
  [Decorations.Roll]: NoteArticulation.Tremolo1, // Irish roll as tremolo
  [Decorations.IrishRoll]: NoteArticulation.Tremolo1,
};

/**
 * Decorations that affect playback but are not articulations.
 * These should be handled separately in the converter.
 */
export const NON_ARTICULATION_DECORATIONS: Set<Decorations> = new Set([
  // Dynamics - handled via DynamicsEvent
  Decorations.P,
  Decorations.PP,
  Decorations.PPP,
  Decorations.PPPP,
  Decorations.F,
  Decorations.FF,
  Decorations.FFF,
  Decorations.FFFF,
  Decorations.MF,
  Decorations.MP,
  Decorations.SFZ,

  // Crescendo/Diminuendo - handled via dynamics curve
  Decorations.CrescendoStart,
  Decorations.CrescendoEnd,
  Decorations.DiminuendoStart,
  Decorations.DiminuendoEnd,

  // Fermata - handled via duration
  Decorations.Fermata,
  Decorations.InvertedFermata,

  // Navigation marks - not playback relevant in this context
  Decorations.Segno,
  Decorations.Coda,
  Decorations.DS,
  Decorations.DC,
  Decorations.Fine,
  Decorations.DCAlCoda,
  Decorations.DCAlFine,
  Decorations.DSAlCoda,
  Decorations.DSAlFine,

  // Phrase marks
  Decorations.ShortPhrase,
  Decorations.MediumPhrase,
  Decorations.LongPhrase,
  Decorations.Breath,

  // Fingering
  Decorations.Zero,
  Decorations.One,
  Decorations.Two,
  Decorations.Three,
  Decorations.Four,
  Decorations.Five,
  Decorations.Plus,
  Decorations.Thumb,

  // Visual only
  Decorations.Mark,
  Decorations.Editorial,
  Decorations.Courtesy,
  Decorations.XStem,
  Decorations.Wedge,
]);

/**
 * Maps dynamics decorations to a normalized value (0.0 - 1.0).
 */
export const DYNAMICS_MAP: Partial<Record<Decorations, number>> = {
  [Decorations.PPPP]: 0.1,
  [Decorations.PPP]: 0.2,
  [Decorations.PP]: 0.3,
  [Decorations.P]: 0.4,
  [Decorations.MP]: 0.5,
  [Decorations.MF]: 0.6,
  [Decorations.F]: 0.7,
  [Decorations.FF]: 0.8,
  [Decorations.FFF]: 0.9,
  [Decorations.FFFF]: 1.0,
  [Decorations.SFZ]: 0.9, // Accent + loud
};

/**
 * Converts an array of ABC decorations to MuseSampler articulation flags.
 *
 * @param decorations - Array of ABC Decorations
 * @returns Combined articulation flags (bigint)
 */
export function decorationsToArticulation(decorations: Decorations[]): NoteArticulationFlags {
  let flags = NoteArticulation.None;

  for (const decoration of decorations) {
    const flag = DECORATION_TO_ARTICULATION[decoration];
    if (flag !== undefined) {
      flags |= flag;
    }
  }

  return flags;
}

/**
 * Extracts the dynamics value from an array of decorations.
 *
 * @param decorations - Array of ABC Decorations
 * @returns Dynamics value (0.0 - 1.0) or undefined if no dynamics found
 */
export function extractDynamics(decorations: Decorations[]): number | undefined {
  for (const decoration of decorations) {
    const value = DYNAMICS_MAP[decoration];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/**
 * Checks if a decoration is a fermata (affects duration).
 */
export function isFermata(decoration: Decorations): boolean {
  return decoration === Decorations.Fermata || decoration === Decorations.InvertedFermata;
}

/**
 * Checks if any decoration in the array is a fermata.
 */
export function hasFermata(decorations: Decorations[]): boolean {
  return decorations.some(isFermata);
}
