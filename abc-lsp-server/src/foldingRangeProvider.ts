/**
 * Folding Range Provider for ABC notation files.
 *
 * Provides folding ranges for various structural elements in ABC files:
 * - Tunes (X: to end of tune)
 * - Tune headers (X: through K:)
 * - Tune bodies (after K: to end of tune)
 * - Voice sections (V: markers)
 * - Part sections (P: markers)
 * - Comment blocks (contiguous % lines)
 * - Directive blocks (contiguous %% lines)
 * - Info field sequences (contiguous same-type fields)
 */

import { FoldingRange, FoldingRangeKind } from "vscode-languageserver";
import {
  File_structure,
  Tune,
  Info_line,
  Comment,
  Directive,
  Inline_field,
  RangeVisitor,
  Token,
  TT,
} from "abc-parser";

/**
 * Configuration for which fold types to generate.
 */
export interface FoldingConfig {
  tune: boolean;
  tuneHeader: boolean;
  tuneBody: boolean;
  voiceSection: boolean;
  partSection: boolean;
  commentBlock: boolean;
  directiveBlock: boolean;
  infoFieldSequence: boolean;
}

/**
 * Default folding configuration.
 * Info field sequences are disabled by default because they can be noisy.
 */
export const DEFAULT_FOLDING_CONFIG: FoldingConfig = {
  tune: true,
  tuneHeader: true,
  tuneBody: true,
  voiceSection: true,
  partSection: true,
  commentBlock: true,
  directiveBlock: true,
  infoFieldSequence: false,
};

/**
 * Compute folding ranges for an ABC file.
 *
 * @param ast - The parsed AST of the ABC file
 * @param tokens - The token array from the scanner (used for comment/directive detection)
 * @param config - Configuration for which fold types to generate
 * @returns Array of FoldingRange objects
 */
export function computeFoldingRanges(
  ast: File_structure,
  tokens: Token[],
  config: FoldingConfig = DEFAULT_FOLDING_CONFIG
): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  const rangeVisitor = new RangeVisitor();

  // Extract tunes from the AST
  const tunes = ast.contents.filter((item): item is Tune => item instanceof Tune);

  // Collect tune-level folds
  if (config.tune) {
    ranges.push(...computeTuneFolds(tunes, rangeVisitor));
  }

  // Collect tune header folds
  if (config.tuneHeader) {
    ranges.push(...computeTuneHeaderFolds(tunes, rangeVisitor));
  }

  // Collect tune body folds
  if (config.tuneBody) {
    ranges.push(...computeTuneBodyFolds(tunes, rangeVisitor));
  }

  // Collect voice section folds
  if (config.voiceSection) {
    ranges.push(...computeVoiceSectionFolds(tunes, tokens));
  }

  // Collect part section folds
  if (config.partSection) {
    ranges.push(...computePartSectionFolds(tunes, tokens, rangeVisitor));
  }

  // Collect comment block folds
  if (config.commentBlock) {
    ranges.push(...computeCommentBlockFolds(tokens));
  }

  // Collect directive block folds
  if (config.directiveBlock) {
    ranges.push(...computeDirectiveBlockFolds(tokens));
  }

  // Collect info field sequence folds
  if (config.infoFieldSequence) {
    ranges.push(...computeInfoFieldSequenceFolds(tunes, rangeVisitor));
  }

  return ranges;
}

/**
 * Compute folds for entire tunes (X: to end of tune).
 */
function computeTuneFolds(tunes: Tune[], rangeVisitor: RangeVisitor): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  for (const tune of tunes) {
    try {
      const tuneRange = tune.accept(rangeVisitor);
      if (tuneRange?.start && tuneRange?.end && tuneRange.start.line !== tuneRange.end.line) {
        ranges.push({
          startLine: tuneRange.start.line,
          endLine: tuneRange.end.line,
          kind: FoldingRangeKind.Region,
        });
      }
    } catch {
      // Skip tunes that cannot be ranged (e.g., incomplete tunes)
      continue;
    }
  }

  return ranges;
}

/**
 * Compute folds for tune headers (X: through K:).
 */
function computeTuneHeaderFolds(tunes: Tune[], rangeVisitor: RangeVisitor): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  for (const tune of tunes) {
    const header = tune.tune_header;
    const headerRange = header.accept(rangeVisitor);

    if (headerRange.start.line !== headerRange.end.line) {
      ranges.push({
        startLine: headerRange.start.line,
        endLine: headerRange.end.line,
        kind: FoldingRangeKind.Region,
      });
    }
  }

  return ranges;
}

/**
 * Compute folds for tune bodies (after K: to end of tune).
 */
function computeTuneBodyFolds(tunes: Tune[], rangeVisitor: RangeVisitor): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  for (const tune of tunes) {
    const body = tune.tune_body;
    if (!body || body.sequence.length === 0) {
      continue;
    }

    const bodyRange = body.accept(rangeVisitor);
    if (bodyRange.start.line !== bodyRange.end.line) {
      ranges.push({
        startLine: bodyRange.start.line,
        endLine: bodyRange.end.line,
        kind: FoldingRangeKind.Region,
      });
    }
  }

  return ranges;
}

/**
 * Compute folds for voice sections (V: markers).
 * Each contiguous block of content belonging to a voice is a separate fold.
 */
function computeVoiceSectionFolds(tunes: Tune[], tokens: Token[]): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  // Build a map of tune boundaries (by line number of X: field)
  const tuneBoundaries: { startLine: number; endLine: number }[] = [];
  for (const tune of tunes) {
    const xField = tune.tune_header.info_lines.find(
      (line) => line instanceof Info_line && line.key.lexeme === "X:"
    );
    if (!xField) continue;

    const startLine = (xField as Info_line).key.line;
    const endLine = findTuneEndLine(tune, tokens);
    tuneBoundaries.push({ startLine, endLine });
  }

  // Find V: tokens (voice markers) within each tune
  for (const boundary of tuneBoundaries) {
    const voiceTokens = tokens.filter(
      (t) =>
        t.type === TT.INF_HDR &&
        t.lexeme === "V:" &&
        t.line >= boundary.startLine &&
        t.line <= boundary.endLine
    );

    if (voiceTokens.length === 0) continue;

    // For each voice marker, create a fold from the V: line to just before the next V: or end of tune
    for (let i = 0; i < voiceTokens.length; i++) {
      const startLine = voiceTokens[i].line;
      const endLine = i + 1 < voiceTokens.length ? voiceTokens[i + 1].line - 1 : boundary.endLine;

      if (startLine !== endLine) {
        ranges.push({
          startLine,
          endLine,
          kind: FoldingRangeKind.Region,
        });
      }
    }
  }

  return ranges;
}

/**
 * Compute folds for part sections (P: markers).
 */
function computePartSectionFolds(
  tunes: Tune[],
  tokens: Token[],
  rangeVisitor: RangeVisitor
): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  for (const tune of tunes) {
    const tuneEndLine = findTuneEndLine(tune, tokens);
    const partMarkers: number[] = [];

    // Find P: info lines in header
    for (const line of tune.tune_header.info_lines) {
      if (line instanceof Info_line && line.key.lexeme === "P:") {
        partMarkers.push(line.key.line);
      }
    }

    // Find P: inline fields and info lines in body
    if (tune.tune_body) {
      for (const system of tune.tune_body.sequence) {
        for (const element of system) {
          if (element instanceof Info_line && element.key.lexeme === "P:") {
            partMarkers.push(element.key.line);
          } else if (element instanceof Inline_field && element.field.lexeme.startsWith("P:")) {
            partMarkers.push(element.field.line);
          }
        }
      }
    }

    // Sort part markers by line
    partMarkers.sort((a, b) => a - b);

    // Create folds between part markers
    for (let i = 0; i < partMarkers.length; i++) {
      const startLine = partMarkers[i];
      const endLine = i + 1 < partMarkers.length ? partMarkers[i + 1] - 1 : tuneEndLine;

      if (startLine !== endLine) {
        ranges.push({
          startLine,
          endLine,
          kind: FoldingRangeKind.Region,
        });
      }
    }
  }

  return ranges;
}

/**
 * Compute folds for contiguous comment blocks (% lines, not %%).
 */
function computeCommentBlockFolds(tokens: Token[]): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  // Find all comment tokens (lines starting with % but not %%)
  const commentTokens = tokens.filter(
    (t) => t.type === TT.COMMENT && !t.lexeme.startsWith("%%")
  );

  if (commentTokens.length === 0) return ranges;

  // Group contiguous comment lines
  let blockStart = commentTokens[0].line;
  let blockEnd = commentTokens[0].line;

  for (let i = 1; i < commentTokens.length; i++) {
    const currentLine = commentTokens[i].line;

    if (currentLine === blockEnd + 1) {
      // Contiguous: extend the block
      blockEnd = currentLine;
    } else {
      // Non-contiguous: emit the previous block if it spans multiple lines
      if (blockStart !== blockEnd) {
        ranges.push({
          startLine: blockStart,
          endLine: blockEnd,
          kind: FoldingRangeKind.Comment,
        });
      }
      // Start a new block
      blockStart = currentLine;
      blockEnd = currentLine;
    }
  }

  // Emit the final block if it spans multiple lines
  if (blockStart !== blockEnd) {
    ranges.push({
      startLine: blockStart,
      endLine: blockEnd,
      kind: FoldingRangeKind.Comment,
    });
  }

  return ranges;
}

/**
 * Compute folds for contiguous directive blocks (%% lines).
 */
function computeDirectiveBlockFolds(tokens: Token[]): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  // Find all directive tokens (lines starting with %%)
  const directiveTokens = tokens.filter(
    (t) => t.type === TT.STYLESHEET_DIRECTIVE || (t.type === TT.COMMENT && t.lexeme.startsWith("%%"))
  );

  if (directiveTokens.length === 0) return ranges;

  // Group contiguous directive lines
  let blockStart = directiveTokens[0].line;
  let blockEnd = directiveTokens[0].line;

  for (let i = 1; i < directiveTokens.length; i++) {
    const currentLine = directiveTokens[i].line;

    if (currentLine === blockEnd + 1) {
      // Contiguous: extend the block
      blockEnd = currentLine;
    } else {
      // Non-contiguous: emit the previous block if it spans multiple lines
      if (blockStart !== blockEnd) {
        ranges.push({
          startLine: blockStart,
          endLine: blockEnd,
          kind: FoldingRangeKind.Region,
        });
      }
      // Start a new block
      blockStart = currentLine;
      blockEnd = currentLine;
    }
  }

  // Emit the final block if it spans multiple lines
  if (blockStart !== blockEnd) {
    ranges.push({
      startLine: blockStart,
      endLine: blockEnd,
      kind: FoldingRangeKind.Region,
    });
  }

  return ranges;
}

/**
 * Compute folds for contiguous info field sequences of the same type.
 * For example, multiple W: lines for lyrics.
 */
function computeInfoFieldSequenceFolds(tunes: Tune[], rangeVisitor: RangeVisitor): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  for (const tune of tunes) {
    // Process header info lines
    ranges.push(...findInfoFieldSequences(tune.tune_header.info_lines, rangeVisitor));

    // Process body info lines
    if (tune.tune_body) {
      for (const system of tune.tune_body.sequence) {
        const infoLines = system.filter((e): e is Info_line => e instanceof Info_line);
        ranges.push(...findInfoFieldSequences(infoLines, rangeVisitor));
      }
    }
  }

  return ranges;
}

/**
 * Find sequences of contiguous info fields of the same type.
 */
function findInfoFieldSequences(
  infoLines: unknown[],
  rangeVisitor: RangeVisitor
): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  // Filter to just Info_line instances
  const lines = infoLines.filter((line): line is Info_line => line instanceof Info_line);

  if (lines.length < 2) return ranges;

  let currentType: string | null = null;
  let sequenceStart: number | null = null;
  let sequenceEnd: number | null = null;

  for (const line of lines) {
    const fieldType = line.key.lexeme.charAt(0); // Get the letter part (e.g., "W" from "W:")
    const lineNum = line.key.line;

    if (fieldType === currentType && sequenceEnd !== null && lineNum === sequenceEnd + 1) {
      // Extend the current sequence
      sequenceEnd = lineNum;
    } else {
      // Emit the previous sequence if it spans multiple lines
      if (sequenceStart !== null && sequenceEnd !== null && sequenceStart !== sequenceEnd) {
        ranges.push({
          startLine: sequenceStart,
          endLine: sequenceEnd,
          kind: FoldingRangeKind.Region,
        });
      }

      // Start a new sequence
      currentType = fieldType;
      sequenceStart = lineNum;
      sequenceEnd = lineNum;
    }
  }

  // Emit the final sequence if it spans multiple lines
  if (sequenceStart !== null && sequenceEnd !== null && sequenceStart !== sequenceEnd) {
    ranges.push({
      startLine: sequenceStart,
      endLine: sequenceEnd,
      kind: FoldingRangeKind.Region,
    });
  }

  return ranges;
}

/**
 * Find the end line of a tune by looking at the last token before the next X: or EOF.
 */
function findTuneEndLine(tune: Tune, tokens: Token[]): number {
  const rangeVisitor = new RangeVisitor();
  const tuneRange = tune.accept(rangeVisitor);
  return tuneRange.end.line;
}
