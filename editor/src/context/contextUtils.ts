import { CSNode } from "../csTree/types";
import { firstTokenData } from "../selectors/treeWalk";
import { encode, getSnapshotAtPosition, DocumentSnapshots, ContextSnapshot } from "abc-parser/interpreter/ContextInterpreter";

/**
 * Gets the context snapshot for a CSNode.
 * Uses the node's first token to determine position, then queries the flat snapshot list.
 *
 * @param node The CSNode to get context for
 * @param snapshots The document snapshots array
 * @returns The context at the node's position, or null if position cannot be determined
 */
export function getContextForNode(node: CSNode, snapshots: DocumentSnapshots): ContextSnapshot | null {
  const tokenData = firstTokenData(node);
  if (!tokenData) return null;

  const pos = encode(tokenData.line, tokenData.position);
  return getSnapshotAtPosition(snapshots, pos);
}
