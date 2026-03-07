import { TT } from "abc-parser";
import type { CSNode as CSTNode, CSNodeOf, ParentRef } from "cstree";

export type { ParentRef, CSNodeOf };

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

export enum TAGS {
  File_structure = "File_structure",
  Tune = "Tune",
  Tune_header = "Tune_header",
  Tune_Body = "Tune_Body",
  System = "System",
  Info_line = "Info_line",
  Note = "Note",
  Pitch = "Pitch",
  Rhythm = "Rhythm",
  Rest = "Rest",
  Chord = "Chord",
  Beam = "Beam",
  Grace_group = "Grace_group",
  BarLine = "BarLine",
  Decoration = "Decoration",
  Annotation = "Annotation",
  Inline_field = "Inline_field",
  MultiMeasureRest = "MultiMeasureRest",
  YSPACER = "YSPACER",
  SystemBreak = "SystemBreak",
  Symbol = "Symbol",
  Tuplet = "Tuplet",
  Voice_overlay = "Voice_overlay",
  Line_continuation = "Line_continuation",
  Comment = "Comment",
  Directive = "Directive",
  Measurement = "Measurement",
  Rational = "Rational",
  File_header = "File_header",
  Lyric_section = "Lyric_section",
  AbsolutePitch = "AbsolutePitch",
  Lyric_line = "Lyric_line",
  Macro_decl = "Macro_decl",
  Macro_invocation = "Macro_invocation",
  User_symbol_decl = "User_symbol_decl",
  User_symbol_invocation = "User_symbol_invocation",
  KV = "KV",
  Binary = "Binary",
  Unary = "Unary",
  Grouping = "Grouping",
  ChordSymbol = "ChordSymbol",
  ErrorExpr = "ErrorExpr",
  SymbolLine = "SymbolLine",
  Token = "Token",
}

export type EditorDataMap = {
  [TAGS.File_structure]: EmptyData;
  [TAGS.Tune]: EmptyData;
  [TAGS.Tune_header]: EmptyData;
  [TAGS.Tune_Body]: EmptyData;
  [TAGS.System]: EmptyData;
  [TAGS.Info_line]: EmptyData;
  [TAGS.Note]: EmptyData;
  [TAGS.Pitch]: EmptyData;
  [TAGS.Rhythm]: EmptyData;
  [TAGS.Rest]: EmptyData;
  [TAGS.Chord]: EmptyData;
  [TAGS.Beam]: EmptyData;
  [TAGS.Grace_group]: EmptyData;
  [TAGS.BarLine]: EmptyData;
  [TAGS.Decoration]: EmptyData;
  [TAGS.Annotation]: EmptyData;
  [TAGS.Inline_field]: EmptyData;
  [TAGS.MultiMeasureRest]: EmptyData;
  [TAGS.YSPACER]: EmptyData;
  [TAGS.SystemBreak]: EmptyData;
  [TAGS.Symbol]: EmptyData;
  [TAGS.Tuplet]: EmptyData;
  [TAGS.Voice_overlay]: EmptyData;
  [TAGS.Line_continuation]: EmptyData;
  [TAGS.Comment]: EmptyData;
  [TAGS.Directive]: EmptyData;
  [TAGS.Measurement]: EmptyData;
  [TAGS.Rational]: EmptyData;
  [TAGS.File_header]: EmptyData;
  [TAGS.Lyric_section]: EmptyData;
  [TAGS.AbsolutePitch]: EmptyData;
  [TAGS.Lyric_line]: EmptyData;
  [TAGS.Macro_decl]: EmptyData;
  [TAGS.Macro_invocation]: EmptyData;
  [TAGS.User_symbol_decl]: EmptyData;
  [TAGS.User_symbol_invocation]: EmptyData;
  [TAGS.KV]: EmptyData;
  [TAGS.Binary]: EmptyData;
  [TAGS.Unary]: EmptyData;
  [TAGS.Grouping]: EmptyData;
  [TAGS.ChordSymbol]: EmptyData;
  [TAGS.ErrorExpr]: EmptyData;
  [TAGS.SymbolLine]: EmptyData;
  [TAGS.Token]: TokenData;
};

export type CSNode = CSTNode<TAGS, EditorDataMap>;

export function isTokenNode(node: CSNode): node is CSNodeOf<TAGS.Token, TAGS, EditorDataMap> {
  return node.tag === TAGS.Token;
}

export function getTokenData(node: CSNode): TokenData {
  if (node.tag !== TAGS.Token) throw new Error("getTokenData called on non-token node");
  return node.data;
}

export function createCSNode<K extends TAGS>(tag: K, id: number, data: EditorDataMap[K]): CSNodeOf<K, TAGS, EditorDataMap> {
  return { tag, id, data, firstChild: null, nextSibling: null, parentRef: null };
}

export function isRest(node: CSNode): boolean {
  return node.tag === TAGS.Rest || node.tag === TAGS.MultiMeasureRest;
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
