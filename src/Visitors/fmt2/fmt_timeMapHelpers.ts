import { isChord, isNote } from "../../helpers2";
import { Token, TT } from "../../parsers/scan2";
import { BarLine, Beam, Expr, MultiMeasureRest, System } from "../../types/Expr2";
import { Rational } from "./rational";

export type NodeID = number;
export type TimeStamp = Rational;

export interface VoiceSplit {
  type: "formatted" | "noformat" | "symbol_line";
  content: System;
}

export interface Location {
  voiceIdx: number;
  nodeID: number;
}

export interface BarTimeMap {
  startNodeId: NodeID;
  map: Map<string, NodeID>; // Key is string representation of Rational
  // We use string keys because JavaScript Map can't use objects as keys based on their value equality
}

export interface BarAlignment {
  startNodes: Map<number, NodeID>; // voiceIdx -> startNodeId
  map: Map<string, Array<Location>>; // Key is string representation of Rational
}

// Helper function to safely get the ID of an expression or token
export function getNodeId(node: Expr | Token): NodeID {
  return node.id;
}

export function findFmtblLines(system: System): VoiceSplit[] {
  const splits = splitLines(system);
  return splits.map((split) => {
    if (isFormattableLine(split)) {
      return {
        type: "formatted",
        content: split,
      };
    } else if (split.some((n) => isToken(n) && n.type === TT.SY_HDR)) {
      return {
        type: "symbol_line",
        content: split,
      };
    } else {
      return {
        type: "noformat",
        content: split,
      };
    }
  });
}

// Helper functions for type checking
export function isToken(element: Expr | Token): element is Token {
  return element instanceof Token;
}

export function isBarLine(element: Expr | Token): element is BarLine {
  return element instanceof BarLine;
}

export function isBeam(element: Expr | Token): element is Beam {
  return element instanceof Beam;
}

export function isMultiMeasureRest(element: Expr | Token): element is MultiMeasureRest {
  return element instanceof MultiMeasureRest;
}

export function splitLines(system: System): System[] {
  const splits: System[] = [];
  let currentSplit: System = [];

  for (const node of system) {
    if (isToken(node) && node.type === TT.EOL) {
      currentSplit.push(node);
      splits.push(currentSplit);
      currentSplit = [];
    } else {
      currentSplit.push(node);
    }
  }

  if (currentSplit.length > 0) {
    splits.push(currentSplit);
  }

  return splits;
}

function isFormattableLine(line: System): boolean {
  // Check if line contains music content that needs formatting
  return line.some((node) => isNote(node) || isBeam(node) || isBarLine(node) || isMultiMeasureRest(node) || isChord(node));
}
