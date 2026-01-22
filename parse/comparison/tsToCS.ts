/**
 * tsToCS.ts - Convert TreeSitter SyntaxNode to CSNode
 *
 * Converts TreeSitter's SyntaxNode tree into the child-sibling tree
 * representation for comparison with the TypeScript parser output.
 *
 * TreeSitter generates both named and anonymous nodes. Anonymous nodes
 * (like punctuation `[`, `]`, `|`) are skipped unless they carry
 * semantic meaning that matches Expr AST equivalents.
 */
import { CSNode, createCSNode, arrayToSiblingChain } from "./CSNode";

/**
 * TreeSitter SyntaxNode interface
 *
 * This interface describes the shape of TreeSitter's SyntaxNode objects.
 * We define it here to avoid requiring the tree-sitter package as a
 * direct dependency, allowing the comparison framework to be tested
 * independently.
 */
export interface SyntaxNode {
  /** The type of the node (e.g., "Note", "Pitch", "source_file") */
  type: string;

  /** Whether the node is a named node (true) or anonymous (false) */
  isNamed: boolean;

  /** The text content of this node */
  text: string;

  /** Number of children this node has */
  childCount: number;

  /** The first child node, or null if there are no children */
  firstChild: SyntaxNode | null;

  /** The first named child node, or null if there are no named children */
  firstNamedChild: SyntaxNode | null;

  /** The next sibling node, or null if this is the last sibling */
  nextSibling: SyntaxNode | null;

  /** The next named sibling node, or null if this is the last named sibling */
  nextNamedSibling: SyntaxNode | null;

  /** Array of all child nodes */
  children: SyntaxNode[];

  /** Array of named child nodes only */
  namedChildren: SyntaxNode[];

  /** Start byte position in source text */
  startIndex: number;

  /** End byte position in source text */
  endIndex: number;

  /** Starting row position (0-indexed) */
  startPosition: { row: number; column: number };

  /** Ending row position (0-indexed) */
  endPosition: { row: number; column: number };
}

/**
 * Options for controlling the conversion behavior
 */
export interface TsToCSOptions {
  /**
   * Whether to skip anonymous nodes during conversion.
   * Default: true
   *
   * When true, anonymous nodes (punctuation, delimiters) are skipped
   * and only named nodes are included in the CSNode tree.
   */
  skipAnonymous?: boolean;

  /**
   * A map of node type names to their normalized equivalents.
   * Used to align TreeSitter node names with Expr type names.
   *
   * Example: { "source_file": "File_structure" }
   */
  typeMapping?: Record<string, string>;
}

/**
 * Default type mappings from TreeSitter conventions to Expr2.ts names
 */
const DEFAULT_TYPE_MAPPING: Record<string, string> = {
  // TreeSitter typically uses snake_case or lowercase for grammar rules
  // Map these to the Expr2.ts PascalCase names
  source_file: "File_structure",
  file_structure: "File_structure",
  file_header: "File_header",
  tune: "Tune",
  tune_header: "Tune_header",
  tune_body: "Tune_Body",
  info_line: "Info_line",
  symbol_line: "SymbolLine",
  music_code: "Music_code",
  note: "Note",
  pitch: "Pitch",
  rhythm: "Rhythm",
  rest: "Rest",
  multi_measure_rest: "MultiMeasureRest",
  chord: "Chord",
  grace_group: "Grace_group",
  inline_field: "Inline_field",
  barline: "BarLine",
  bar_line: "BarLine",
  annotation: "Annotation",
  decoration: "Decoration",
  symbol: "Symbol",
  system_break: "SystemBreak",
  yspacer: "YSPACER",
  y_spacer: "YSPACER",
  comment: "Comment",
  directive: "Directive",
  lyric_line: "Lyric_line",
  lyric_section: "Lyric_section",
  tuplet: "Tuplet",
  beam: "Beam",
  voice_overlay: "Voice_overlay",
  line_continuation: "Line_continuation",
  macro_decl: "Macro_decl",
  macro_invocation: "Macro_invocation",
  user_symbol_decl: "User_symbol_decl",
  user_symbol_invocation: "User_symbol_invocation",
  error: "ErrorExpr",
  kv: "KV",
  binary: "Binary",
  unary: "Unary",
  grouping: "Grouping",
  absolute_pitch: "AbsolutePitch",
  rational: "Rational",
  measurement: "Measurement",
  chord_symbol: "ChordSymbol",
};

/**
 * Default token type mappings from TreeSitter to TT enum names
 *
 * These map TreeSitter terminal node types to the corresponding
 * TT enum names used by the TypeScript scanner.
 */
const DEFAULT_TOKEN_MAPPING: Record<string, string> = {
  accidental: "ACCIDENTAL",
  note_letter: "NOTE_LETTER",
  octave: "OCTAVE",
  rest_symbol: "REST",
  tie: "TIE",
  slur: "SLUR",
  decoration_char: "DECORATION",
  barline_token: "BARLINE",
  rhy_numer: "RHY_NUMER",
  rhy_denom: "RHY_DENOM",
  rhy_sep: "RHY_SEP",
  rhy_brkn: "RHY_BRKN",
  tuplet_lparen: "TUPLET_LPAREN",
  tuplet_p: "TUPLET_P",
  tuplet_colon: "TUPLET_COLON",
  tuplet_q: "TUPLET_Q",
  tuplet_r: "TUPLET_R",
  repeat_number: "REPEAT_NUMBER",
  repeat_comma: "REPEAT_COMMA",
  repeat_dash: "REPEAT_DASH",
  repeat_x: "REPEAT_X",
  chord_left_bracket: "CHRD_LEFT_BRKT",
  chord_right_bracket: "CHRD_RIGHT_BRKT",
  grace_left_brace: "GRC_GRP_LEFT_BRACE",
  grace_right_brace: "GRC_GRP_RGHT_BRACE",
  grace_slash: "GRC_GRP_SLSH",
  inline_field_left: "INLN_FLD_LFT_BRKT",
  inline_field_right: "INLN_FLD_RGT_BRKT",
  equals: "EQL",
  slash: "SLASH",
  minus: "MINUS",
  plus: "PLUS",
  lparen: "LPAREN",
  rparen: "RPAREN",
  lbrace: "LBRACE",
  rbrace: "RBRACE",
  lbracket: "LBRACKET",
  rbracket: "RBRACKET",
  pipe: "PIPE",
  annotation_text: "ANNOTATION",
  info_header: "INF_HDR",
  info_string: "INFO_STR",
  info_continued: "INF_CTND",
  voice_marker: "VOICE",
  voice_overlay_marker: "VOICE_OVRLAY",
  line_continuation_marker: "LINE_CONT",
  symbol_text: "SYMBOL",
  user_symbol: "USER_SY",
  user_symbol_header: "USER_SY_HDR",
  user_symbol_invocation: "USER_SY_INVOCATION",
  macro_header: "MACRO_HDR",
  macro_string: "MACRO_STR",
  macro_invocation: "MACRO_INVOCATION",
  macro_var: "MACRO_VAR",
  lyric_header: "LY_HDR",
  lyric_text: "LY_TXT",
  lyric_underscore: "LY_UNDR",
  lyric_hyphen: "LY_HYPH",
  lyric_section_header: "LY_SECT_HDR",
  lyric_space: "LY_SPS",
  lyric_star: "LY_STAR",
  symbol_header: "SY_HDR",
  symbol_star: "SY_STAR",
  symbol_line_text: "SY_TXT",
  stylesheet_directive: "STYLESHEET_DIRECTIVE",
  measurement_unit: "MEASUREMENT_UNIT",
  ampersand: "AMPERSAND",
  system_break_marker: "SYSTEM_BREAK",
  backtick_space: "BCKTCK_SPC",
  y_space: "Y_SPC",
  special_literal: "SPECIAL_LITERAL",
  identifier: "IDENTIFIER",
  number: "NUMBER",
  reserved_char: "RESERVED_CHAR",
  escaped_char: "ESCAPED_CHAR",
  chord_symbol_text: "CHORD_SYMBOL",
  discard: "DISCARD",
  comment_text: "COMMENT",
  whitespace: "WS",
  eol: "EOL",
  free_text: "FREE_TXT",
  section_break: "SCT_BRK",
  invalid: "INVALID",
  eof: "EOF",
};

/**
 * Converts a TreeSitter SyntaxNode to a CSNode
 *
 * @param node - The TreeSitter syntax node to convert
 * @param options - Options controlling the conversion behavior
 * @returns The converted CSNode, or null if the node should be skipped
 */
export function tsToCS(node: SyntaxNode | null, options: TsToCSOptions = {}): CSNode | null {
  if (node === null) return null;

  const skipAnonymous = options.skipAnonymous ?? true;
  const typeMapping = { ...DEFAULT_TYPE_MAPPING, ...DEFAULT_TOKEN_MAPPING, ...(options.typeMapping ?? {}) };

  return convertNode(node, skipAnonymous, typeMapping);
}

/**
 * Internal recursive conversion function
 */
function convertNode(
  node: SyntaxNode,
  skipAnonymous: boolean,
  typeMapping: Record<string, string>
): CSNode | null {
  // Skip anonymous nodes if the option is set
  if (skipAnonymous && !node.isNamed) {
    // When skipping an anonymous node, continue to its next sibling
    // The caller handles sibling chaining, so we return null here
    return null;
  }

  // Map the node type to the normalized name
  const mappedType = typeMapping[node.type] ?? node.type;

  // Determine if this is a leaf node (no named children)
  // Leaf nodes get their text content preserved
  const isLeaf = node.namedChildren.length === 0;

  // Convert children to CSNode chain
  let firstChild: CSNode | null = null;
  if (!isLeaf) {
    const childNodes = skipAnonymous ? node.namedChildren : node.children;
    const convertedChildren = childNodes
      .map((child) => convertNode(child, skipAnonymous, typeMapping))
      .filter((csNode): csNode is CSNode => csNode !== null);

    firstChild = arrayToSiblingChain(convertedChildren);
  }

  return createCSNode(mappedType, {
    text: isLeaf ? node.text : undefined,
    firstChild,
    startOffset: node.startIndex,
    endOffset: node.endIndex,
  });
}

/**
 * Converts a TreeSitter tree's root node to a CSNode tree
 *
 * This is a convenience wrapper that handles the common case of
 * converting an entire parse tree starting from its root.
 *
 * @param rootNode - The root node of the TreeSitter tree
 * @param options - Options controlling the conversion behavior
 * @returns The converted CSNode tree
 */
export function treeToCS(rootNode: SyntaxNode, options: TsToCSOptions = {}): CSNode | null {
  return tsToCS(rootNode, options);
}

/**
 * Adds custom type mappings to the default set
 *
 * Useful when the TreeSitter grammar uses different naming conventions
 * than the default mappings.
 *
 * @param customMappings - Custom type name mappings
 * @returns A new options object with the merged mappings
 */
export function withCustomMappings(customMappings: Record<string, string>): TsToCSOptions {
  return {
    typeMapping: { ...DEFAULT_TYPE_MAPPING, ...DEFAULT_TOKEN_MAPPING, ...customMappings },
  };
}
