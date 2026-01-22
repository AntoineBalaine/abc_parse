/**
 * exprToCS.ts - Convert Expr AST to CSNode
 *
 * Converts the TypeScript parser's Expr AST (from Expr2.ts) into the
 * child-sibling tree representation for comparison with TreeSitter output.
 */
import { CSNode, createCSNode, arrayToSiblingChain } from "./CSNode";
import { Token, TT } from "../parsers/scan2";
import {
  Expr,
  File_structure,
  File_header,
  Tune,
  Tune_header,
  Tune_Body,
  Info_line,
  SymbolLine,
  Music_code,
  Note,
  Pitch,
  Rhythm,
  Rest,
  MultiMeasureRest,
  Chord,
  Grace_group,
  Inline_field,
  BarLine,
  Annotation,
  Decoration,
  Symbol,
  SystemBreak,
  YSPACER,
  Comment,
  Directive,
  Lyric_line,
  Lyric_section,
  Tuplet,
  Beam,
  Voice_overlay,
  Line_continuation,
  Macro_decl,
  Macro_invocation,
  User_symbol_decl,
  User_symbol_invocation,
  ErrorExpr,
  KV,
  Binary,
  Unary,
  Grouping,
  AbsolutePitch,
  Rational,
  Measurement,
  ChordSymbol,
  music_code,
  tune_body_code,
} from "../types/Expr2";

/**
 * Converts a Token to a CSNode leaf node
 */
export function tokenToCS(token: Token): CSNode {
  return createCSNode(TT[token.type], {
    text: token.lexeme,
    startOffset: token.position,
    endOffset: token.position + token.lexeme.length,
  });
}

/**
 * Converts any Expr or Token to CSNode
 */
export function exprToCS(node: Expr | Token | null | undefined): CSNode | null {
  if (node === null || node === undefined) return null;

  if (node instanceof Token) {
    return tokenToCS(node);
  }

  // Dispatch based on expression type
  if (node instanceof File_structure) return fileStructureToCS(node);
  if (node instanceof File_header) return fileHeaderToCS(node);
  if (node instanceof Tune) return tuneToCS(node);
  if (node instanceof Tune_header) return tuneHeaderToCS(node);
  if (node instanceof Tune_Body) return tuneBodyToCS(node);
  if (node instanceof Info_line) return infoLineToCS(node);
  if (node instanceof SymbolLine) return symbolLineToCS(node);
  if (node instanceof Music_code) return musicCodeToCS(node);
  if (node instanceof Note) return noteToCS(node);
  if (node instanceof Pitch) return pitchToCS(node);
  if (node instanceof Rhythm) return rhythmToCS(node);
  if (node instanceof Rest) return restToCS(node);
  if (node instanceof MultiMeasureRest) return multiMeasureRestToCS(node);
  if (node instanceof Chord) return chordToCS(node);
  if (node instanceof Grace_group) return graceGroupToCS(node);
  if (node instanceof Inline_field) return inlineFieldToCS(node);
  if (node instanceof BarLine) return barLineToCS(node);
  if (node instanceof Annotation) return annotationToCS(node);
  if (node instanceof Decoration) return decorationToCS(node);
  if (node instanceof Symbol) return symbolToCS(node);
  if (node instanceof SystemBreak) return systemBreakToCS(node);
  if (node instanceof YSPACER) return yspacerToCS(node);
  if (node instanceof Comment) return commentToCS(node);
  if (node instanceof Directive) return directiveToCS(node);
  if (node instanceof Lyric_line) return lyricLineToCS(node);
  if (node instanceof Lyric_section) return lyricSectionToCS(node);
  if (node instanceof Tuplet) return tupletToCS(node);
  if (node instanceof Beam) return beamToCS(node);
  if (node instanceof Voice_overlay) return voiceOverlayToCS(node);
  if (node instanceof Line_continuation) return lineContinuationToCS(node);
  if (node instanceof Macro_decl) return macroDeclToCS(node);
  if (node instanceof Macro_invocation) return macroInvocationToCS(node);
  if (node instanceof User_symbol_decl) return userSymbolDeclToCS(node);
  if (node instanceof User_symbol_invocation) return userSymbolInvocationToCS(node);
  if (node instanceof ErrorExpr) return errorExprToCS(node);
  if (node instanceof KV) return kvToCS(node);
  if (node instanceof Binary) return binaryToCS(node);
  if (node instanceof Unary) return unaryToCS(node);
  if (node instanceof Grouping) return groupingToCS(node);
  if (node instanceof AbsolutePitch) return absolutePitchToCS(node);
  if (node instanceof Rational) return rationalToCS(node);
  if (node instanceof Measurement) return measurementToCS(node);
  if (node instanceof ChordSymbol) return chordSymbolToCS(node);

  // Unknown expression type
  return createCSNode("Unknown", {
    text: `Unknown Expr type: ${node.constructor.name}`,
  });
}

/**
 * Helper to convert an array of nodes to a sibling chain
 */
function childrenToCS(children: (Expr | Token | null | undefined)[]): CSNode | null {
  const csNodes = children
    .map((child) => exprToCS(child))
    .filter((node): node is CSNode => node !== null);
  return arrayToSiblingChain(csNodes);
}

// ============================================================================
// Conversion functions for each Expr type
// ============================================================================

function fileStructureToCS(expr: File_structure): CSNode {
  const children: (Expr | Token | null)[] = [];
  if (expr.file_header) {
    children.push(expr.file_header);
  }
  children.push(...expr.contents);

  return createCSNode("File_structure", {
    firstChild: childrenToCS(children),
  });
}

function fileHeaderToCS(expr: File_header): CSNode {
  return createCSNode("File_header", {
    firstChild: childrenToCS(expr.contents),
  });
}

function tuneToCS(expr: Tune): CSNode {
  const children: (Expr | null)[] = [expr.tune_header];
  if (expr.tune_body) {
    children.push(expr.tune_body);
  }

  return createCSNode("Tune", {
    firstChild: childrenToCS(children),
  });
}

function tuneHeaderToCS(expr: Tune_header): CSNode {
  return createCSNode("Tune_header", {
    firstChild: childrenToCS(expr.info_lines),
  });
}

function tuneBodyToCS(expr: Tune_Body): CSNode {
  // Flatten the sequence of systems into a single children array
  const allContents: tune_body_code[] = [];
  for (const system of expr.sequence) {
    allContents.push(...system);
  }

  return createCSNode("Tune_Body", {
    firstChild: childrenToCS(allContents),
  });
}

function infoLineToCS(expr: Info_line): CSNode {
  const children: (Token | Expr)[] = [expr.key, ...expr.value];

  return createCSNode("Info_line", {
    firstChild: childrenToCS(children),
  });
}

function symbolLineToCS(expr: SymbolLine): CSNode {
  const children: Token[] = [expr.key, ...expr.value];

  return createCSNode("SymbolLine", {
    firstChild: childrenToCS(children),
  });
}

function musicCodeToCS(expr: Music_code): CSNode {
  return createCSNode("Music_code", {
    firstChild: childrenToCS(expr.contents),
  });
}

function noteToCS(expr: Note): CSNode {
  const children: (Expr | Token | null | undefined)[] = [expr.pitch];
  if (expr.rhythm) {
    children.push(expr.rhythm);
  }
  if (expr.tie) {
    children.push(expr.tie);
  }

  return createCSNode("Note", {
    firstChild: childrenToCS(children),
  });
}

function pitchToCS(expr: Pitch): CSNode {
  const children: (Token | undefined)[] = [];
  if (expr.alteration) {
    children.push(expr.alteration);
  }
  children.push(expr.noteLetter);
  if (expr.octave) {
    children.push(expr.octave);
  }

  return createCSNode("Pitch", {
    firstChild: childrenToCS(children),
  });
}

function rhythmToCS(expr: Rhythm): CSNode {
  const children: (Token | null | undefined)[] = [];
  if (expr.numerator) {
    children.push(expr.numerator);
  }
  if (expr.separator) {
    children.push(expr.separator);
  }
  if (expr.denominator) {
    children.push(expr.denominator);
  }
  if (expr.broken) {
    children.push(expr.broken);
  }

  return createCSNode("Rhythm", {
    firstChild: childrenToCS(children),
  });
}

function restToCS(expr: Rest): CSNode {
  const children: (Token | Rhythm | undefined)[] = [expr.rest];
  if (expr.rhythm) {
    children.push(expr.rhythm);
  }

  return createCSNode("Rest", {
    firstChild: childrenToCS(children),
  });
}

function multiMeasureRestToCS(expr: MultiMeasureRest): CSNode {
  const children: (Token | undefined)[] = [expr.rest];
  if (expr.length) {
    children.push(expr.length);
  }

  return createCSNode("MultiMeasureRest", {
    firstChild: childrenToCS(children),
  });
}

function chordToCS(expr: Chord): CSNode {
  const children: (Note | Token | Annotation | Rhythm | undefined)[] = [...expr.contents];
  if (expr.rhythm) {
    children.push(expr.rhythm);
  }
  if (expr.tie) {
    children.push(expr.tie);
  }

  return createCSNode("Chord", {
    firstChild: childrenToCS(children),
  });
}

function graceGroupToCS(expr: Grace_group): CSNode {
  return createCSNode("Grace_group", {
    firstChild: childrenToCS(expr.notes),
  });
}

function inlineFieldToCS(expr: Inline_field): CSNode {
  const children: (Token | Expr)[] = [expr.field, ...expr.text];

  return createCSNode("Inline_field", {
    firstChild: childrenToCS(children),
  });
}

function barLineToCS(expr: BarLine): CSNode {
  const children: Token[] = [...expr.barline];
  if (expr.repeatNumbers) {
    children.push(...expr.repeatNumbers);
  }

  return createCSNode("BarLine", {
    firstChild: childrenToCS(children),
  });
}

function annotationToCS(expr: Annotation): CSNode {
  return createCSNode("Annotation", {
    firstChild: tokenToCS(expr.text),
  });
}

function decorationToCS(expr: Decoration): CSNode {
  return createCSNode("Decoration", {
    firstChild: tokenToCS(expr.decoration),
  });
}

function symbolToCS(expr: Symbol): CSNode {
  return createCSNode("Symbol", {
    firstChild: tokenToCS(expr.symbol),
  });
}

function systemBreakToCS(expr: SystemBreak): CSNode {
  return createCSNode("SystemBreak", {
    firstChild: tokenToCS(expr.symbol),
  });
}

function yspacerToCS(expr: YSPACER): CSNode {
  const children: (Token | Rhythm | undefined)[] = [expr.ySpacer];
  if (expr.rhythm) {
    children.push(expr.rhythm);
  }

  return createCSNode("YSPACER", {
    firstChild: childrenToCS(children),
  });
}

function commentToCS(expr: Comment): CSNode {
  return createCSNode("Comment", {
    firstChild: tokenToCS(expr.token),
  });
}

function directiveToCS(expr: Directive): CSNode {
  const children: (Token | Expr)[] = [expr.key, ...expr.values];

  return createCSNode("Directive", {
    firstChild: childrenToCS(children),
  });
}

function lyricLineToCS(expr: Lyric_line): CSNode {
  const children: Token[] = [expr.header, ...expr.contents];

  return createCSNode("Lyric_line", {
    firstChild: childrenToCS(children),
  });
}

function lyricSectionToCS(expr: Lyric_section): CSNode {
  return createCSNode("Lyric_section", {
    firstChild: childrenToCS(expr.info_lines),
  });
}

function tupletToCS(expr: Tuplet): CSNode {
  const children: (Token | undefined)[] = [expr.p];
  if (expr.q) {
    children.push(expr.q);
  }
  if (expr.r) {
    children.push(expr.r);
  }

  return createCSNode("Tuplet", {
    firstChild: childrenToCS(children),
  });
}

function beamToCS(expr: Beam): CSNode {
  return createCSNode("Beam", {
    firstChild: childrenToCS(expr.contents),
  });
}

function voiceOverlayToCS(expr: Voice_overlay): CSNode {
  return createCSNode("Voice_overlay", {
    firstChild: childrenToCS(expr.contents),
  });
}

function lineContinuationToCS(expr: Line_continuation): CSNode {
  return createCSNode("Line_continuation", {
    firstChild: tokenToCS(expr.token),
  });
}

function macroDeclToCS(expr: Macro_decl): CSNode {
  const children: Token[] = [expr.header, expr.variable, expr.content];

  return createCSNode("Macro_decl", {
    firstChild: childrenToCS(children),
  });
}

function macroInvocationToCS(expr: Macro_invocation): CSNode {
  return createCSNode("Macro_invocation", {
    firstChild: tokenToCS(expr.variable),
  });
}

function userSymbolDeclToCS(expr: User_symbol_decl): CSNode {
  const children: Token[] = [expr.header, expr.variable, expr.symbol];

  return createCSNode("User_symbol_decl", {
    firstChild: childrenToCS(children),
  });
}

function userSymbolInvocationToCS(expr: User_symbol_invocation): CSNode {
  return createCSNode("User_symbol_invocation", {
    firstChild: tokenToCS(expr.variable),
  });
}

function errorExprToCS(expr: ErrorExpr): CSNode {
  return createCSNode("ErrorExpr", {
    firstChild: childrenToCS(expr.tokens),
  });
}

function kvToCS(expr: KV): CSNode {
  const children: (Token | Expr | undefined)[] = [];
  if (expr.key) {
    children.push(expr.key);
  }
  if (expr.equals) {
    children.push(expr.equals);
  }
  children.push(expr.value);

  return createCSNode("KV", {
    firstChild: childrenToCS(children),
  });
}

function binaryToCS(expr: Binary): CSNode {
  const children: (Token | Expr)[] = [expr.left, expr.operator, expr.right];

  return createCSNode("Binary", {
    firstChild: childrenToCS(children),
  });
}

function unaryToCS(expr: Unary): CSNode {
  const children: (Token | Expr)[] = [expr.operator, expr.operand];

  return createCSNode("Unary", {
    firstChild: childrenToCS(children),
  });
}

function groupingToCS(expr: Grouping): CSNode {
  return createCSNode("Grouping", {
    firstChild: exprToCS(expr.expression),
  });
}

function absolutePitchToCS(expr: AbsolutePitch): CSNode {
  const children: (Token | undefined)[] = [expr.noteLetter];
  if (expr.alteration) {
    children.push(expr.alteration);
  }
  if (expr.octave) {
    children.push(expr.octave);
  }

  return createCSNode("AbsolutePitch", {
    firstChild: childrenToCS(children),
  });
}

function rationalToCS(expr: Rational): CSNode {
  const children: Token[] = [expr.numerator, expr.separator, expr.denominator];

  return createCSNode("Rational", {
    firstChild: childrenToCS(children),
  });
}

function measurementToCS(expr: Measurement): CSNode {
  const children: Token[] = [expr.value, expr.scale];

  return createCSNode("Measurement", {
    firstChild: childrenToCS(children),
  });
}

function chordSymbolToCS(expr: ChordSymbol): CSNode {
  return createCSNode("ChordSymbol", {
    firstChild: tokenToCS(expr.token),
  });
}
