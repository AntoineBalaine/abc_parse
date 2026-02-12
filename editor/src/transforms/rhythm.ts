import { IRational, createRational, Rhythm, Token, TT, ABCContext } from "abc-parser";
import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { toAst } from "../csTree/toAst";
import { fromAst } from "../csTree/fromAst";
import { findRhythmChild, appendChild } from "./treeUtils";

export function extractBrokenToken(rhythmNode: CSNode): CSNode | null {
  let current = rhythmNode.firstChild;
  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.RHY_BRKN) {
      current.nextSibling = null;
      return current;
    }
    current = current.nextSibling;
  }
  return null;
}

export function rhythmToRational(rhythmNode: CSNode): IRational {
  const rhythmExpr = toAst(rhythmNode) as Rhythm;

  let numerator = 1;
  let denominator = 1;

  if (rhythmExpr.numerator) {
    numerator = parseInt(rhythmExpr.numerator.lexeme, 10);
  }

  if (rhythmExpr.separator) {
    const slashCount = rhythmExpr.separator.lexeme.length;
    if (rhythmExpr.denominator) {
      denominator = parseInt(rhythmExpr.denominator.lexeme, 10);
    } else {
      denominator = Math.pow(2, slashCount);
    }
  }

  return createRational(numerator, denominator);
}

export function rationalToRhythm(rational: IRational, ctx: ABCContext, brokenToken?: CSNode | null): CSNode | null {
  // Normalize the fraction to ensure canonical output
  const normalized = createRational(rational.numerator, rational.denominator);
  let { numerator, denominator } = normalized;

  // Clamp negative results to default note length, but preserve zero (for zero-duration notes)
  if (numerator < 0) {
    numerator = 1;
    denominator = 1;
  }

  if (numerator === 1 && denominator === 1 && !brokenToken) {
    return null; // Caller should remove the Rhythm child entirely
  }

  // Build the Rhythm Expr tokens
  let numToken: Token | null = null;
  let sepToken: Token | undefined = undefined;
  let denToken: Token | undefined = undefined;

  if (numerator !== 1 || denominator !== 1) {
    // We need actual rhythm tokens (not just the broken annotation)
    if (denominator === 1) {
      numToken = new Token(TT.RHY_NUMER, numerator.toString(), ctx.generateId());
    } else {
      if (numerator !== 1) {
        numToken = new Token(TT.RHY_NUMER, numerator.toString(), ctx.generateId());
      }
      sepToken = new Token(TT.RHY_SEP, "/", ctx.generateId());
      if (denominator !== 2) {
        denToken = new Token(TT.RHY_DENOM, denominator.toString(), ctx.generateId());
      }
    }
  }

  // Build the Rhythm Expr (broken token is handled at the CSNode level, not in the Expr)
  const rhythmExpr = new Rhythm(ctx.generateId(), numToken, sepToken, denToken ?? null);

  // Convert to CSNode subtree
  const rhythmCSNode = fromAst(rhythmExpr, ctx);

  // Append the broken token at the end of the Rhythm's child chain (if provided)
  if (brokenToken) {
    brokenToken.nextSibling = null;
    appendChild(rhythmCSNode, brokenToken);
  }

  return rhythmCSNode;
}

export function getNodeRhythm(parent: CSNode): IRational {
  const rhythmChild = findRhythmChild(parent);
  if (rhythmChild === null) {
    return createRational(1, 1);
  }
  return rhythmToRational(rhythmChild.node);
}
