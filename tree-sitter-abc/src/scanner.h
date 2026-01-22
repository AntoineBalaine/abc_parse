/**
 * TreeSitter external scanner header for ABC music notation
 *
 * This scanner works directly with TSLexer using character-by-character
 * matching. No external regex library required.
 *
 * Key design:
 * - Use lexer->lookahead to peek at current character (non-consuming)
 * - Use lexer->advance() to consume characters
 * - Use lexer->mark_end() to mark token boundaries
 * - Simple character tests replace regex patterns
 */
#ifndef TREE_SITTER_ABC_SCANNER_H
#define TREE_SITTER_ABC_SCANNER_H

#include <tree_sitter/parser.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

/**
 * Token types - must match TT enum from TypeScript (84 tokens)
 * Order MUST match externals array in grammar.js exactly
 */
typedef enum {
  // Pitch and Music Elements
  TT_ACCIDENTAL,
  TT_NOTE_LETTER,
  TT_OCTAVE,
  TT_REST,
  TT_TIE,
  TT_DECORATION,
  TT_SLUR,
  TT_BARLINE,

  // Rhythmic Elements
  TT_RHY_NUMER,
  TT_RHY_DENOM,
  TT_RHY_SEP,
  TT_RHY_BRKN,
  TT_TUPLET_LPAREN,
  TT_TUPLET_P,
  TT_TUPLET_COLON,
  TT_TUPLET_Q,
  TT_TUPLET_R,
  TT_REPEAT_NUMBER,
  TT_REPEAT_COMMA,
  TT_REPEAT_DASH,
  TT_REPEAT_X,

  // Structural Brackets
  TT_CHRD_LEFT_BRKT,
  TT_CHRD_RIGHT_BRKT,
  TT_GRC_GRP_LEFT_BRACE,
  TT_GRC_GRP_RGHT_BRACE,
  TT_GRC_GRP_SLSH,
  TT_INLN_FLD_LFT_BRKT,
  TT_INLN_FLD_RGT_BRKT,

  // Generic Punctuation (for directive/info line contexts)
  TT_EQL,
  TT_SLASH,
  TT_MINUS,
  TT_PLUS,
  TT_LPAREN,
  TT_RPAREN,
  TT_LBRACE,
  TT_RBRACE,
  TT_LBRACKET,
  TT_RBRACKET,
  TT_PIPE,

  // Information Fields
  TT_ANNOTATION,
  TT_INF_HDR,
  TT_INFO_STR,
  TT_INF_CTND,
  TT_VOICE,
  TT_VOICE_OVRLAY,
  TT_LINE_CONT,

  // Symbols and Special
  TT_SYMBOL,
  TT_USER_SY,
  TT_USER_SY_HDR,
  TT_USER_SY_INVOCATION,
  TT_MACRO_HDR,
  TT_MACRO_STR,
  TT_MACRO_INVOCATION,
  TT_MACRO_VAR,

  // Lyrics
  TT_LY_HDR,
  TT_LY_TXT,
  TT_LY_UNDR,
  TT_LY_HYPH,
  TT_LY_SECT_HDR,
  TT_LY_SPS,
  TT_LY_STAR,

  // Symbol Line
  TT_SY_HDR,
  TT_SY_STAR,
  TT_SY_TXT,

  // Directives
  TT_STYLESHEET_DIRECTIVE,
  TT_MEASUREMENT_UNIT,

  // Utility
  TT_AMPERSAND,
  TT_SYSTEM_BREAK,
  TT_BCKTCK_SPC,
  TT_Y_SPC,
  TT_SPECIAL_LITERAL,

  // General
  TT_IDENTIFIER,
  TT_NUMBER,
  TT_RESERVED_CHAR,
  TT_ESCAPED_CHAR,
  TT_CHORD_SYMBOL,
  TT_DISCARD,

  // Structural
  TT_COMMENT,
  TT_WS,
  TT_EOL,
  TT_FREE_TXT,
  TT_SCT_BRK,
  TT_INVALID,
  TT_EOF,

  TT_COUNT  // Total: 84
} TokenType;

/**
 * Scanner state - persisted across incremental parses
 * Keep this minimal for efficient serialization
 */
typedef struct {
  bool in_tune_body;     // Inside tune body vs header
  bool in_text_block;    // Inside %%begintext...%%endtext
  uint16_t line_number;  // For error reporting
} ScannerState;

// ============================================================================
// Character classification helpers (inline for performance)
// ============================================================================

static inline bool is_note_letter(int32_t c) {
  return (c >= 'a' && c <= 'g') || (c >= 'A' && c <= 'G');
}

static inline bool is_rest_char(int32_t c) {
  return c == 'z' || c == 'Z' || c == 'x' || c == 'X';
}

static inline bool is_digit(int32_t c) {
  return c >= '0' && c <= '9';
}

static inline bool is_octave_char(int32_t c) {
  return c == '\'' || c == ',';
}

static inline bool is_decoration_char(int32_t c) {
  return c == '.' || c == '~' || c == 'H' || c == 'L' || c == 'M' ||
         c == 'O' || c == 'P' || c == 'R' || c == 'S' || c == 'T' ||
         c == 'u' || c == 'v';
}

static inline bool is_broken_rhythm_char(int32_t c) {
  return c == '<' || c == '>';
}

static inline bool is_ws_char(int32_t c) {
  return c == ' ' || c == '\t';
}

static inline bool is_alpha(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

static inline bool is_alnum(int32_t c) {
  return is_alpha(c) || is_digit(c);
}

static inline bool is_identifier_start(int32_t c) {
  return is_alpha(c) || c == '_';
}

static inline bool is_identifier_char(int32_t c) {
  return is_alnum(c) || c == '_' || c == '-';
}

#endif // TREE_SITTER_ABC_SCANNER_H
