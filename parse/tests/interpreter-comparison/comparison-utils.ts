/**
 * comparison-utils.ts
 *
 * Utilities for comparing tunes from different parsers with tolerance for type differences
 */

import { Tune, MetaText } from "../../types/abcjs-ast";
import { AbcjsRawTune } from "./abcjs-wrapper";
import { abcjsToOurFormat, FLOAT_TOLERANCE } from "./type-converters";

// ============================================================================
// Types
// ============================================================================

export interface Difference {
  path: string;
  yours: any;
  abcjs: any;
  severity: 'critical' | 'minor' | 'type-mismatch';
  message?: string;
}

export interface TypeDiscrepancy {
  field: string;
  yourType: string;
  abcjsType: string;
  needsConverter: boolean;
  notes?: string;
}

export interface ParseStats {
  tuneCount: number;
  voiceCount: number;
  lineCount: number;
  elementCount: number;
  errors: number;
  warnings: number;
}

export interface ComparisonResult {
  matches: boolean;
  differences: Difference[];
  metadata: {
    yourParser: ParseStats;
    abcjs: ParseStats;
  };
  typeDiscrepancies: TypeDiscrepancy[];
}

// ============================================================================
// Normalized Tune Structure (for comparison)
// ============================================================================

/**
 * Normalized tune structure for comparison
 * Converts both formats to this structure before comparing
 */
export interface NormalizedTune {
  version: string;
  media: string;
  metaText: {
    title?: string;
    composer?: string;
    origin?: string;
    [key: string]: any;
  };
  formatting: Record<string, any>;
  staffNum: number;
  voiceNum: number;
  lineNum: number;
  lines: any[]; // Keep as-is for now, normalize later if needed
}

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize a tune (from either format) for comparison
 */
export function normalizeTune(tune: Tune | AbcjsRawTune): NormalizedTune {
  // If it's an abcjs raw tune, convert it first
  const ourFormatTune = isAbcjsRawTune(tune) ? abcjsToOurFormat(tune) : tune;

  // Extract comparable fields
  return {
    version: ourFormatTune.version || '2.1',
    media: typeof ourFormatTune.media === 'string' ? ourFormatTune.media : 'screen',
    metaText: normalizeMetaText(ourFormatTune.metaText),
    formatting: ourFormatTune.formatting || {},
    staffNum: ourFormatTune.staffNum || 0,
    voiceNum: ourFormatTune.voiceNum || 0,
    lineNum: ourFormatTune.lineNum || 0,
    lines: ourFormatTune.lines || [],
  };
}

/**
 * Normalize metaText for comparison
 */
function normalizeMetaText(metaText: MetaText): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(metaText)) {
    if (value === undefined || value === null) continue;

    // Normalize string/array fields to string for comparison
    if (Array.isArray(value)) {
      normalized[key] = Array.isArray(value[0]) ? value[0] : value.join(' ');
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Type guard for AbcjsRawTune
 */
function isAbcjsRawTune(tune: any): tune is AbcjsRawTune {
  // Check if it has abcjs-specific structure
  // For now, assume all tunes without our specific methods are raw
  return !tune.getBeatLength || typeof tune.getBeatLength !== 'function';
}

// ============================================================================
// Comparison Functions
// ============================================================================

/**
 * Compare two tunes and return detailed comparison result
 */
export function compareTunes(
  yourTune: Tune,
  abcjsTune: AbcjsRawTune,
  options: { strict?: boolean } = {}
): ComparisonResult {
  const differences: Difference[] = [];
  const typeDiscrepancies: TypeDiscrepancy[] = [];

  // Normalize both tunes
  const yours = normalizeTune(yourTune);
  const theirs = normalizeTune(abcjsTune);

  // Compare basic fields
  compareField(differences, 'version', yours.version, theirs.version, options.strict);
  compareField(differences, 'media', yours.media, theirs.media, options.strict);
  compareField(differences, 'staffNum', yours.staffNum, theirs.staffNum, true);
  compareField(differences, 'voiceNum', yours.voiceNum, theirs.voiceNum, true);
  compareField(differences, 'lineNum', yours.lineNum, theirs.lineNum, true);

  // Compare metaText
  compareMetaText(differences, yours.metaText, theirs.metaText, options.strict);

  // Compare formatting (shallow for now)
  compareFormatting(differences, yours.formatting, theirs.formatting, options.strict);

  // TODO: Deep comparison of lines array
  // This is complex and will be added later

  // Calculate stats
  const metadata = {
    yourParser: calculateStats(yours),
    abcjs: calculateStats(theirs),
  };

  return {
    matches: differences.length === 0,
    differences,
    metadata,
    typeDiscrepancies,
  };
}

/**
 * Compare a single field
 */
function compareField(
  differences: Difference[],
  path: string,
  yours: any,
  theirs: any,
  strict: boolean = false
): void {
  // Handle numbers with tolerance
  if (typeof yours === 'number' && typeof theirs === 'number') {
    if (Math.abs(yours - theirs) > FLOAT_TOLERANCE) {
      differences.push({
        path,
        yours,
        abcjs: theirs,
        severity: strict ? 'critical' : 'minor',
        message: `Numeric values differ: ${yours} vs ${theirs}`,
      });
    }
    return;
  }

  // Handle strings
  if (typeof yours === 'string' && typeof theirs === 'string') {
    if (yours !== theirs) {
      differences.push({
        path,
        yours,
        abcjs: theirs,
        severity: strict ? 'critical' : 'minor',
        message: `String values differ`,
      });
    }
    return;
  }

  // Handle type mismatches
  if (typeof yours !== typeof theirs) {
    differences.push({
      path,
      yours,
      abcjs: theirs,
      severity: 'type-mismatch',
      message: `Type mismatch: ${typeof yours} vs ${typeof theirs}`,
    });
    return;
  }

  // Handle undefined/null
  if (yours === undefined && theirs === undefined) return;
  if (yours === null && theirs === null) return;
  if (yours === undefined || theirs === undefined || yours === null || theirs === null) {
    differences.push({
      path,
      yours,
      abcjs: theirs,
      severity: 'minor',
      message: `One value is undefined/null`,
    });
  }
}

/**
 * Compare metaText objects
 */
function compareMetaText(
  differences: Difference[],
  yours: Record<string, any>,
  theirs: Record<string, any>,
  strict: boolean = false
): void {
  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(yours), ...Object.keys(theirs)]);

  for (const key of allKeys) {
    compareField(differences, `metaText.${key}`, yours[key], theirs[key], strict);
  }
}

/**
 * Compare formatting objects (shallow comparison for now)
 */
function compareFormatting(
  differences: Difference[],
  yours: Record<string, any>,
  theirs: Record<string, any>,
  strict: boolean = false
): void {
  const yourKeys = Object.keys(yours);
  const theirKeys = Object.keys(theirs);

  // Check for missing keys
  const yourOnly = yourKeys.filter((k) => !(k in theirs));
  const theirOnly = theirKeys.filter((k) => !(k in yours));

  if (yourOnly.length > 0) {
    differences.push({
      path: 'formatting',
      yours: yourOnly,
      abcjs: [],
      severity: 'minor',
      message: `Keys only in your parser: ${yourOnly.join(', ')}`,
    });
  }

  if (theirOnly.length > 0) {
    differences.push({
      path: 'formatting',
      yours: [],
      abcjs: theirOnly,
      severity: 'minor',
      message: `Keys only in abcjs: ${theirOnly.join(', ')}`,
    });
  }

  // Compare common keys (shallow)
  for (const key of yourKeys) {
    if (key in theirs) {
      compareField(differences, `formatting.${key}`, yours[key], theirs[key], false);
    }
  }
}

/**
 * Calculate stats for a normalized tune
 */
function calculateStats(tune: NormalizedTune): ParseStats {
  let elementCount = 0;

  // Count elements in lines
  for (const line of tune.lines) {
    if ('staff' in line) {
      for (const staff of line.staff) {
        for (const voice of staff.voices) {
          elementCount += voice.length;
        }
      }
    }
  }

  return {
    tuneCount: 1,
    voiceCount: tune.voiceNum,
    lineCount: tune.lineNum,
    elementCount,
    errors: 0, // Not tracked yet
    warnings: 0, // Not tracked yet
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if two tunes are approximately equal
 */
export function tunesApproximatelyEqual(
  yourTune: Tune,
  abcjsTune: AbcjsRawTune,
  options: { strict?: boolean; tolerance?: number } = {}
): boolean {
  const result = compareTunes(yourTune, abcjsTune, options);

  // Allow minor differences and type mismatches (which are expected)
  const criticalDifferences = result.differences.filter(d => d.severity === 'critical');

  return criticalDifferences.length === 0;
}

/**
 * Format comparison result for display
 */
export function formatComparisonResult(result: ComparisonResult): string {
  const lines: string[] = [];

  lines.push(`=== Comparison Result ===`);
  lines.push(`Matches: ${result.matches}`);
  lines.push(`Total Differences: ${result.differences.length}`);
  lines.push(``);

  if (result.differences.length > 0) {
    lines.push(`Differences:`);
    for (const diff of result.differences) {
      lines.push(`  [${diff.severity}] ${diff.path}`);
      lines.push(`    Yours:  ${JSON.stringify(diff.yours)}`);
      lines.push(`    abcjs:  ${JSON.stringify(diff.abcjs)}`);
      if (diff.message) {
        lines.push(`    Note:   ${diff.message}`);
      }
      lines.push(``);
    }
  }

  lines.push(`Stats:`);
  lines.push(`  Your Parser:`);
  lines.push(`    Voices: ${result.metadata.yourParser.voiceCount}`);
  lines.push(`    Lines:  ${result.metadata.yourParser.lineCount}`);
  lines.push(`    Elements: ${result.metadata.yourParser.elementCount}`);
  lines.push(`  abcjs:`);
  lines.push(`    Voices: ${result.metadata.abcjs.voiceCount}`);
  lines.push(`    Lines:  ${result.metadata.abcjs.lineCount}`);
  lines.push(`    Elements: ${result.metadata.abcjs.elementCount}`);

  return lines.join('\n');
}
