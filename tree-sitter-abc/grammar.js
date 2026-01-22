/**
 * TreeSitter grammar for ABC music notation
 *
 * This grammar uses an external scanner for all tokenization because ABC
 * notation has context-sensitive lexical rules that require multi-character
 * lookahead and backtracking.
 *
 * Node names match Expr2.ts class names exactly.
 */
module.exports = grammar({
  name: 'abc',

  // All tokens are handled by the external scanner
  externals: $ => [
    // Pitch and Music Elements
    $.ACCIDENTAL, $.NOTE_LETTER, $.OCTAVE, $.REST,
    $.TIE, $.DECORATION, $.SLUR, $.BARLINE,

    // Rhythmic Elements
    $.RHY_NUMER, $.RHY_DENOM, $.RHY_SEP, $.RHY_BRKN,
    $.TUPLET_LPAREN, $.TUPLET_P, $.TUPLET_COLON, $.TUPLET_Q, $.TUPLET_R,
    $.REPEAT_NUMBER, $.REPEAT_COMMA, $.REPEAT_DASH, $.REPEAT_X,

    // Structural Brackets
    $.CHRD_LEFT_BRKT, $.CHRD_RIGHT_BRKT,
    $.GRC_GRP_LEFT_BRACE, $.GRC_GRP_RGHT_BRACE, $.GRC_GRP_SLSH,
    $.INLN_FLD_LFT_BRKT, $.INLN_FLD_RGT_BRKT,

    // Generic Punctuation (directive/info line contexts)
    $.EQL, $.SLASH, $.MINUS, $.PLUS,
    $.LPAREN, $.RPAREN, $.LBRACE, $.RBRACE,
    $.LBRACKET, $.RBRACKET, $.PIPE,

    // Information Fields
    $.ANNOTATION, $.INF_HDR, $.INFO_STR, $.INF_CTND,
    $.VOICE, $.VOICE_OVRLAY, $.LINE_CONT,

    // Symbols and Special
    $.SYMBOL, $.USER_SY, $.USER_SY_HDR, $.USER_SY_INVOCATION,
    $.MACRO_HDR, $.MACRO_STR, $.MACRO_INVOCATION, $.MACRO_VAR,

    // Lyrics
    $.LY_HDR, $.LY_TXT, $.LY_UNDR, $.LY_HYPH,
    $.LY_SECT_HDR, $.LY_SPS, $.LY_STAR,

    // Symbol Line
    $.SY_HDR, $.SY_STAR, $.SY_TXT,

    // Directives
    $.STYLESHEET_DIRECTIVE, $.MEASUREMENT_UNIT,

    // Utility
    $.AMPERSAND, $.SYSTEM_BREAK, $.BCKTCK_SPC, $.Y_SPC,
    $.SPECIAL_LITERAL,

    // General
    $.IDENTIFIER, $.NUMBER, $.RESERVED_CHAR, $.ESCAPED_CHAR,
    $.CHORD_SYMBOL, $.DISCARD,

    // Structural
    $.COMMENT, $.WS, $.EOL, $.FREE_TXT,
    $.SCT_BRK, $.INVALID, $.EOF,
  ],

  // We handle whitespace explicitly in the scanner
  extras: $ => [],

  rules: {
    // =====================================================================
    // Top-level structure (matches File_structure in Expr2.ts)
    // =====================================================================

    File_structure: $ => seq(
      optional($.File_header),
      repeat(choice(
        $.Tune,
        $.SCT_BRK,
        $.FREE_TXT,
        $.COMMENT,
        $.EOL,
        $.INVALID
      ))
    ),

    // =====================================================================
    // File Header (matches File_header in Expr2.ts)
    // =====================================================================

    File_header: $ => repeat1(choice(
      $.Info_line,
      $.Directive,
      $.Comment,
      $.Macro_decl,
      $.User_symbol_decl,
      $.FREE_TXT,
      $.EOL,
      $.WS
    )),

    // =====================================================================
    // Tune (matches Tune in Expr2.ts)
    // =====================================================================

    Tune: $ => seq(
      $.Tune_header,
      optional($.Tune_Body)
    ),

    // =====================================================================
    // Tune Header (matches Tune_header in Expr2.ts)
    // =====================================================================

    Tune_header: $ => repeat1(choice(
      $.Info_line,
      $.Comment,
      $.Directive,
      $.Macro_decl,
      $.User_symbol_decl,
      $.EOL,
      $.WS
    )),

    // =====================================================================
    // Tune Body (matches Tune_Body in Expr2.ts)
    // =====================================================================

    Tune_Body: $ => repeat1(choice(
      $.Music_code,
      $.Info_line,
      $.Lyric_line,
      $.Lyric_section,
      $.SymbolLine,
      $.Comment,
      $.Directive,
      $.EOL,
      $.WS
    )),

    // =====================================================================
    // Music Code (matches Music_code in Expr2.ts)
    // =====================================================================

    Music_code: $ => repeat1(choice(
      $.Note,
      $.Rest,
      $.MultiMeasureRest,
      $.Chord,
      $.Grace_group,
      $.BarLine,
      $.Beam,
      $.Tuplet,
      $.Annotation,
      $.Decoration,
      $.Symbol,
      $.Inline_field,
      $.YSPACER,
      $.SystemBreak,
      $.Voice_overlay,
      $.Line_continuation,
      $.Macro_invocation,
      $.User_symbol_invocation,
      $.ErrorExpr,
      $.WS
    )),

    // =====================================================================
    // Note (matches Note in Expr2.ts)
    // =====================================================================

    Note: $ => seq(
      optional($.TIE),
      $.Pitch,
      optional($.Rhythm),
      optional($.TIE)
    ),

    // =====================================================================
    // Pitch (matches Pitch in Expr2.ts)
    // =====================================================================

    Pitch: $ => seq(
      optional($.ACCIDENTAL),
      $.NOTE_LETTER,
      optional($.OCTAVE)
    ),

    // =====================================================================
    // AbsolutePitch (matches AbsolutePitch in Expr2.ts)
    // Used in directives like transpose=C4
    // =====================================================================

    AbsolutePitch: $ => seq(
      $.NOTE_LETTER,
      optional($.ACCIDENTAL),
      optional($.NUMBER)
    ),

    // =====================================================================
    // Rhythm (matches Rhythm in Expr2.ts)
    // =====================================================================

    Rhythm: $ => choice(
      // numerator only: "2" or "3"
      seq($.RHY_NUMER, optional($.RHY_BRKN)),
      // separator with optional denominator: "/" or "/2"
      seq($.RHY_SEP, optional($.RHY_DENOM), optional($.RHY_BRKN)),
      // full rational: "3/4"
      seq($.RHY_NUMER, $.RHY_SEP, optional($.RHY_DENOM), optional($.RHY_BRKN)),
      // broken rhythm only: ">" or "<"
      $.RHY_BRKN
    ),

    // =====================================================================
    // Rest (matches Rest in Expr2.ts)
    // =====================================================================

    Rest: $ => seq(
      $.REST,
      optional($.Rhythm)
    ),

    // =====================================================================
    // MultiMeasureRest (matches MultiMeasureRest in Expr2.ts)
    // =====================================================================

    MultiMeasureRest: $ => seq(
      $.REST,
      optional($.RHY_NUMER)
    ),

    // =====================================================================
    // Chord (matches Chord in Expr2.ts)
    // =====================================================================

    Chord: $ => seq(
      $.CHRD_LEFT_BRKT,
      repeat(choice(
        $.Note,
        $.Annotation
      )),
      $.CHRD_RIGHT_BRKT,
      optional($.Rhythm),
      optional($.TIE)
    ),

    // =====================================================================
    // Grace_group (matches Grace_group in Expr2.ts)
    // =====================================================================

    Grace_group: $ => seq(
      $.GRC_GRP_LEFT_BRACE,
      optional($.GRC_GRP_SLSH),
      repeat(choice(
        $.Note,
        $.WS
      )),
      $.GRC_GRP_RGHT_BRACE
    ),

    // =====================================================================
    // BarLine (matches BarLine in Expr2.ts)
    // =====================================================================

    BarLine: $ => seq(
      $.BARLINE,
      optional($.Repeat_numbers)
    ),

    // =====================================================================
    // Repeat_numbers (for barline repeat endings)
    // =====================================================================

    Repeat_numbers: $ => repeat1(choice(
      $.REPEAT_NUMBER,
      $.REPEAT_COMMA,
      $.REPEAT_DASH,
      $.REPEAT_X
    )),

    // =====================================================================
    // Tuplet (matches Tuplet in Expr2.ts)
    // Syntax: (p:q:r - put p notes into time of q for r notes
    // =====================================================================

    Tuplet: $ => seq(
      $.TUPLET_LPAREN,
      $.TUPLET_P,
      optional(seq(
        $.TUPLET_COLON,
        optional($.TUPLET_Q),
        optional(seq(
          $.TUPLET_COLON,
          optional($.TUPLET_R)
        ))
      ))
    ),

    // =====================================================================
    // YSPACER (matches YSPACER in Expr2.ts)
    // =====================================================================

    YSPACER: $ => seq(
      $.Y_SPC,
      optional($.Rhythm)
    ),

    // =====================================================================
    // Beam (matches Beam in Expr2.ts)
    // Groups of notes connected by beams
    // =====================================================================

    Beam: $ => repeat1(choice(
      $.Note,
      $.Rest,
      $.Chord,
      $.Grace_group,
      $.Annotation,
      $.Decoration,
      $.Symbol,
      $.BarLine,
      $.Tuplet,
      $.MultiMeasureRest,
      $.Inline_field,
      $.YSPACER,
      $.ErrorExpr
    )),

    // =====================================================================
    // Inline_field (matches Inline_field in Expr2.ts)
    // =====================================================================

    Inline_field: $ => seq(
      $.INLN_FLD_LFT_BRKT,
      $.INF_HDR,
      repeat(choice(
        $._inline_field_content,
        $.WS
      )),
      $.INLN_FLD_RGT_BRKT
    ),

    _inline_field_content: $ => choice(
      $.KV,
      $.Binary,
      $.Unary,
      $.Grouping,
      $.Rational,
      $.Measurement,
      $.AbsolutePitch,
      $.IDENTIFIER,
      $.NUMBER,
      $.INFO_STR,
      $.ANNOTATION,
      $.SPECIAL_LITERAL
    ),

    // =====================================================================
    // Info_line (matches Info_line in Expr2.ts)
    // =====================================================================

    Info_line: $ => seq(
      $.INF_HDR,
      repeat(choice(
        $._info_line_content,
        $.WS
      )),
      optional($.Comment),
      optional($.EOL)
    ),

    _info_line_content: $ => choice(
      $.KV,
      $.Binary,
      $.Unary,
      $.Grouping,
      $.Rational,
      $.Measurement,
      $.AbsolutePitch,
      $.IDENTIFIER,
      $.NUMBER,
      $.INFO_STR,
      $.ANNOTATION,
      $.SPECIAL_LITERAL
    ),

    // =====================================================================
    // Directive (matches Directive in Expr2.ts)
    // =====================================================================

    Directive: $ => seq(
      $.STYLESHEET_DIRECTIVE,
      repeat(choice(
        $._directive_value,
        $.WS
      )),
      optional($.Comment),
      optional($.EOL)
    ),

    _directive_value: $ => choice(
      $.KV,
      $.Binary,
      $.Rational,
      $.Measurement,
      $.Pitch,
      $.Annotation,
      $.IDENTIFIER,
      $.NUMBER,
      $.SPECIAL_LITERAL,
      $.INFO_STR
    ),

    // =====================================================================
    // KV (matches KV in Expr2.ts)
    // Key-value pairs: key=value or standalone value
    // =====================================================================

    KV: $ => choice(
      // With key: key=value
      seq(
        choice($.IDENTIFIER, $.AbsolutePitch),
        $.EQL,
        $._kv_value
      ),
      // Standalone value (when not ambiguous)
      $._kv_value
    ),

    _kv_value: $ => choice(
      $.IDENTIFIER,
      $.NUMBER,
      $.ANNOTATION,
      $.SPECIAL_LITERAL,
      $.Unary
    ),

    // =====================================================================
    // Binary (matches Binary in Expr2.ts)
    // Binary expressions: left op right
    // =====================================================================

    Binary: $ => prec.left(1, seq(
      $._binary_operand,
      choice($.PLUS, $.SLASH, $.MINUS),
      $._binary_operand
    )),

    _binary_operand: $ => choice(
      $.NUMBER,
      $.IDENTIFIER,
      $.Grouping,
      $.Unary
    ),

    // =====================================================================
    // Unary (matches Unary in Expr2.ts)
    // Unary expressions: -expr or +expr
    // =====================================================================

    Unary: $ => seq(
      choice($.MINUS, $.PLUS),
      choice($.NUMBER, $.IDENTIFIER, $.Grouping)
    ),

    // =====================================================================
    // Grouping (matches Grouping in Expr2.ts)
    // Parenthesized expressions: (expr)
    // =====================================================================

    Grouping: $ => seq(
      $.LPAREN,
      choice($.Binary, $.Unary, $.NUMBER, $.IDENTIFIER),
      $.RPAREN
    ),

    // =====================================================================
    // Rational (matches Rational in Expr2.ts)
    // Rational numbers: numerator/denominator
    // =====================================================================

    Rational: $ => seq(
      $.NUMBER,
      $.SLASH,
      $.NUMBER
    ),

    // =====================================================================
    // Measurement (matches Measurement in Expr2.ts)
    // Measurements with units: 1.5in, 2cm
    // =====================================================================

    Measurement: $ => seq(
      $.NUMBER,
      $.MEASUREMENT_UNIT
    ),

    // =====================================================================
    // Lyric_line (matches Lyric_line in Expr2.ts)
    // =====================================================================

    Lyric_line: $ => seq(
      choice($.LY_HDR, $.LY_SECT_HDR),
      repeat(choice(
        $.LY_TXT,
        $.LY_HYPH,
        $.LY_UNDR,
        $.LY_STAR,
        $.LY_SPS,
        $.BARLINE,
        $.WS,
        $.INF_CTND
      )),
      optional($.Comment),
      optional($.EOL)
    ),

    // =====================================================================
    // Lyric_section (matches Lyric_section in Expr2.ts)
    // =====================================================================

    Lyric_section: $ => repeat1($.Lyric_line),

    // =====================================================================
    // SymbolLine (matches SymbolLine in Expr2.ts, for s: lines)
    // =====================================================================

    SymbolLine: $ => seq(
      $.SY_HDR,
      repeat(choice(
        $.SY_TXT,
        $.SY_STAR,
        $.WS
      )),
      optional($.Comment),
      optional($.EOL)
    ),

    // =====================================================================
    // Annotation (matches Annotation in Expr2.ts)
    // =====================================================================

    Annotation: $ => $.ANNOTATION,

    // =====================================================================
    // Decoration (matches Decoration in Expr2.ts)
    // =====================================================================

    Decoration: $ => $.DECORATION,

    // =====================================================================
    // Symbol (matches Symbol in Expr2.ts)
    // =====================================================================

    Symbol: $ => $.SYMBOL,

    // =====================================================================
    // SystemBreak (matches SystemBreak in Expr2.ts)
    // =====================================================================

    SystemBreak: $ => $.SYSTEM_BREAK,

    // =====================================================================
    // Comment (matches Comment in Expr2.ts)
    // =====================================================================

    Comment: $ => $.COMMENT,

    // =====================================================================
    // Voice_overlay (matches Voice_overlay in Expr2.ts)
    // =====================================================================

    Voice_overlay: $ => choice(
      $.VOICE_OVRLAY,
      $.VOICE
    ),

    // =====================================================================
    // Line_continuation (matches Line_continuation in Expr2.ts)
    // =====================================================================

    Line_continuation: $ => $.LINE_CONT,

    // =====================================================================
    // Macro_decl (matches Macro_decl in Expr2.ts)
    // =====================================================================

    Macro_decl: $ => seq(
      $.MACRO_HDR,
      $.MACRO_VAR,
      $.MACRO_STR,
      optional($.EOL)
    ),

    // =====================================================================
    // Macro_invocation (matches Macro_invocation in Expr2.ts)
    // =====================================================================

    Macro_invocation: $ => $.MACRO_INVOCATION,

    // =====================================================================
    // User_symbol_decl (matches User_symbol_decl in Expr2.ts)
    // =====================================================================

    User_symbol_decl: $ => seq(
      $.USER_SY_HDR,
      $.USER_SY,
      $.SYMBOL,
      optional($.EOL)
    ),

    // =====================================================================
    // User_symbol_invocation (matches User_symbol_invocation in Expr2.ts)
    // =====================================================================

    User_symbol_invocation: $ => $.USER_SY_INVOCATION,

    // =====================================================================
    // ChordSymbol (matches ChordSymbol in Expr2.ts)
    // ABCx chord symbols
    // =====================================================================

    ChordSymbol: $ => $.CHORD_SYMBOL,

    // =====================================================================
    // ErrorExpr (matches ErrorExpr in Expr2.ts)
    // Error recovery
    // =====================================================================

    ErrorExpr: $ => repeat1($.INVALID)
  }
});
