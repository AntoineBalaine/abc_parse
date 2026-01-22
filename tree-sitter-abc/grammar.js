/**
 * TreeSitter grammar for ABC music notation
 *
 * This grammar uses an external scanner for all tokenization because ABC
 * notation has context-sensitive lexical rules that require multi-character
 * lookahead and backtracking.
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
    // Top level - minimal placeholder (full grammar in Phase 3)
    File_structure: $ => repeat(choice(
      $.Tune,
      $.SCT_BRK,
      $.COMMENT,
      $.FREE_TXT,
      $.EOL
    )),

    // Tune placeholder
    Tune: $ => seq(
      $.Tune_header,
      optional($.Tune_body)
    ),

    // Tune header placeholder
    Tune_header: $ => seq(
      $.INF_HDR,
      optional($.INFO_STR),
      $.EOL
    ),

    // Tune body placeholder
    Tune_body: $ => repeat1(choice(
      $.Music_code,
      $.Info_line,
      $.COMMENT,
      $.EOL
    )),

    // Music code placeholder
    Music_code: $ => repeat1(choice(
      $.Note,
      $.Rest,
      $.Chord,
      $.BARLINE,
      $.WS
    )),

    // Note placeholder
    Note: $ => seq(
      optional($.ACCIDENTAL),
      $.NOTE_LETTER,
      optional($.OCTAVE),
      optional($.Rhythm)
    ),

    // Rest placeholder
    Rest: $ => seq(
      $.REST,
      optional($.Rhythm)
    ),

    // Chord placeholder
    Chord: $ => seq(
      $.CHRD_LEFT_BRKT,
      repeat($.Note),
      $.CHRD_RIGHT_BRKT
    ),

    // Rhythm placeholder
    Rhythm: $ => choice(
      $.RHY_NUMER,
      seq($.RHY_NUMER, $.RHY_SEP, $.RHY_DENOM),
      seq($.RHY_SEP, $.RHY_DENOM)
    ),

    // Info line placeholder
    Info_line: $ => seq(
      $.INF_HDR,
      optional($.INFO_STR),
      $.EOL
    )
  }
});
