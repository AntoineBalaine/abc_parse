"use strict";
/**
 * Character-level diff algorithm for ABCT patch generation
 *
 * Uses LCS (Longest Common Subsequence) to find character differences
 * and converts them to line:column positions for patch expressions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffChars = diffChars;
exports.generatePatches = generatePatches;
/**
 * Convert a flat character offset to line:column position (1-based)
 */
function offsetToPosition(text, offset) {
    let line = 1;
    let column = 1;
    for (let i = 0; i < offset && i < text.length; i++) {
        if (text[i] === "\n") {
            line++;
            column = 1;
        }
        else {
            column++;
        }
    }
    return { line, column };
}
/**
 * Compute LCS (Longest Common Subsequence) indices
 * Returns pairs of (originalIndex, modifiedIndex) for matching characters
 */
function computeLCS(original, modified) {
    const m = original.length;
    const n = modified.length;
    // Build LCS length table
    const dp = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (original[i - 1] === modified[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    // Backtrack to find LCS pairs
    const pairs = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        if (original[i - 1] === modified[j - 1]) {
            pairs.unshift([i - 1, j - 1]);
            i--;
            j--;
        }
        else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        }
        else {
            j--;
        }
    }
    return pairs;
}
/**
 * Compute character-level diff between original and modified text
 *
 * @param original - The original text
 * @param modified - The modified text
 * @returns Array of changes, sorted by position (ascending)
 */
function diffChars(original, modified) {
    // Handle edge cases
    if (original === modified) {
        return [];
    }
    if (original.length === 0) {
        // All content is an insert at position 1:1
        return [
            {
                type: "insert",
                originalStart: { line: 1, column: 1 },
                originalEnd: { line: 1, column: 1 },
                newContent: modified,
            },
        ];
    }
    if (modified.length === 0) {
        // All content is a delete from 1:1 to end
        // Use original.length - 1 to get position of last character (inclusive end)
        const endPos = offsetToPosition(original, original.length - 1);
        return [
            {
                type: "delete",
                originalStart: { line: 1, column: 1 },
                originalEnd: endPos,
                newContent: "",
            },
        ];
    }
    // Compute LCS
    const lcs = computeLCS(original, modified);
    // Build change list by walking through both strings
    const changes = [];
    let origIdx = 0;
    let modIdx = 0;
    let lcsIdx = 0;
    while (origIdx < original.length || modIdx < modified.length) {
        // Find next LCS pair
        const nextOrigMatch = lcsIdx < lcs.length ? lcs[lcsIdx][0] : original.length;
        const nextModMatch = lcsIdx < lcs.length ? lcs[lcsIdx][1] : modified.length;
        // Characters before next match are changes
        const origDeleted = original.substring(origIdx, nextOrigMatch);
        const modInserted = modified.substring(modIdx, nextModMatch);
        if (origDeleted.length > 0 || modInserted.length > 0) {
            const startPos = offsetToPosition(original, origIdx);
            if (origDeleted.length > 0 && modInserted.length > 0) {
                // Replace: endOffset is index of last character being replaced (inclusive)
                const endOffset = origIdx + origDeleted.length - 1;
                const endPos = offsetToPosition(original, endOffset);
                changes.push({
                    type: "replace",
                    originalStart: startPos,
                    originalEnd: endPos,
                    newContent: modInserted,
                });
            }
            else if (origDeleted.length > 0) {
                // Delete only
                const endOffset = origIdx + origDeleted.length - 1;
                const endPos = offsetToPosition(original, endOffset);
                changes.push({
                    type: "delete",
                    originalStart: startPos,
                    originalEnd: endPos,
                    newContent: "",
                });
            }
            else {
                // Insert only
                // Insert happens at the position in the original where we're currently at
                changes.push({
                    type: "insert",
                    originalStart: startPos,
                    originalEnd: startPos,
                    newContent: modInserted,
                });
            }
        }
        // Move past the LCS match
        if (lcsIdx < lcs.length) {
            origIdx = nextOrigMatch + 1;
            modIdx = nextModMatch + 1;
            lcsIdx++;
        }
        else {
            break;
        }
    }
    return changes;
}
/**
 * Generate patch expressions from changes
 *
 * @param changes - Array of changes from diffChars
 * @param sourceExpr - The source expression to use in patches (e.g., variable name)
 * @returns Array of patch expression strings
 */
function generatePatches(changes, sourceExpr) {
    // Sort changes by position descending (so later patches don't shift earlier positions)
    const sortedChanges = [...changes].sort((a, b) => {
        if (a.originalStart.line !== b.originalStart.line) {
            return b.originalStart.line - a.originalStart.line;
        }
        return b.originalStart.column - a.originalStart.column;
    });
    return sortedChanges.map((change) => {
        const start = change.originalStart;
        const end = change.originalEnd;
        let selector;
        if (start.line === end.line) {
            // Single-line selector
            if (start.column === end.column && change.type === "insert") {
                // Insert at a point
                selector = `:${start.line}:${start.column}`;
            }
            else {
                selector = `:${start.line}:${start.column}-${end.column}`;
            }
        }
        else {
            // Multi-line selector
            selector = `:${start.line}:${start.column}-${end.line}:${end.column}`;
        }
        // Escape content for ABC literal (escape triple backticks)
        const escapedContent = sanitizeAbcContent(change.newContent);
        return `${sourceExpr} | ${selector} |= \`\`\`abc\n${escapedContent}\n\`\`\``;
    });
}
/**
 * Sanitize ABC content for embedding in a triple-backtick fence
 * Escapes triple backticks to avoid premature fence closure
 */
function sanitizeAbcContent(content) {
    return content.replace(/```/g, "\\`\\`\\`");
}
//# sourceMappingURL=diffToPatches.js.map