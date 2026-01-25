import {
  Token, Expr, File_structure, Tune, Tune_header, Tune_Body,
  Info_line, SymbolLine, Note, Pitch, Rhythm, Rest, Chord, Beam,
  Grace_group, BarLine, Decoration, Annotation, Inline_field,
  MultiMeasureRest, YSPACER, SystemBreak, Symbol, Tuplet,
  Music_code, Voice_overlay, Line_continuation, Comment,
  Directive, Measurement, Rational, File_header, Lyric_section,
  AbsolutePitch, Lyric_line, Macro_decl, Macro_invocation,
  User_symbol_decl, User_symbol_invocation, KV, Binary,
  Unary, Grouping, ChordSymbol, ErrorExpr, SymbolLine, Visitor
} from "abc-parser";
import { CSNode, TAGS, NodeData, createCSNode } from "./types";

function resolveTag(node: Expr | Token): string {
  if (node instanceof Token) return TAGS.Token;
  if (node instanceof File_structure) return TAGS.File_structure;
  if (node instanceof Tune) return TAGS.Tune;
  if (node instanceof Tune_header) return TAGS.Tune_header;
  if (node instanceof Tune_Body) return TAGS.Tune_Body;
  if (node instanceof Info_line) return TAGS.Info_line;
  if (node instanceof SymbolLine) return TAGS.Info_line;
  if (node instanceof Note) return TAGS.Note;
  if (node instanceof Pitch) return TAGS.Pitch;
  if (node instanceof Rhythm) return TAGS.Rhythm;
  if (node instanceof Rest) return TAGS.Rest;
  if (node instanceof Chord) return TAGS.Chord;
  if (node instanceof Beam) return TAGS.Beam;
  if (node instanceof Grace_group) return TAGS.Grace_group;
  if (node instanceof BarLine) return TAGS.BarLine;
  if (node instanceof Decoration) return TAGS.Decoration;
  if (node instanceof Annotation) return TAGS.Annotation;
  if (node instanceof Inline_field) return TAGS.Inline_field;
  if (node instanceof MultiMeasureRest) return TAGS.MultiMeasureRest;
  if (node instanceof YSPACER) return TAGS.YSPACER;
  if (node instanceof SystemBreak) return TAGS.SystemBreak;
  if (node instanceof Symbol) return TAGS.Symbol;
  if (node instanceof Tuplet) return TAGS.Tuplet;
  if (node instanceof Music_code) return TAGS.Music_code;
  if (node instanceof Voice_overlay) return TAGS.Voice_overlay;
  if (node instanceof Line_continuation) return TAGS.Line_continuation;
  if (node instanceof Comment) return TAGS.Comment;
  if (node instanceof Directive) return TAGS.Directive;
  if (node instanceof Measurement) return TAGS.Measurement;
  if (node instanceof Rational) return TAGS.Rational;
  if (node instanceof File_header) return TAGS.File_header;
  if (node instanceof Lyric_section) return TAGS.Lyric_section;
  if (node instanceof AbsolutePitch) return TAGS.AbsolutePitch;
  if (node instanceof Lyric_line) return TAGS.Lyric_line;
  if (node instanceof Macro_decl) return TAGS.Macro_decl;
  if (node instanceof Macro_invocation) return TAGS.Macro_invocation;
  if (node instanceof User_symbol_decl) return TAGS.User_symbol_decl;
  if (node instanceof User_symbol_invocation) return TAGS.User_symbol_invocation;
  if (node instanceof KV) return TAGS.KV;
  if (node instanceof Binary) return TAGS.Binary;
  if (node instanceof Unary) return TAGS.Unary;
  if (node instanceof Grouping) return TAGS.Grouping;
  if (node instanceof ChordSymbol) return TAGS.ChordSymbol;
  if (node instanceof ErrorExpr) return TAGS.ErrorExpr;
  if (node instanceof SymbolLine) return TAGS.SymbolLine;
  throw new Error(`resolveTag: unrecognized node type (id=${node.id}, constructor=${node.constructor?.name})`);
}

function extractData(node: Expr | Token): NodeData {
  if (node instanceof Token) {
    return {
      type: "token",
      lexeme: node.lexeme,
      tokenType: node.type,
      line: node.line,
      position: node.position,
    };
  }
  return { type: "empty" };
}

type ChildList = Array<Expr | Token>;

export const childrenVisitor: Visitor<ChildList> = {
  visitToken(_token: Token): ChildList {
    return [];
  },
  visitFileStructureExpr(expr: File_structure): ChildList {
    const children: ChildList = [];
    if (expr.file_header) children.push(expr.file_header);
    children.push(...expr.contents);
    return children;
  },
  visitTuneExpr(expr: Tune): ChildList {
    const children: ChildList = [expr.tune_header];
    if (expr.tune_body) children.push(expr.tune_body);
    return children;
  },
  visitTuneHeaderExpr(expr: Tune_header): ChildList {
    return [...expr.info_lines];
  },
  visitTuneBodyExpr(expr: Tune_Body): ChildList {
    return expr.sequence.flat();
  },
  visitInfoLineExpr(expr: Info_line): ChildList {
    return [expr.key, ...expr.value];
  },
  visitNoteExpr(expr: Note): ChildList {
    const children: ChildList = [expr.pitch];
    if (expr.rhythm) children.push(expr.rhythm);
    if (expr.tie) children.push(expr.tie);
    return children;
  },
  visitPitchExpr(expr: Pitch): ChildList {
    const children: ChildList = [];
    if (expr.alteration) children.push(expr.alteration);
    children.push(expr.noteLetter);
    if (expr.octave) children.push(expr.octave);
    return children;
  },
  visitRhythmExpr(expr: Rhythm): ChildList {
    const children: ChildList = [];
    if (expr.numerator) children.push(expr.numerator);
    if (expr.separator) children.push(expr.separator);
    if (expr.denominator) children.push(expr.denominator);
    if (expr.broken) children.push(expr.broken);
    return children;
  },
  visitRestExpr(expr: Rest): ChildList {
    const children: ChildList = [expr.rest];
    if (expr.rhythm) children.push(expr.rhythm);
    return children;
  },
  visitChordExpr(expr: Chord): ChildList {
    const children: ChildList = [];
    if (expr.leftBracket) children.push(expr.leftBracket);
    children.push(...expr.contents);
    if (expr.rightBracket) children.push(expr.rightBracket);
    if (expr.rhythm) children.push(expr.rhythm);
    if (expr.tie) children.push(expr.tie);
    return children;
  },
  visitBeamExpr(expr: Beam): ChildList {
    return [...expr.contents];
  },
  visitGraceGroupExpr(expr: Grace_group): ChildList {
    const children: ChildList = [];
    if (expr.leftBrace) children.push(expr.leftBrace);
    if (expr.acciaccaturaSlash) children.push(expr.acciaccaturaSlash);
    children.push(...expr.notes);
    if (expr.rightBrace) children.push(expr.rightBrace);
    return children;
  },
  visitBarLineExpr(expr: BarLine): ChildList {
    const children: ChildList = [...expr.barline];
    if (expr.repeatNumbers) children.push(...expr.repeatNumbers);
    return children;
  },
  visitDecorationExpr(expr: Decoration): ChildList {
    return [expr.decoration];
  },
  visitAnnotationExpr(expr: Annotation): ChildList {
    return [expr.text];
  },
  visitInlineFieldExpr(expr: Inline_field): ChildList {
    const children: ChildList = [];
    if (expr.leftBracket) children.push(expr.leftBracket);
    children.push(...expr.text);
    if (expr.rightBracket) children.push(expr.rightBracket);
    return children;
  },
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): ChildList {
    const children: ChildList = [expr.rest];
    if (expr.length) children.push(expr.length);
    return children;
  },
  visitYSpacerExpr(expr: YSPACER): ChildList {
    const children: ChildList = [expr.ySpacer];
    if (expr.rhythm) children.push(expr.rhythm);
    return children;
  },
  visitSystemBreakExpr(expr: SystemBreak): ChildList {
    return [expr.symbol];
  },
  visitSymbolExpr(expr: Symbol): ChildList {
    return [expr.symbol];
  },
  visitTupletExpr(expr: Tuplet): ChildList {
    const children: ChildList = [];
    if (expr.leftParen) children.push(expr.leftParen);
    children.push(expr.p);
    if (expr.firstColon) children.push(expr.firstColon);
    if (expr.q) children.push(expr.q);
    if (expr.secondColon) children.push(expr.secondColon);
    if (expr.r) children.push(expr.r);
    return children;
  },
  visitMusicCodeExpr(expr: Music_code): ChildList {
    return [...expr.contents];
  },
  visitVoiceOverlayExpr(expr: Voice_overlay): ChildList {
    return [...expr.contents];
  },
  visitLineContinuationExpr(expr: Line_continuation): ChildList {
    return [expr.token];
  },
  visitCommentExpr(expr: Comment): ChildList {
    return [expr.token];
  },
  visitDirectiveExpr(expr: Directive): ChildList {
    return [expr.key, ...expr.values];
  },
  visitMeasurementExpr(expr: Measurement): ChildList {
    return [expr.value, expr.scale];
  },
  visitRationalExpr(expr: Rational): ChildList {
    return [expr.numerator, expr.separator, expr.denominator];
  },
  visitFileHeaderExpr(expr: File_header): ChildList {
    return [...expr.contents];
  },
  visitLyricSectionExpr(expr: Lyric_section): ChildList {
    return [...expr.info_lines];
  },
  visitAbsolutePitch(expr: AbsolutePitch): ChildList {
    const children: ChildList = [expr.noteLetter];
    if (expr.alteration) children.push(expr.alteration);
    if (expr.octave) children.push(expr.octave);
    return children;
  },
  visitLyricLineExpr(expr: Lyric_line): ChildList {
    return [expr.header, ...expr.contents];
  },
  visitMacroDeclExpr(expr: Macro_decl): ChildList {
    const children: ChildList = [expr.header, expr.variable];
    if (expr.equals) children.push(expr.equals);
    children.push(expr.content);
    return children;
  },
  visitMacroInvocationExpr(expr: Macro_invocation): ChildList {
    return [expr.variable];
  },
  visitUserSymbolDeclExpr(expr: User_symbol_decl): ChildList {
    const children: ChildList = [expr.header, expr.variable];
    if (expr.equals) children.push(expr.equals);
    children.push(expr.symbol);
    return children;
  },
  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): ChildList {
    return [expr.variable];
  },
  visitKV(expr: KV): ChildList {
    const children: ChildList = [];
    if (expr.key) children.push(expr.key);
    if (expr.equals) children.push(expr.equals);
    children.push(expr.value);
    return children;
  },
  visitBinary(expr: Binary): ChildList {
    return [expr.left, expr.operator, expr.right];
  },
  visitUnary(expr: Unary): ChildList {
    return [expr.operator, expr.operand];
  },
  visitGrouping(expr: Grouping): ChildList {
    const children: ChildList = [];
    if (expr.leftParen) children.push(expr.leftParen);
    children.push(expr.expression);
    if (expr.rightParen) children.push(expr.rightParen);
    return children;
  },
  visitChordSymbolExpr(expr: ChordSymbol): ChildList {
    return [expr.token];
  },
  visitErrorExpr(expr: ErrorExpr): ChildList {
    return [...expr.tokens];
  },
};

export function fromAst(node: Expr | Token): CSNode {
  const tag = resolveTag(node);
  const data = extractData(node);
  const csNode = createCSNode(tag, node.id, data);

  const children = node.accept(childrenVisitor);
  if (children.length > 0) {
    csNode.firstChild = fromAst(children[0]);
    let current = csNode.firstChild;
    for (let i = 1; i < children.length; i++) {
      current.nextSibling = fromAst(children[i]);
      current = current.nextSibling;
    }
  }

  return csNode;
}
