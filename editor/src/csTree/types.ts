import { TT } from "abc-parser";

export interface TokenData {
  type: "token";
  lexeme: string;
  tokenType: TT;
  line: number;
  position: number;
}

export interface EmptyData {
  type: "empty";
}

export type NodeData = TokenData | EmptyData;

export interface CSNode {
  tag: string;
  id: number;
  data: NodeData;
  firstChild: CSNode | null;
  nextSibling: CSNode | null;
}

export function isTokenNode(node: CSNode): node is CSNode & { data: TokenData } {
  return node.data.type === "token";
}

export function getTokenData(node: CSNode): TokenData {
  if (node.data.type !== "token") throw new Error("getTokenData called on non-token node");
  return node.data as TokenData;
}

export function createCSNode(tag: string, id: number, data: NodeData): CSNode {
  return { tag, id, data, firstChild: null, nextSibling: null };
}

export const TAGS: Record<string, string> = {
  File_structure: "File_structure",
  Tune: "Tune",
  Tune_header: "Tune_header",
  Tune_Body: "Tune_Body",
  System: "System",
  Info_line: "Info_line",
  Note: "Note",
  Pitch: "Pitch",
  Rhythm: "Rhythm",
  Rest: "Rest",
  Chord: "Chord",
  Beam: "Beam",
  Grace_group: "Grace_group",
  BarLine: "BarLine",
  Decoration: "Decoration",
  Annotation: "Annotation",
  Inline_field: "Inline_field",
  MultiMeasureRest: "MultiMeasureRest",
  YSPACER: "YSPACER",
  SystemBreak: "SystemBreak",
  Symbol: "Symbol",
  Tuplet: "Tuplet",
  Music_code: "Music_code",
  Voice_overlay: "Voice_overlay",
  Line_continuation: "Line_continuation",
  Comment: "Comment",
  Directive: "Directive",
  Measurement: "Measurement",
  Rational: "Rational",
  File_header: "File_header",
  Lyric_section: "Lyric_section",
  AbsolutePitch: "AbsolutePitch",
  Lyric_line: "Lyric_line",
  Macro_decl: "Macro_decl",
  Macro_invocation: "Macro_invocation",
  User_symbol_decl: "User_symbol_decl",
  User_symbol_invocation: "User_symbol_invocation",
  KV: "KV",
  Binary: "Binary",
  Unary: "Unary",
  Grouping: "Grouping",
  ChordSymbol: "ChordSymbol",
  ErrorExpr: "ErrorExpr",
  SymbolLine: "SymbolLine",
  Token: "Token",
};

export function isRest(node: CSNode): boolean {
  return node.tag === TAGS.Rest;
}

export function isNote(node: CSNode): boolean {
  return node.tag === TAGS.Note;
}

export function isChord(node: CSNode): boolean {
  return node.tag === TAGS.Chord;
}

export function isBarLine(node: CSNode): boolean {
  return node.tag === TAGS.BarLine;
}

export function isBeam(node: CSNode): boolean {
  return node.tag === TAGS.Beam;
}

export function isRhythm(node: CSNode): boolean {
  return node.tag === TAGS.Rhythm;
}

export function isYSpacer(node: CSNode): boolean {
  return node.tag === TAGS.YSPACER;
}

export function hasRhythmChild(node: CSNode): boolean {
  let child = node.firstChild;
  while (child !== null) {
    if (child.tag === TAGS.Rhythm) {
      return true;
    }
    child = child.nextSibling;
  }
  return false;
}

export function isRhythmParent(node: CSNode): boolean {
  const isParentType = isNote(node) || isChord(node) || isRest(node) || isYSpacer(node);
  return isParentType && hasRhythmChild(node);
}
