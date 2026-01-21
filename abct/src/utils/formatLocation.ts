// Shared utility for formatting location selectors
// Used by tokenize.ts and AbctFormatter.ts

import { RangeEnd } from "../ast";

/**
 * Location data that can be formatted as a location selector string
 */
export interface LocationData {
  line: number;
  col?: number;
  end?: RangeEnd;
}

/**
 * Format a location as a selector string.
 * Produces: :line, :line:col, :line:col-endCol, or :line:col-endLine:endCol
 */
export function formatLocation(loc: LocationData): string {
  let result = `:${loc.line}`;
  if (loc.col !== undefined) {
    result += `:${loc.col}`;
    if (loc.end) {
      if (loc.end.type === "singleline") {
        result += `-${loc.end.endCol}`;
      } else {
        result += `-${loc.end.endLine}:${loc.end.endCol}`;
      }
    }
  }
  return result;
}
