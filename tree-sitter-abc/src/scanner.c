/**
 * TreeSitter external scanner for ABC music notation
 *
 * This scanner mirrors the architecture of the TypeScript scanner in
 * parse/parsers/scan2.ts, using a context struct and boolean sub-functions.
 *
 * Key design decisions:
 * 1. We work directly with TSLexer for token matching (no full buffer)
 * 2. PCRE2 patterns are pre-compiled once in create()
 * 3. For complex patterns requiring lookahead, we use a small lookahead buffer
 * 4. The scanner context stores state that persists across TreeSitter calls
 */

#include "scanner.h"

#define PCRE2_CODE_UNIT_WIDTH 8
#include <pcre2.h>
#include <stdio.h>

// Maximum lookahead buffer size for pattern matching
#define MAX_LOOKAHEAD 256

// Pattern definitions (regex strings)
static const char *PATTERN_STRINGS[PAT_COUNT] = {
  "[a-gA-G]",                           // PAT_NOTE_LETTER
  "[',]+",                              // PAT_OCTAVE
  "(\\^[\\^\\/]?)|(_[_\\/]?)|=",        // PAT_ACCIDENTAL
  "[zZxX]",                             // PAT_REST
  "[0-9]",                              // PAT_DIGIT
  "[0-9]+",                             // PAT_DIGITS
  "[0-9]+(\\.[0-9]+)?",                 // PAT_NUMBER
  "[><]+",                              // PAT_BROKEN_RHYTHM
  "[.~HLMOPRSTuv]+",                    // PAT_DECORATION
  "[ \\t]+",                            // PAT_WS
  "\\r?\\n",                            // PAT_EOL
  "[a-zA-Z_][a-zA-Z0-9_\\-]*",          // PAT_IDENTIFIER
  "[A-Za-z][ \\t]*:",                   // PAT_INFO_HDR
  "\"([^\"\\\\\\n]|\\\\.)*\"",          // PAT_ANNOTATION
  "![^\\n!]+!|\\+[^\\n+]+\\+",          // PAT_SYMBOL
};

// ============================================================================
// PCRE2 Pattern Management
// ============================================================================

void ctx_init_patterns(ScanCtx *ctx) {
  int errcode;
  PCRE2_SIZE erroffset;

  for (int i = 0; i < PAT_COUNT; i++) {
    pcre2_code *code = pcre2_compile(
      (PCRE2_SPTR)PATTERN_STRINGS[i],
      PCRE2_ZERO_TERMINATED,
      0,  // No compile-time flags; PCRE2_ANCHORED passed at match time
      &errcode, &erroffset, NULL
    );
    if (code) {
      ctx->patterns[i].code = code;
      ctx->patterns[i].match_data = pcre2_match_data_create_from_pattern(code, NULL);
    } else {
      ctx->patterns[i].code = NULL;
      ctx->patterns[i].match_data = NULL;
    }
  }
}

void ctx_free_patterns(ScanCtx *ctx) {
  for (int i = 0; i < PAT_COUNT; i++) {
    if (ctx->patterns[i].match_data) {
      pcre2_match_data_free((pcre2_match_data *)ctx->patterns[i].match_data);
    }
    if (ctx->patterns[i].code) {
      pcre2_code_free((pcre2_code *)ctx->patterns[i].code);
    }
  }
}

// ============================================================================
// Lookahead Buffer Management
// ============================================================================

/**
 * Fills a lookahead buffer from the current lexer position.
 * Returns the number of characters read.
 * Does not advance the lexer - just peeks ahead.
 */
static size_t fill_lookahead(TSLexer *lexer, char *buffer, size_t max_len) {
  size_t len = 0;

  // Save current position by marking end
  lexer->mark_end(lexer);

  while (len < max_len && !lexer->eof(lexer)) {
    buffer[len++] = (char)lexer->lookahead;
    lexer->advance(lexer, false);  // Advance to peek
  }
  buffer[len] = '\0';

  return len;
}

/**
 * Tests a pattern against text at the current lexer position.
 * Uses a lookahead buffer for regex matching.
 */
static bool test_pattern(ScanCtx *ctx, PatternId pat, size_t *match_len) {
  if (!ctx->patterns[pat].code) return false;

  char buffer[MAX_LOOKAHEAD + 1];
  size_t buf_len = fill_lookahead(ctx->lexer, buffer, MAX_LOOKAHEAD);

  if (buf_len == 0) return false;

  int rc = pcre2_match(
    (pcre2_code *)ctx->patterns[pat].code,
    (PCRE2_SPTR)buffer,
    buf_len,
    0,  // Start at beginning of buffer
    PCRE2_ANCHORED,
    (pcre2_match_data *)ctx->patterns[pat].match_data,
    NULL
  );

  if (rc < 0) {
    if (match_len) *match_len = 0;
    return false;
  }

  PCRE2_SIZE *ovector = pcre2_get_ovector_pointer(
    (pcre2_match_data *)ctx->patterns[pat].match_data
  );
  if (match_len) *match_len = ovector[1] - ovector[0];
  return true;
}

// ============================================================================
// Lexer Helper Functions
// ============================================================================

static inline int32_t peek(TSLexer *lexer) {
  return lexer->lookahead;
}

static inline bool at_eof(TSLexer *lexer) {
  return lexer->eof(lexer);
}

static inline void advance(TSLexer *lexer) {
  lexer->advance(lexer, false);
}

static inline void skip(TSLexer *lexer) {
  lexer->advance(lexer, true);
}

static inline bool check_char(TSLexer *lexer, char c) {
  return lexer->lookahead == (int32_t)(unsigned char)c;
}

static inline bool check_charset(TSLexer *lexer, const char *charset) {
  for (const char *p = charset; *p; p++) {
    if (lexer->lookahead == (int32_t)(unsigned char)*p) return true;
  }
  return false;
}

/**
 * Checks if the next characters match a string.
 * Uses lookahead buffer without consuming.
 */
static bool check_string(TSLexer *lexer, const char *str) {
  size_t len = strlen(str);
  if (len == 0) return true;
  if (len > MAX_LOOKAHEAD) return false;

  char buffer[MAX_LOOKAHEAD + 1];
  size_t buf_len = fill_lookahead(lexer, buffer, len);

  return buf_len >= len && strncmp(buffer, str, len) == 0;
}

/**
 * Consumes n characters from the lexer.
 */
static void consume(TSLexer *lexer, size_t n) {
  for (size_t i = 0; i < n && !at_eof(lexer); i++) {
    advance(lexer);
  }
}

/**
 * Consumes characters while they match the charset.
 * Returns number of characters consumed.
 */
static size_t consume_while_charset(TSLexer *lexer, const char *charset) {
  size_t count = 0;
  while (!at_eof(lexer) && check_charset(lexer, charset)) {
    advance(lexer);
    count++;
  }
  return count;
}

/**
 * Consumes characters until a character in the charset is found.
 * Returns number of characters consumed.
 */
static size_t consume_until_charset(TSLexer *lexer, const char *charset) {
  size_t count = 0;
  while (!at_eof(lexer) && !check_charset(lexer, charset)) {
    advance(lexer);
    count++;
  }
  return count;
}

// ============================================================================
// String Map Implementation
// ============================================================================

StringMap *stringmap_create(void) {
  StringMap *map = malloc(sizeof(StringMap));
  if (map) {
    map->head = NULL;
  }
  return map;
}

void stringmap_free(StringMap *map) {
  if (!map) return;
  stringmap_clear(map);
  free(map);
}

void stringmap_clear(StringMap *map) {
  if (!map) return;
  StringMapEntry *entry = map->head;
  while (entry) {
    StringMapEntry *next = entry->next;
    free(entry->key);
    free(entry->value);
    free(entry);
    entry = next;
  }
  map->head = NULL;
}

void stringmap_set(StringMap *map, const char *key, const char *value) {
  if (!map || !key || !value) return;

  // Check if key exists
  for (StringMapEntry *entry = map->head; entry; entry = entry->next) {
    if (strcmp(entry->key, key) == 0) {
      free(entry->value);
      entry->value = strdup(value);
      return;
    }
  }

  // Add new entry
  StringMapEntry *entry = malloc(sizeof(StringMapEntry));
  if (!entry) return;
  entry->key = strdup(key);
  entry->value = strdup(value);
  if (!entry->key || !entry->value) {
    free(entry->key);
    free(entry->value);
    free(entry);
    return;
  }
  entry->next = map->head;
  map->head = entry;
}

const char *stringmap_get(StringMap *map, const char *key) {
  if (!map || !key) return NULL;
  for (StringMapEntry *entry = map->head; entry; entry = entry->next) {
    if (strcmp(entry->key, key) == 0) {
      return entry->value;
    }
  }
  return NULL;
}

// ============================================================================
// Helper Functions
// ============================================================================

static bool is_note_letter(int32_t c) {
  return (c >= 'a' && c <= 'g') || (c >= 'A' && c <= 'G');
}

static bool is_pitch_start(TSLexer *lexer) {
  int32_t c = peek(lexer);
  return is_note_letter(c) || c == '^' || c == '_' || c == '=';
}

static bool is_rest_char(int32_t c) {
  return c == 'z' || c == 'Z' || c == 'x' || c == 'X';
}

static bool is_digit(int32_t c) {
  return c >= '0' && c <= '9';
}

static bool is_decoration_char(int32_t c) {
  return c == '.' || c == '~' || c == 'H' || c == 'L' || c == 'M' ||
         c == 'O' || c == 'P' || c == 'R' || c == 'S' || c == 'T' ||
         c == 'u' || c == 'v';
}

// ============================================================================
// Sub-Scanner Functions
// ============================================================================

bool scan_comment(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '%')) return false;
  // Skip %% (stylesheet directive)
  if (check_string(lexer, "%%")) return false;

  advance(lexer);
  consume_until_charset(lexer, "\n");
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_COMMENT;
  return true;
}

bool scan_ws(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_charset(lexer, " \t")) return false;

  consume_while_charset(lexer, " \t");
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_WS;
  return true;
}

bool scan_eol(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  if (check_char(lexer, '\r')) {
    advance(lexer);
    if (check_char(lexer, '\n')) {
      advance(lexer);
    }
    ctx->line++;
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_EOL;
    return true;
  }

  if (check_char(lexer, '\n')) {
    advance(lexer);
    ctx->line++;
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_EOL;
    return true;
  }

  return false;
}

bool scan_annotation(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '"')) return false;

  advance(lexer);  // consume opening quote
  while (!at_eof(lexer) && !check_char(lexer, '\n')) {
    if (check_char(lexer, '\\')) {
      advance(lexer);  // consume backslash
      if (!at_eof(lexer) && !check_char(lexer, '\n')) {
        advance(lexer);  // consume escaped character
      }
    } else if (check_char(lexer, '"')) {
      advance(lexer);  // consume closing quote
      lexer->mark_end(lexer);
      lexer->result_symbol = TT_ANNOTATION;
      return true;
    } else {
      advance(lexer);
    }
  }
  // Unterminated string - still emit what we have
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_ANNOTATION;
  return true;
}

bool scan_tuplet(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '(')) return false;

  // Peek at next char to distinguish from slur
  char buffer[3];
  fill_lookahead(lexer, buffer, 2);
  if (buffer[0] != '(' || !(buffer[1] >= '1' && buffer[1] <= '9')) {
    return false;
  }

  advance(lexer);  // consume (
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_TUPLET_LPAREN;
  return true;
}

bool scan_barline(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  // Check for barline starting characters
  if (!check_charset(lexer, ":|[")) return false;

  // Colon-start barline (:| or ::)
  if (check_char(lexer, ':')) {
    consume_while_charset(lexer, ":");
    if (check_char(lexer, '|')) {
      consume_while_charset(lexer, "|");
      consume_while_charset(lexer, " \t");
      if (check_charset(lexer, "[]")) {
        advance(lexer);
      }
    }
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_BARLINE;
    return true;
  }

  // Pipe-start barline
  if (check_char(lexer, '|')) {
    consume_while_charset(lexer, "|");

    // Check for colons
    if (check_char(lexer, ':')) {
      consume_while_charset(lexer, ":");
      lexer->mark_end(lexer);
      lexer->result_symbol = TT_BARLINE;
      return true;
    }

    // Check for brackets
    consume_while_charset(lexer, " \t");
    if (check_charset(lexer, "[]")) {
      advance(lexer);
    }

    lexer->mark_end(lexer);
    lexer->result_symbol = TT_BARLINE;
    return true;
  }

  // Bracket-start barline
  if (check_char(lexer, '[')) {
    char buffer[4];
    fill_lookahead(lexer, buffer, 3);

    // [| or [] or [digit
    if (buffer[1] == '|' || buffer[1] == ']' || (buffer[1] >= '1' && buffer[1] <= '9')) {
      advance(lexer);  // consume [

      if (check_char(lexer, '|')) {
        advance(lexer);
        consume_while_charset(lexer, ":");
        if (check_char(lexer, ']')) {
          advance(lexer);
        }
      } else if (check_char(lexer, ']')) {
        advance(lexer);
      }

      lexer->mark_end(lexer);
      lexer->result_symbol = TT_BARLINE;
      return true;
    }
  }

  return false;
}

bool scan_decoration(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!is_decoration_char(peek(lexer))) return false;

  // Need lookahead to verify decoration is followed by pitch/rest/chord
  size_t match_len;
  if (!test_pattern(ctx, PAT_DECORATION, &match_len) || match_len == 0) {
    return false;
  }

  // Use lookahead to check what follows
  char buffer[MAX_LOOKAHEAD + 1];
  size_t buf_len = fill_lookahead(lexer, buffer, match_len + 1);

  if (buf_len <= match_len) return false;

  char next_char = buffer[match_len];
  if (!is_note_letter(next_char) && !is_rest_char(next_char) &&
      next_char != '^' && next_char != '_' && next_char != '=' && next_char != '[') {
    return false;
  }

  // Consume decoration characters
  consume(lexer, match_len);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_DECORATION;
  return true;
}

bool scan_pitch(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  // Check for accidental
  size_t acc_len = 0;
  if (check_charset(lexer, "^_=")) {
    test_pattern(ctx, PAT_ACCIDENTAL, &acc_len);
    if (acc_len > 0) {
      consume(lexer, acc_len);
      lexer->mark_end(lexer);
      lexer->result_symbol = TT_ACCIDENTAL;
      return true;  // Return after accidental, note letter comes in next call
    }
  }

  // Check for note letter
  if (is_note_letter(peek(lexer))) {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_NOTE_LETTER;
    return true;
  }

  return false;
}

bool scan_octave(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_charset(lexer, "',")) return false;

  size_t match_len;
  if (test_pattern(ctx, PAT_OCTAVE, &match_len) && match_len > 0) {
    consume(lexer, match_len);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_OCTAVE;
    return true;
  }
  return false;
}

bool scan_rhythm(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  // Numerator
  if (is_digit(peek(lexer))) {
    size_t match_len;
    if (test_pattern(ctx, PAT_DIGITS, &match_len) && match_len > 0) {
      consume(lexer, match_len);
      lexer->mark_end(lexer);
      lexer->result_symbol = TT_RHY_NUMER;
      return true;
    }
  }

  // Rhythm separator (/)
  if (check_char(lexer, '/')) {
    consume_while_charset(lexer, "/");
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_RHY_SEP;
    return true;
  }

  // Broken rhythm (> or <)
  if (check_charset(lexer, "><")) {
    size_t match_len;
    if (test_pattern(ctx, PAT_BROKEN_RHYTHM, &match_len) && match_len > 0) {
      consume(lexer, match_len);
      lexer->mark_end(lexer);
      lexer->result_symbol = TT_RHY_BRKN;
      return true;
    }
  }

  return false;
}

bool scan_rest(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!is_rest_char(peek(lexer))) return false;

  advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_REST;
  return true;
}

bool scan_tie(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '-')) return false;

  advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_TIE;
  return true;
}

bool scan_slur(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_charset(lexer, "()")) return false;

  // Check that it's not a tuplet
  if (check_char(lexer, '(')) {
    char buffer[3];
    fill_lookahead(lexer, buffer, 2);
    if (buffer[1] >= '1' && buffer[1] <= '9') {
      return false;  // It's a tuplet
    }
  }

  advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_SLUR;
  return true;
}

bool scan_symbol(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_charset(lexer, "!+")) return false;

  size_t match_len;
  if (test_pattern(ctx, PAT_SYMBOL, &match_len) && match_len > 0) {
    consume(lexer, match_len);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_SYMBOL;
    return true;
  }
  return false;
}

bool scan_ampersand(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '&')) return false;

  char buffer[3];
  fill_lookahead(lexer, buffer, 2);

  if (buffer[1] == '\n') {
    advance(lexer);
    advance(lexer);
    ctx->line++;
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_VOICE_OVRLAY;
    return true;
  }

  advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_VOICE;
  return true;
}

bool scan_line_continuation(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '\\')) return false;

  // Look ahead to verify pattern: \<space?><comment?><EOL>
  char buffer[MAX_LOOKAHEAD + 1];
  size_t buf_len = fill_lookahead(lexer, buffer, MAX_LOOKAHEAD);

  if (buf_len < 2) return false;

  size_t pos = 1;  // Start after backslash
  // Skip whitespace
  while (pos < buf_len && (buffer[pos] == ' ' || buffer[pos] == '\t')) {
    pos++;
  }
  // Optional comment
  if (pos < buf_len && buffer[pos] == '%') {
    while (pos < buf_len && buffer[pos] != '\n') {
      pos++;
    }
  }
  // Must have newline
  if (pos >= buf_len || buffer[pos] != '\n') {
    return false;
  }

  // Only consume the backslash
  advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_LINE_CONT;
  return true;
}

bool scan_directive(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_string(lexer, "%%")) return false;

  advance(lexer);
  advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_STYLESHEET_DIRECTIVE;
  return true;
}

bool scan_info_line(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  size_t match_len;
  if (!test_pattern(ctx, PAT_INFO_HDR, &match_len) || match_len == 0) {
    return false;
  }

  consume(lexer, match_len);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_INF_HDR;
  return true;
}

bool scan_system_break(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '!')) return false;

  // System break is standalone ! surrounded by whitespace
  // We can't easily check previous char, so we rely on grammar context
  char buffer[3];
  size_t buf_len = fill_lookahead(lexer, buffer, 2);

  if (buf_len >= 2 && (buffer[1] == ' ' || buffer[1] == '\t' || buffer[1] == '\n')) {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_SYSTEM_BREAK;
    return true;
  }

  return false;
}

bool scan_y_spacer(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, 'y')) return false;

  advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_Y_SPC;
  return true;
}

bool scan_bcktck_spacer(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '`')) return false;

  advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = TT_BCKTCK_SPC;
  return true;
}

bool scan_chord_bracket(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  if (check_char(lexer, '[')) {
    // Check if it's a chord (not barline, not inline field)
    char buffer[4];
    fill_lookahead(lexer, buffer, 3);

    // Chord contains pitch or annotation
    if (buffer[1] == '"' || is_note_letter(buffer[1]) ||
        buffer[1] == '^' || buffer[1] == '_' || buffer[1] == '=') {
      advance(lexer);
      lexer->mark_end(lexer);
      lexer->result_symbol = TT_CHRD_LEFT_BRKT;
      return true;
    }
  }

  if (check_char(lexer, ']')) {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_CHRD_RIGHT_BRKT;
    return true;
  }

  return false;
}

bool scan_grace_group_bracket(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  if (check_char(lexer, '{')) {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_GRC_GRP_LEFT_BRACE;
    return true;
  }

  if (check_char(lexer, '}')) {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_GRC_GRP_RGHT_BRACE;
    return true;
  }

  if (check_char(lexer, '/')) {
    // Check if we're inside a grace group (grammar will handle context)
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_GRC_GRP_SLSH;
    return true;
  }

  return false;
}

bool scan_inline_field_bracket(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  if (check_char(lexer, '[')) {
    // Check if it's an inline field [letter:]
    char buffer[8];
    size_t buf_len = fill_lookahead(lexer, buffer, 7);

    size_t pos = 1;
    // Skip whitespace
    while (pos < buf_len && (buffer[pos] == ' ' || buffer[pos] == '\t')) {
      pos++;
    }
    // Check for letter
    if (pos >= buf_len) return false;
    char letter = buffer[pos];
    if (!((letter >= 'a' && letter <= 'z') || (letter >= 'A' && letter <= 'Z'))) {
      return false;
    }
    pos++;
    // Skip whitespace
    while (pos < buf_len && (buffer[pos] == ' ' || buffer[pos] == '\t')) {
      pos++;
    }
    // Check for colon
    if (pos >= buf_len || buffer[pos] != ':') {
      return false;
    }

    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_INLN_FLD_LFT_BRKT;
    return true;
  }

  // Closing bracket handled by grammar
  return false;
}

bool scan_repeat_number(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  if (is_digit(peek(lexer)) && peek(lexer) != '0') {
    size_t match_len;
    if (test_pattern(ctx, PAT_DIGITS, &match_len) && match_len > 0) {
      consume(lexer, match_len);
      lexer->mark_end(lexer);
      lexer->result_symbol = TT_REPEAT_NUMBER;
      return true;
    }
  }

  if (check_char(lexer, ',')) {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_REPEAT_COMMA;
    return true;
  }

  if (check_char(lexer, '-')) {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_REPEAT_DASH;
    return true;
  }

  if (check_charset(lexer, "xX")) {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_REPEAT_X;
    return true;
  }

  return false;
}

bool scan_identifier(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  size_t match_len;
  if (test_pattern(ctx, PAT_IDENTIFIER, &match_len) && match_len > 0) {
    consume(lexer, match_len);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_IDENTIFIER;
    return true;
  }
  return false;
}

bool scan_number(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  size_t match_len;
  if (test_pattern(ctx, PAT_NUMBER, &match_len) && match_len > 0) {
    consume(lexer, match_len);
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_NUMBER;
    return true;
  }
  return false;
}

bool scan_section_break(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;
  if (!check_char(lexer, '\n')) return false;

  // Look ahead for blank line pattern
  char buffer[MAX_LOOKAHEAD + 1];
  size_t buf_len = fill_lookahead(lexer, buffer, MAX_LOOKAHEAD);

  if (buf_len < 2) return false;

  // Must start with newline
  if (buffer[0] != '\n') return false;

  // Must have at least one blank line
  size_t pos = 1;
  bool found_blank_line = false;

  while (pos < buf_len) {
    // Skip whitespace
    while (pos < buf_len && (buffer[pos] == ' ' || buffer[pos] == '\t')) {
      pos++;
    }
    // Must have newline
    if (pos >= buf_len || buffer[pos] != '\n') {
      break;
    }
    pos++;
    found_blank_line = true;
  }

  if (!found_blank_line) return false;

  // Consume the section break
  for (size_t i = 0; i < pos && !at_eof(lexer); i++) {
    if (peek(lexer) == '\n') ctx->line++;
    advance(lexer);
  }

  lexer->mark_end(lexer);
  lexer->result_symbol = TT_SCT_BRK;
  return true;
}

bool collect_invalid_token(ScanCtx *ctx) {
  TSLexer *lexer = ctx->lexer;

  // Collect until recovery point
  bool collected = false;
  while (!at_eof(lexer) && !check_charset(lexer, "\n \t|")) {
    advance(lexer);
    collected = true;
  }

  if (collected) {
    lexer->mark_end(lexer);
    lexer->result_symbol = TT_INVALID;
    return true;
  }

  return false;
}

// ============================================================================
// Context Operations (for header compatibility)
// ============================================================================

void ctx_init(ScanCtx *ctx, TSLexer *lexer) {
  ctx->lexer = lexer;
  ctx->start = 0;
  ctx->current = 0;
  ctx->line = 0;
  ctx->line_start = 0;
  ctx->in_text_block = false;
  ctx->in_tune_body = false;
}

bool ctx_test_char(ScanCtx *ctx, char c) {
  return check_char(ctx->lexer, c);
}

bool ctx_test_str(ScanCtx *ctx, const char *str) {
  return check_string(ctx->lexer, str);
}

bool ctx_test_charset(ScanCtx *ctx, const char *charset) {
  return check_charset(ctx->lexer, charset);
}

bool ctx_test_regex(ScanCtx *ctx, PatternId pat) {
  size_t match_len;
  return test_pattern(ctx, pat, &match_len) && match_len > 0;
}

size_t ctx_match_regex(ScanCtx *ctx, PatternId pat) {
  size_t match_len;
  if (test_pattern(ctx, pat, &match_len)) {
    return match_len;
  }
  return 0;
}

void ctx_advance(ScanCtx *ctx, size_t count) {
  consume(ctx->lexer, count);
}

char ctx_peek(ScanCtx *ctx) {
  return (char)peek(ctx->lexer);
}

char ctx_peek_next(ScanCtx *ctx) {
  char buffer[3];
  fill_lookahead(ctx->lexer, buffer, 2);
  return buffer[1];
}

bool ctx_is_at_end(ScanCtx *ctx) {
  return at_eof(ctx->lexer);
}

void ctx_emit(ScanCtx *ctx, TokenType type) {
  ctx->lexer->mark_end(ctx->lexer);
  ctx->lexer->result_symbol = type;
}

// Stub implementations for functions declared in header but not needed
bool scan_note(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_chord(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_grace_group(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_inline_field(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_lyric_line(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_symbol_line(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_repeat_numbers(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_free_text(ScanCtx *ctx) { (void)ctx; return false; }
bool is_recovery_point(ScanCtx *ctx) { (void)ctx; return false; }

// ============================================================================
// TreeSitter External Scanner API
// ============================================================================

void *tree_sitter_abc_external_scanner_create(void) {
  ScanCtx *ctx = malloc(sizeof(ScanCtx));
  if (!ctx) return NULL;

  memset(ctx, 0, sizeof(ScanCtx));
  ctx->macros = stringmap_create();
  ctx->user_symbols = stringmap_create();
  ctx_init_patterns(ctx);

  return ctx;
}

void tree_sitter_abc_external_scanner_destroy(void *payload) {
  ScanCtx *ctx = (ScanCtx *)payload;
  if (!ctx) return;

  if (ctx->source) {
    free((void *)ctx->source);
  }
  if (ctx->macros) {
    stringmap_free(ctx->macros);
  }
  if (ctx->user_symbols) {
    stringmap_free(ctx->user_symbols);
  }
  ctx_free_patterns(ctx);

  free(ctx);
}

unsigned tree_sitter_abc_external_scanner_serialize(
  void *payload,
  char *buffer
) {
  ScanCtx *ctx = (ScanCtx *)payload;
  unsigned pos = 0;

  // Fixed state (4 bytes)
  buffer[pos++] = ctx->in_text_block;
  buffer[pos++] = ctx->in_tune_body;
  buffer[pos++] = (ctx->line >> 8) & 0xFF;
  buffer[pos++] = ctx->line & 0xFF;

  // Macro count
  uint8_t macro_count = 0;
  for (StringMapEntry *e = ctx->macros->head; e && macro_count < 255; e = e->next) {
    macro_count++;
  }
  buffer[pos++] = macro_count;

  // Macro entries (key_len, val_len, key, value)
  for (StringMapEntry *e = ctx->macros->head; e && pos < 1000; e = e->next) {
    size_t key_len = strlen(e->key);
    size_t val_len = strlen(e->value);
    if (pos + 2 + key_len + val_len > 1000) break;
    buffer[pos++] = (uint8_t)key_len;
    buffer[pos++] = (uint8_t)val_len;
    memcpy(buffer + pos, e->key, key_len);
    pos += key_len;
    memcpy(buffer + pos, e->value, val_len);
    pos += val_len;
  }

  // User symbol count
  uint8_t user_symbol_count = 0;
  for (StringMapEntry *e = ctx->user_symbols->head; e && user_symbol_count < 255; e = e->next) {
    user_symbol_count++;
  }
  buffer[pos++] = user_symbol_count;

  // User symbol entries
  for (StringMapEntry *e = ctx->user_symbols->head; e && pos < 1000; e = e->next) {
    size_t key_len = strlen(e->key);
    size_t val_len = strlen(e->value);
    if (pos + 2 + key_len + val_len > 1000) break;
    buffer[pos++] = (uint8_t)key_len;
    buffer[pos++] = (uint8_t)val_len;
    memcpy(buffer + pos, e->key, key_len);
    pos += key_len;
    memcpy(buffer + pos, e->value, val_len);
    pos += val_len;
  }

  return pos;
}

void tree_sitter_abc_external_scanner_deserialize(
  void *payload,
  const char *buffer,
  unsigned length
) {
  ScanCtx *ctx = (ScanCtx *)payload;
  if (length < 6) return;

  unsigned pos = 0;
  ctx->in_text_block = buffer[pos++];
  ctx->in_tune_body = buffer[pos++];
  ctx->line = ((unsigned char)buffer[pos] << 8) | (unsigned char)buffer[pos + 1];
  pos += 2;

  // Clear and rebuild macros
  stringmap_clear(ctx->macros);
  if (pos < length) {
    uint8_t macro_count = (uint8_t)buffer[pos++];
    for (uint8_t i = 0; i < macro_count && pos + 2 <= length; i++) {
      uint8_t key_len = (uint8_t)buffer[pos++];
      uint8_t val_len = (uint8_t)buffer[pos++];
      if (pos + key_len + val_len > length) break;

      char *key = malloc(key_len + 1);
      char *val = malloc(val_len + 1);
      if (key && val) {
        memcpy(key, buffer + pos, key_len);
        key[key_len] = '\0';
        memcpy(val, buffer + pos + key_len, val_len);
        val[val_len] = '\0';
        stringmap_set(ctx->macros, key, val);
      }
      pos += key_len + val_len;
      free(key);
      free(val);
    }
  }

  // Clear and rebuild user symbols
  stringmap_clear(ctx->user_symbols);
  if (pos < length) {
    uint8_t user_symbol_count = (uint8_t)buffer[pos++];
    for (uint8_t i = 0; i < user_symbol_count && pos + 2 <= length; i++) {
      uint8_t key_len = (uint8_t)buffer[pos++];
      uint8_t val_len = (uint8_t)buffer[pos++];
      if (pos + key_len + val_len > length) break;

      char *key = malloc(key_len + 1);
      char *val = malloc(val_len + 1);
      if (key && val) {
        memcpy(key, buffer + pos, key_len);
        key[key_len] = '\0';
        memcpy(val, buffer + pos + key_len, val_len);
        val[val_len] = '\0';
        stringmap_set(ctx->user_symbols, key, val);
      }
      pos += key_len + val_len;
      free(key);
      free(val);
    }
  }
}

/**
 * Main scan function - called by TreeSitter for each token.
 *
 * This function tries each sub-scanner in order of precedence,
 * mirroring the TypeScript scanner's while loop.
 */
bool tree_sitter_abc_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  ScanCtx *ctx = (ScanCtx *)payload;
  ctx->lexer = lexer;

  // Check if at EOF
  if (at_eof(lexer)) {
    if (valid_symbols[TT_EOF]) {
      lexer->result_symbol = TT_EOF;
      return true;
    }
    return false;
  }

  // Try each scanner in order of precedence

  // Stylesheet directive (must come before comment)
  if (valid_symbols[TT_STYLESHEET_DIRECTIVE] && scan_directive(ctx)) return true;

  // Comment
  if (valid_symbols[TT_COMMENT] && scan_comment(ctx)) return true;

  // Section break (must come before EOL)
  if (valid_symbols[TT_SCT_BRK] && scan_section_break(ctx)) return true;

  // Line continuation
  if (valid_symbols[TT_LINE_CONT] && scan_line_continuation(ctx)) return true;

  // Info line header
  if (valid_symbols[TT_INF_HDR] && scan_info_line(ctx)) return true;

  // Annotation
  if (valid_symbols[TT_ANNOTATION] && scan_annotation(ctx)) return true;

  // Inline field bracket
  if (valid_symbols[TT_INLN_FLD_LFT_BRKT] && scan_inline_field_bracket(ctx)) return true;

  // Tuplet (before slur)
  if (valid_symbols[TT_TUPLET_LPAREN] && scan_tuplet(ctx)) return true;

  // Slur
  if (valid_symbols[TT_SLUR] && scan_slur(ctx)) return true;

  // Grace group brackets
  if (valid_symbols[TT_GRC_GRP_LEFT_BRACE] && scan_grace_group_bracket(ctx)) return true;

  // Chord brackets
  if (valid_symbols[TT_CHRD_LEFT_BRKT] && scan_chord_bracket(ctx)) return true;

  // Barline (complex patterns)
  if (valid_symbols[TT_BARLINE] && scan_barline(ctx)) return true;

  // Decoration (must come before pitch to check lookahead)
  if (valid_symbols[TT_DECORATION] && scan_decoration(ctx)) return true;

  // Pitch components
  if (valid_symbols[TT_ACCIDENTAL] || valid_symbols[TT_NOTE_LETTER]) {
    if (scan_pitch(ctx)) return true;
  }

  // Octave
  if (valid_symbols[TT_OCTAVE] && scan_octave(ctx)) return true;

  // Rhythm components
  if (valid_symbols[TT_RHY_NUMER] || valid_symbols[TT_RHY_SEP] || valid_symbols[TT_RHY_BRKN]) {
    if (scan_rhythm(ctx)) return true;
  }

  // Rest
  if (valid_symbols[TT_REST] && scan_rest(ctx)) return true;

  // Tie
  if (valid_symbols[TT_TIE] && scan_tie(ctx)) return true;

  // Repeat number components
  if (valid_symbols[TT_REPEAT_NUMBER] || valid_symbols[TT_REPEAT_COMMA] ||
      valid_symbols[TT_REPEAT_DASH] || valid_symbols[TT_REPEAT_X]) {
    if (scan_repeat_number(ctx)) return true;
  }

  // Spacers
  if (valid_symbols[TT_Y_SPC] && scan_y_spacer(ctx)) return true;
  if (valid_symbols[TT_BCKTCK_SPC] && scan_bcktck_spacer(ctx)) return true;

  // System break
  if (valid_symbols[TT_SYSTEM_BREAK] && scan_system_break(ctx)) return true;

  // Symbol
  if (valid_symbols[TT_SYMBOL] && scan_symbol(ctx)) return true;

  // Ampersand (voice overlay)
  if (valid_symbols[TT_VOICE] && scan_ampersand(ctx)) return true;

  // Identifier
  if (valid_symbols[TT_IDENTIFIER] && scan_identifier(ctx)) return true;

  // Number
  if (valid_symbols[TT_NUMBER] && scan_number(ctx)) return true;

  // Whitespace
  if (valid_symbols[TT_WS] && scan_ws(ctx)) return true;

  // EOL
  if (valid_symbols[TT_EOL] && scan_eol(ctx)) return true;

  // Error recovery
  if (valid_symbols[TT_INVALID] && collect_invalid_token(ctx)) return true;

  return false;
}
