import { CSNode, isTokenNode, getTokenData } from "../csTree/types";
import { IRational, TT } from "abc-parser";

/**
 * Checks if a number is a power of two.
 */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Checks if a rational is a power-of-two ratio (2^n / 2^m for integers n, m >= 0).
 */
export function isPowerOfTwoRational(r: IRational): boolean {
  return isPowerOfTwo(r.numerator) && isPowerOfTwo(r.denominator);
}

/**
 * Skips whitespace nodes to find the next meaningful sibling.
 */
export function nextMeaningfulSibling(node: CSNode): CSNode | null {
  let current = node.nextSibling;
  while (current !== null) {
    if (isTokenNode(current)) {
      const tokenData = getTokenData(current);
      if (tokenData.tokenType === TT.WS) {
        current = current.nextSibling;
        continue;
      }
    }
    return current;
  }
  return null;
}
