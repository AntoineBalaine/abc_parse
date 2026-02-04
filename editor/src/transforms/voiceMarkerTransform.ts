import { Selection } from "../selection";
import { CSNode, TAGS, createCSNode, isTokenNode, getTokenData } from "../csTree/types";
import { ABCContext, TT } from "abc-parser";
import { findNodesById } from "./types";
import { findParent, insertBefore, removeChild, appendChild } from "./treeUtils";
import { findFirstByTag } from "../selectors/treeWalk";

/**
 * Returns true if node is an Info_line with V: key
 */
export function isVoiceInfoLine(node: CSNode): boolean {
  if (node.tag !== TAGS.Info_line) return false;
  const firstChild = node.firstChild;
  if (!firstChild || !isTokenNode(firstChild)) return false;
  return getTokenData(firstChild).lexeme === "V:";
}

/**
 * Returns true if node is an Inline_field with V: field
 */
export function isVoiceInlineField(node: CSNode): boolean {
  if (node.tag !== TAGS.Inline_field) return false;
  // Children: [leftBracket?, field, ...content, rightBracket?]
  // Find the field token (first non-bracket token)
  let current = node.firstChild;
  while (current !== null) {
    if (isTokenNode(current)) {
      const data = getTokenData(current);
      if (data.tokenType === TT.INLN_FLD_LFT_BRKT) {
        current = current.nextSibling;
        continue;
      }
      // This should be the field token
      return data.lexeme === "V:";
    }
    current = current.nextSibling;
  }
  return false;
}

/**
 * Returns true if node is a Token with type TT.EOL or TT.WS
 */
export function isEOLorWS(node: CSNode): boolean {
  if (!isTokenNode(node)) return false;
  const data = getTokenData(node);
  return data.tokenType === TT.EOL || data.tokenType === TT.WS;
}

/**
 * Finds the predecessor of target in parent's child list.
 * Returns null if target is firstChild.
 */
export function findPrev(parent: CSNode, target: CSNode): CSNode | null {
  let prev: CSNode | null = null;
  let current = parent.firstChild;
  while (current !== null) {
    if (current === target) {
      return prev;
    }
    prev = current;
    current = current.nextSibling;
  }
  return null;
}

/**
 * Extracts voice content CSNodes from either Info_line or Inline_field.
 * Returns cloned nodes (using structuredClone) to avoid sharing.
 */
export function extractVoiceContent(node: CSNode): CSNode[] {
  const result: CSNode[] = [];

  if (node.tag === TAGS.Info_line) {
    // For Info_line: children after the key token (V:)
    let current = node.firstChild;
    if (current) {
      current = current.nextSibling; // Skip the V: key token
    }
    while (current !== null) {
      result.push(structuredClone(current));
      current = current.nextSibling;
    }
  } else if (node.tag === TAGS.Inline_field) {
    // For Inline_field: children after left bracket and field token, before right bracket
    let current = node.firstChild;
    let foundField = false;

    while (current !== null) {
      if (isTokenNode(current)) {
        const data = getTokenData(current);
        if (data.tokenType === TT.INLN_FLD_LFT_BRKT) {
          current = current.nextSibling;
          continue;
        }
        if (data.tokenType === TT.INLN_FLD_RGT_BRKT) {
          break; // Stop before right bracket
        }
        if (!foundField) {
          // This is the field token (V:), skip it
          foundField = true;
          current = current.nextSibling;
          continue;
        }
      }
      result.push(structuredClone(current));
      current = current.nextSibling;
    }
  }

  // Clear nextSibling on cloned nodes (they'll be re-chained by the caller)
  for (const cloned of result) {
    cloned.nextSibling = null;
  }

  return result;
}

/**
 * Creates an Info_line CSNode from voice content.
 * Children: [V: token, ...voiceContent] linked via nextSibling
 */
export function createInfoLineFromContent(voiceContent: CSNode[], ctx: ABCContext): CSNode {
  const infoLine = createCSNode(TAGS.Info_line, ctx.generateId(), { type: "empty" });

  // Create V: key token
  const keyToken = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: "V:",
    tokenType: TT.INF_HDR,
    line: 0,
    position: 0,
  });

  // Build child chain
  infoLine.firstChild = keyToken;
  let current = keyToken;
  for (const content of voiceContent) {
    current.nextSibling = content;
    current = content;
  }

  return infoLine;
}

/**
 * Creates an Inline_field CSNode from voice content.
 * Children: [left bracket, V: token, ...voiceContent, right bracket]
 */
export function createInlineFieldFromContent(voiceContent: CSNode[], ctx: ABCContext): CSNode {
  const inlineField = createCSNode(TAGS.Inline_field, ctx.generateId(), { type: "empty" });

  // Create left bracket
  const leftBracket = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: "[",
    tokenType: TT.INLN_FLD_LFT_BRKT,
    line: 0,
    position: 0,
  });

  // Create V: field token
  const fieldToken = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: "V:",
    tokenType: TT.INF_HDR,
    line: 0,
    position: 1,
  });

  // Create right bracket
  const rightBracket = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: "]",
    tokenType: TT.INLN_FLD_RGT_BRKT,
    line: 0,
    position: 0,
  });

  // Build child chain: leftBracket -> fieldToken -> ...voiceContent -> rightBracket
  inlineField.firstChild = leftBracket;
  leftBracket.nextSibling = fieldToken;

  let current: CSNode = fieldToken;
  for (const content of voiceContent) {
    current.nextSibling = content;
    current = content;
  }
  current.nextSibling = rightBracket;

  return inlineField;
}

/**
 * Finds the first element after the most recent EOL token before target.
 * Traverses forward from parent.firstChild.
 * Returns parent.firstChild if no EOL found before target.
 */
export function findLineStart(parent: CSNode, target: CSNode): CSNode | null {
  let lineStart: CSNode | null = parent.firstChild;
  let current = parent.firstChild;

  while (current !== null && current !== target) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.EOL) {
      // The line starts at the element after this EOL
      lineStart = current.nextSibling;
    }
    current = current.nextSibling;
  }

  return lineStart;
}

/**
 * Removes node and any trailing EOL/WS tokens from the sibling chain.
 */
export function removeNodeAndTrailingEOL(parent: CSNode, prev: CSNode | null, node: CSNode): void {
  // First, find what comes after node and any trailing EOL/WS
  let trailing = node.nextSibling;
  while (trailing !== null && isEOLorWS(trailing)) {
    trailing = trailing.nextSibling;
  }

  // Remove by linking prev to trailing
  if (prev === null) {
    parent.firstChild = trailing;
  } else {
    prev.nextSibling = trailing;
  }
  node.nextSibling = null;
}

/**
 * Removes any leading WS token before node, the node itself, and any trailing WS after node.
 */
export function removeNodeAndSurroundingWS(parent: CSNode, prev: CSNode | null, node: CSNode): void {
  // Determine the actual start (skip leading WS if present)
  let actualPrev = prev;
  if (prev !== null && isTokenNode(prev) && getTokenData(prev).tokenType === TT.WS) {
    actualPrev = findPrev(parent, prev);
  }

  // Determine what comes after (skip trailing WS)
  let after = node.nextSibling;
  while (after !== null && isTokenNode(after) && getTokenData(after).tokenType === TT.WS) {
    after = after.nextSibling;
  }

  // Relink the chain
  if (actualPrev === null) {
    parent.firstChild = after;
  } else {
    actualPrev.nextSibling = after;
  }
}

/**
 * Converts V: info lines to [V:...] inline fields.
 * Operates on all voice info lines in the selection.
 */
export function voiceInfoLineToInline(selection: Selection, ctx: ABCContext): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);

    for (const voiceLine of nodes) {
      if (!isVoiceInfoLine(voiceLine)) continue;

      // Find parent and predecessor
      const parentInfo = findParent(selection.root, voiceLine);
      if (!parentInfo) continue;
      const { parent, prev } = parentInfo;

      // Only convert V: info lines in Tune_Body (via System), not in Tune_Header
      // Because of the System wrapper nodes, V: info lines are now children of System, not directly of Tune_Body
      let systemParent: CSNode | null = null;
      if (parent.tag === TAGS.System) {
        systemParent = parent;
      } else if (parent.tag !== TAGS.Tune_Body) {
        continue;
      }
      const containerParent = systemParent ?? parent;

      // Extract voice content (children after V: token)
      const voiceContent = extractVoiceContent(voiceLine);

      // Create inline field with brackets
      const inlineField = createInlineFieldFromContent(voiceContent, ctx);

      // Find next music content (skip EOL/WS tokens)
      let nextMusic = voiceLine.nextSibling;
      while (nextMusic !== null && isEOLorWS(nextMusic)) {
        nextMusic = nextMusic.nextSibling;
      }

      // Check if there's a trailing EOL after the voice line (before nextMusic or end)
      let hasTrailingEOL = false;
      let afterVoiceLine = voiceLine.nextSibling;
      while (afterVoiceLine !== null && afterVoiceLine !== nextMusic) {
        if (isTokenNode(afterVoiceLine) && getTokenData(afterVoiceLine).tokenType === TT.EOL) {
          hasTrailingEOL = true;
        }
        afterVoiceLine = afterVoiceLine.nextSibling;
      }

      // If no music content in current System, check the next System
      // because V: info lines might trigger system boundaries
      let insertContainer = containerParent;
      if (nextMusic === null && systemParent !== null) {
        const nextSystem = systemParent.nextSibling;
        if (nextSystem !== null && nextSystem.tag === TAGS.System) {
          // Find first non-whitespace content in next system
          let firstInNextSystem = nextSystem.firstChild;
          while (firstInNextSystem !== null && isEOLorWS(firstInNextSystem)) {
            firstInNextSystem = firstInNextSystem.nextSibling;
          }
          if (firstInNextSystem !== null) {
            nextMusic = firstInNextSystem;
            insertContainer = nextSystem;
          }
        }
      }

      // Remove voice info line and trailing EOL/WS first
      removeNodeAndTrailingEOL(containerParent, prev, voiceLine);

      // Now insert the inline field
      if (nextMusic !== null) {
        // Find predecessor of nextMusic (may have changed after removal)
        const nextPrev = findPrev(insertContainer, nextMusic);

        // Create space token
        const spaceToken = createCSNode(TAGS.Token, ctx.generateId(), {
          type: "token",
          lexeme: " ",
          tokenType: TT.WS,
          line: 0,
          position: 0,
        });

        // Insert inline field and space before next music content
        insertBefore(insertContainer, nextPrev, nextMusic, inlineField);
        insertBefore(insertContainer, inlineField, nextMusic, spaceToken);
      } else {
        // No following content - append inline field and preserve trailing EOL if there was one
        appendChild(containerParent, inlineField);
        if (hasTrailingEOL) {
          const trailingEOL = createCSNode(TAGS.Token, ctx.generateId(), {
            type: "token",
            lexeme: "\n",
            tokenType: TT.EOL,
            line: 0,
            position: 0,
          });
          appendChild(containerParent, trailingEOL);
        }
      }
    }
  }

  return selection;
}

/**
 * Finds the System node that contains the given node, and returns it along with
 * the container (System or Tune_Body for legacy paths) and the child within that container.
 */
function findContainerForNode(root: CSNode, target: CSNode): { container: CSNode; containerChild: CSNode; containerChildPrev: CSNode | null } | null {
  const parentInfo = findParent(root, target);
  if (!parentInfo) return null;

  const { parent: immediateParent, prev: prevInParent } = parentInfo;

  // Determine the container: System node or Tune_Body (for legacy paths)
  let container: CSNode;
  if (immediateParent.tag === TAGS.System) {
    container = immediateParent;
  } else {
    // Find the System or Tune_Body that contains this node
    const tuneBody = findFirstByTag(root, TAGS.Tune_Body);
    if (!tuneBody) return null;

    // Check if immediateParent is a System
    const systemParentInfo = findParent(root, immediateParent);
    if (systemParentInfo && systemParentInfo.parent.tag === TAGS.System) {
      container = systemParentInfo.parent;
    } else if (immediateParent === tuneBody) {
      container = tuneBody;
    } else {
      // Find which System contains the target
      let systemNode = tuneBody.firstChild;
      while (systemNode !== null) {
        if (systemNode.tag === TAGS.System && nodeContains(systemNode, target)) {
          container = systemNode;
          break;
        }
        systemNode = systemNode.nextSibling;
      }
      if (!container!) return null;
    }
  }

  // Find the direct child of container that contains or is the target
  let containerChild: CSNode | null = null;
  let containerChildPrev: CSNode | null = null;

  if (immediateParent === container) {
    containerChild = target;
    containerChildPrev = prevInParent;
  } else {
    let current: CSNode | null = container.firstChild;
    while (current !== null) {
      if (current === immediateParent || nodeContains(current, target)) {
        containerChild = current;
        break;
      }
      containerChildPrev = current;
      current = current.nextSibling;
    }
  }

  if (!containerChild) return null;

  return { container, containerChild, containerChildPrev };
}

/**
 * Converts [V:...] inline fields to V: info lines.
 * Operates on all voice inline fields in the selection.
 */
export function voiceInlineToInfoLine(selection: Selection, ctx: ABCContext): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);

    for (const inlineField of nodes) {
      if (!isVoiceInlineField(inlineField)) continue;

      // Find the immediate parent of the inline field (likely Music_code)
      const parentInfo = findParent(selection.root, inlineField);
      if (!parentInfo) continue;
      const { parent: immediateParent, prev: prevInParent } = parentInfo;

      // Find the container (System or Tune_Body) and the child within it
      const containerInfo = findContainerForNode(selection.root, inlineField);
      if (!containerInfo) continue;
      const { container, containerChild, containerChildPrev } = containerInfo;

      // Extract voice content (children between brackets, excluding V: token)
      const voiceContent = extractVoiceContent(inlineField);

      // Create info line
      const infoLine = createInfoLineFromContent(voiceContent, ctx);

      // Create EOL token
      const eolToken = createCSNode(TAGS.Token, ctx.generateId(), {
        type: "token",
        lexeme: "\n",
        tokenType: TT.EOL,
        line: 0,
        position: 0,
      });

      // Check if there's non-whitespace content before the inline field on the same line
      // If so, we need to insert an EOL first to end the current line
      let needsLeadingEOL = false;
      let currentContainerChildPrev = containerChildPrev;

      if (currentContainerChildPrev !== null) {
        // Walk backwards from prev to find if there's content on this line
        // We need an EOL if prev is not an EOL and there's real content
        if (!isTokenNode(currentContainerChildPrev) || getTokenData(currentContainerChildPrev).tokenType !== TT.EOL) {
          // Check if there's any non-WS content before containerChild
          let checkNode: CSNode | null = currentContainerChildPrev;
          while (checkNode !== null) {
            if (isTokenNode(checkNode)) {
              const tt = getTokenData(checkNode).tokenType;
              if (tt === TT.EOL) break; // Found EOL, stop checking
              if (tt !== TT.WS) {
                needsLeadingEOL = true;
                break;
              }
            } else {
              // Non-token node (like Note, etc.) = real content
              needsLeadingEOL = true;
              break;
            }
            checkNode = findPrev(container, checkNode);
          }
        }
      }

      // If there's content before the inline field, insert EOL first to end that line
      if (needsLeadingEOL) {
        const leadingEOL = createCSNode(TAGS.Token, ctx.generateId(), {
          type: "token",
          lexeme: "\n",
          tokenType: TT.EOL,
          line: 0,
          position: 0,
        });

        // Skip any trailing WS before the inline field when inserting EOL
        // We want: CDEF\n not CDEF \n
        let insertPrev = currentContainerChildPrev;
        while (insertPrev !== null && isTokenNode(insertPrev) && getTokenData(insertPrev).tokenType === TT.WS) {
          insertPrev = findPrev(container, insertPrev);
        }

        // Remove the WS nodes between insertPrev and containerChild
        if (insertPrev === null) {
          container.firstChild = leadingEOL;
        } else {
          insertPrev.nextSibling = leadingEOL;
        }
        leadingEOL.nextSibling = containerChild;

        // Update currentContainerChildPrev to point to the newly inserted EOL
        currentContainerChildPrev = leadingEOL;
      }

      // Insert Info_line and EOL before the containerChild
      insertBefore(container, currentContainerChildPrev, containerChild, infoLine);
      insertBefore(container, infoLine, containerChild, eolToken);

      // Remove inline field and surrounding whitespace from its immediate parent
      // After insertion, we need to find the new predecessor of the inline field
      if (immediateParent === container) {
        // The inline field is a direct child of container
        // After inserting Info_line and EOL, the predecessor of inline field is now EOL
        removeNodeAndSurroundingWS(container, eolToken, inlineField);
      } else {
        // The inline field is nested, remove from its immediate parent
        removeNodeAndSurroundingWS(immediateParent, prevInParent, inlineField);
      }
    }
  }

  return selection;
}

/**
 * Checks if parent node contains the target node in its subtree.
 */
export function nodeContains(parent: CSNode, target: CSNode): boolean {
  if (parent === target) return true;
  let child = parent.firstChild;
  while (child !== null) {
    if (nodeContains(child, target)) return true;
    child = child.nextSibling;
  }
  return false;
}
