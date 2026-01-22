/**
 * TreeSitter external scanner header for ABC music notation
 *
 * This header defines all token types, pattern IDs, and the scanner context
 * that mirrors the TypeScript scanner architecture.
 */
#ifndef TREE_SITTER_ABC_SCANNER_H
#define TREE_SITTER_ABC_SCANNER_H

#include <tree_sitter/parser.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

// Forward declaration - will include PCRE2 when implementing scanner.c
// #define PCRE2_CODE_UNIT_WIDTH 8
// #include <pcre2.h>

/**
 * Token types - must match TT enum from TypeScript (84 tokens)
 * Order must match externals array in grammar.js
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

  TT_COUNT  // Total count: 84 (matches TT enum from scan2.ts)
} TokenType;

/**
 * Pattern IDs for pre-compiled regex patterns
 */
typedef enum {
  PAT_NOTE_LETTER,     // [a-gA-G]
  PAT_OCTAVE,          // [',]+
  PAT_ACCIDENTAL,      // (\^[\^\/]?)|(_[_\/]?)|=
  PAT_REST,            // [zZxX]
  PAT_DIGIT,           // [0-9]
  PAT_DIGITS,          // [0-9]+
  PAT_NUMBER,          // [0-9]+(\.[0-9]+)?
  PAT_BROKEN_RHYTHM,   // [><]+
  PAT_DECORATION,      // [.~HLMOPRSTuv]+
  PAT_WS,              // [ \t]+
  PAT_EOL,             // \r?\n
  PAT_IDENTIFIER,      // [a-zA-Z_][a-zA-Z0-9_]*
  PAT_INFO_HDR,        // [A-Za-z][ \t]*:
  PAT_ANNOTATION,      // "([^"\\]|\\.)*"
  PAT_SYMBOL,          // ![^\n!]+!|\+[^\n+]+\+
  PAT_COUNT
} PatternId;

/**
 * Pre-compiled regex pattern (will be implemented with PCRE2)
 */
typedef struct {
  void *code;           // pcre2_code* (void* for now to avoid include)
  void *match_data;     // pcre2_match_data*
} Pattern;

/**
 * Simple string map for macros/user-symbols (linked list)
 */
typedef struct StringMapEntry {
  char *key;
  char *value;
  struct StringMapEntry *next;
} StringMapEntry;

typedef struct {
  StringMapEntry *head;
} StringMap;

/**
 * Scanner context - mirrors TypeScript Ctx class
 */
typedef struct {
  const char *source;       // Input text (UTF-8)
  size_t source_len;        // Length of source
  size_t source_capacity;   // Allocated capacity
  size_t start;             // Start of current token
  size_t current;           // Current cursor position
  int line;                 // 0-based line number
  size_t line_start;        // Byte offset of line start

  // State for multi-line constructs
  bool in_text_block;       // Inside %%begintext...%%endtext
  bool in_tune_body;        // Inside tune body vs header

  // Context-sensitive maps (like TypeScript Ctx)
  StringMap *macros;        // Macro declarations
  StringMap *user_symbols;  // User-defined symbols

  // Pre-compiled regex patterns
  Pattern patterns[PAT_COUNT];

  // Reference to TSLexer for final output
  TSLexer *lexer;
} ScanCtx;

// Context operations (implemented in scanner.c)
void ctx_init(ScanCtx *ctx, TSLexer *lexer);
void ctx_init_patterns(ScanCtx *ctx);
void ctx_free_patterns(ScanCtx *ctx);
bool ctx_test_char(ScanCtx *ctx, char c);
bool ctx_test_str(ScanCtx *ctx, const char *str);
bool ctx_test_charset(ScanCtx *ctx, const char *charset);
bool ctx_test_regex(ScanCtx *ctx, PatternId pat);
size_t ctx_match_regex(ScanCtx *ctx, PatternId pat);
void ctx_advance(ScanCtx *ctx, size_t count);
char ctx_peek(ScanCtx *ctx);
char ctx_peek_next(ScanCtx *ctx);
bool ctx_is_at_end(ScanCtx *ctx);
void ctx_emit(ScanCtx *ctx, TokenType type);

// String map operations
StringMap *stringmap_create(void);
void stringmap_free(StringMap *map);
void stringmap_clear(StringMap *map);
void stringmap_set(StringMap *map, const char *key, const char *value);
const char *stringmap_get(StringMap *map, const char *key);

// Sub-scanner functions (boolean, like TypeScript)
bool scan_comment(ScanCtx *ctx);
bool scan_ws(ScanCtx *ctx);
bool scan_eol(ScanCtx *ctx);
bool scan_annotation(ScanCtx *ctx);
bool scan_inline_field(ScanCtx *ctx);
bool scan_chord(ScanCtx *ctx);
bool scan_grace_group(ScanCtx *ctx);
bool scan_tuplet(ScanCtx *ctx);
bool scan_barline(ScanCtx *ctx);
bool scan_decoration(ScanCtx *ctx);
bool scan_note(ScanCtx *ctx);
bool scan_pitch(ScanCtx *ctx);
bool scan_rhythm(ScanCtx *ctx);
bool scan_rest(ScanCtx *ctx);
bool scan_tie(ScanCtx *ctx);
bool scan_slur(ScanCtx *ctx);
bool scan_symbol(ScanCtx *ctx);
bool scan_ampersand(ScanCtx *ctx);
bool scan_line_continuation(ScanCtx *ctx);
bool scan_info_line(ScanCtx *ctx);
bool scan_lyric_line(ScanCtx *ctx);
bool scan_symbol_line(ScanCtx *ctx);
bool scan_directive(ScanCtx *ctx);
bool scan_system_break(ScanCtx *ctx);
bool scan_y_spacer(ScanCtx *ctx);
bool scan_bcktck_spacer(ScanCtx *ctx);
bool scan_repeat_numbers(ScanCtx *ctx);

// Error recovery
bool collect_invalid_token(ScanCtx *ctx);
bool is_recovery_point(ScanCtx *ctx);

#endif // TREE_SITTER_ABC_SCANNER_H
