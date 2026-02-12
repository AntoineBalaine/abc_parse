import { CSNode } from "../csTree/types";
import { firstTokenData } from "../selectors/treeWalk";
import {
  encode,
  getSnapshotAtPosition,
  TuneSnapshots,
  ContextSnapshot,
} from "abc-parser/interpreter/ContextInterpreter";

/**
 * Gets the context snapshot for a CSNode.
 * Uses the node's first token to determine position, then queries the flat snapshot list.
 *
 * @param node The CSNode to get context for
 * @param tuneSnapshots The snapshots for the tune containing the node
 * @returns The context at the node's position, or null if position cannot be determined
 */
export function getContextForNode(
  node: CSNode,
  tuneSnapshots: TuneSnapshots
): ContextSnapshot | null {
  const tokenData = firstTokenData(node);
  if (!tokenData) return null;

  const pos = encode(tokenData.line, tokenData.position);
  return getSnapshotAtPosition(tuneSnapshots, pos);
}
