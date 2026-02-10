/**
 * System selector for the editor module.
 *
 * Expands selections to cover entire system(s) they touch:
 * - If selection is within a single system, expands to cover the whole system
 * - If selection spans multiple systems, produces one cursor per system
 * - Includes preceding info lines that apply to each system (but not comments)
 */

import { CSNode, TAGS } from "../csTree/types";
import { Selection, Cursor } from "../selection";
import { findByTag } from "./treeWalk";
import { collectCursorIds, hasDescendantInScope, collectDescendantIds, expandScopeToDescendants } from "./scopeUtils";

/**
 * Finds preceding Info_line nodes for a System node.
 * Because CSNode has no previousSibling pointer, we build an array of preceding siblings
 * first, then walk backwards through it.
 *
 * Stops when encountering:
 * - Another System node (we've hit the previous system's content)
 * - Any non-Info_line, non-Comment node (structural boundary)
 *
 * Comments are skipped but don't stop the walk.
 *
 * Note: In the current CSTree structure (as of Phase 1), Info_lines in the tune body
 * are children of System nodes, not siblings. This function is provided for potential
 * future scenarios where Info_lines might exist as siblings between System nodes
 * (e.g., tempo changes or other directives that might be placed between systems).
 * Currently, this function will typically return an empty array.
 */
function findPrecedingInfoLines(systemNode: CSNode, parentNode: CSNode): CSNode[] {
  // Build array of siblings before systemNode
  const siblings: CSNode[] = [];
  let current = parentNode.firstChild;
  while (current !== null && current !== systemNode) {
    siblings.push(current);
    current = current.nextSibling;
  }

  // Walk backwards, collecting Info_lines
  const infoLines: CSNode[] = [];
  for (let i = siblings.length - 1; i >= 0; i--) {
    const node = siblings[i];
    if (node.tag === TAGS.Comment) {
      continue; // skip comments but keep walking
    }
    if (node.tag === TAGS.Info_line) {
      infoLines.unshift(node); // prepend to maintain document order
    } else if (node.tag === TAGS.System) {
      break; // hit another system, stop
    } else {
      break; // hit non-info-line/non-comment, stop
    }
  }

  return infoLines;
}

/**
 * Expands selections to cover entire system(s) they touch.
 *
 * Behavior:
 * - If selection is within a single system, expands to cover the whole system
 * - If selection spans multiple systems, produces one cursor per system
 * - Cursors in the same system are merged
 * - Includes preceding info lines that apply to each system (but not comments)
 * - Works across all tunes in the selection
 *
 * Edge cases:
 * - Selection entirely outside any System (e.g., in tune header): returns input unchanged
 * - Selection spanning multiple tunes: each tune's systems handled independently
 * - Empty input cursors: returns input unchanged
 * - Single cursor containing IDs from multiple systems: produces separate output cursors
 * - Adjacent systems with no info lines between them: each gets its own cursor
 * - Tune with no Tune_Body: returns input unchanged
 *
 * @param input - The input selection
 * @returns A new Selection with one cursor per matched System, or the original selection
 *          if no Systems matched
 */
export function selectSystem(input: Selection): Selection {
  // Collect all input cursor IDs and expand to include descendants.
  // This ensures that when the root (or any parent node) is selected,
  // all its descendant systems are considered in scope.
  const rawScopeIds = collectCursorIds(input.cursors);

  if (rawScopeIds.size === 0) {
    return input;
  }

  const scopeIds = expandScopeToDescendants(input.root, rawScopeIds);

  const outputCursors: Cursor[] = [];

  // Find all Tune_Body nodes
  const tuneBodies = findByTag(input.root, TAGS.Tune_Body);

  for (const tuneBody of tuneBodies) {
    // Iterate direct children of Tune_Body (which are System nodes)
    let systemChild = tuneBody.firstChild;
    while (systemChild !== null) {
      if (systemChild.tag === TAGS.System) {
        // Check if this System has any selected content
        if (hasDescendantInScope(systemChild, scopeIds)) {
          // Build cursor for this System and its preceding info lines
          const cursor: Cursor = new Set<number>();

          // Find and add preceding Info_lines
          const precedingInfoLines = findPrecedingInfoLines(systemChild, tuneBody);
          for (const infoLine of precedingInfoLines) {
            collectDescendantIds(infoLine, cursor);
          }

          // Add all IDs from the System itself
          collectDescendantIds(systemChild, cursor);

          outputCursors.push(cursor);
        }
      }
      systemChild = systemChild.nextSibling;
    }
  }

  // If no Systems matched, return input unchanged
  if (outputCursors.length === 0) {
    return input;
  }

  return { root: input.root, cursors: outputCursors };
}
