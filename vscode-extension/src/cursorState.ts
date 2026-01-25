/**
 * Shared cursor state module for selector and transform commands.
 *
 * The cursor state tracks which CSTree node IDs are currently selected,
 * allowing multiple commands to operate on the same selection. The
 * expectedVersion field handles version-based coordination: when a
 * transform modifies the document, we store the expected post-edit
 * version to prevent the onDidChangeTextDocument handler from clearing
 * the cursor state.
 */

export interface CursorState {
  cursorNodeIds: number[];
  expectedVersion: number | null;
}

const stateByUri = new Map<string, CursorState>();

export function getCursorNodeIds(uri: string): number[] {
  return stateByUri.get(uri)?.cursorNodeIds ?? [];
}

export function setCursorNodeIds(uri: string, ids: number[]): void {
  const existing = stateByUri.get(uri);
  if (existing) {
    existing.cursorNodeIds = ids;
  } else {
    stateByUri.set(uri, { cursorNodeIds: ids, expectedVersion: null });
  }
}

export function clearCursorState(uri: string): void {
  stateByUri.delete(uri);
}

export function hasCursorState(uri: string): boolean {
  const state = stateByUri.get(uri);
  return state !== undefined && state.cursorNodeIds.length > 0;
}

/**
 * Records the expected document version after a transform edit.
 * Pass null to clear the expected version (e.g., after a failed edit).
 */
export function setExpectedVersion(uri: string, version: number | null): void {
  const existing = stateByUri.get(uri);
  if (existing) {
    existing.expectedVersion = version;
  } else if (version !== null) {
    stateByUri.set(uri, { cursorNodeIds: [], expectedVersion: version });
  }
}

/**
 * Checks whether a document change should skip clearing cursor state.
 * Returns true if the new version matches the expected version from
 * a transform command, consuming the expected version in the process.
 */
export function shouldSkipClear(uri: string, newVersion: number): boolean {
  const state = stateByUri.get(uri);
  if (state?.expectedVersion === newVersion) {
    state.expectedVersion = null;
    return true;
  }
  return false;
}
