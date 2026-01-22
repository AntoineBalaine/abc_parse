/**
 * TreeSitter external scanner for ABC music notation
 *
 * This scanner uses TreeSitter's lexer API directly:
 * - lexer->lookahead: peek at current character (does NOT advance)
 * - lexer->advance(lexer, false): consume character into token
 * - lexer->advance(lexer, true): skip character (whitespace)
 * - lexer->mark_end(lexer): mark current position as token end
 * - lexer->result_symbol: set to token type before returning true
 *
 * NO BACKTRACKING: Once you advance, you cannot go back.
 * Design all matching to work left-to-right without lookahead.
 */

#include "scanner.h"
#include <stdio.h>

// ============================================================================
// TreeSitter External Scanner API Implementation
// ============================================================================

/**
 * Called once when parser is created.
 * Allocate scanner state.
 */
void *tree_sitter_abc_external_scanner_create(void) {
  ScannerState *state = calloc(1, sizeof(ScannerState));
  state->in_tune_body = false;
  state->in_text_block = false;
  state->line_number = 1;
  return state;
}

/**
 * Called when parser is destroyed.
 * Free scanner state.
 */
void tree_sitter_abc_external_scanner_destroy(void *payload) {
  free(payload);
}

/**
 * Serialize scanner state for incremental parsing.
 * Returns number of bytes written.
 */
unsigned tree_sitter_abc_external_scanner_serialize(
  void *payload,
  char *buffer
) {
  ScannerState *state = (ScannerState *)payload;
  buffer[0] = state->in_tune_body ? 1 : 0;
  buffer[1] = state->in_text_block ? 1 : 0;
  buffer[2] = (state->line_number >> 8) & 0xFF;
  buffer[3] = state->line_number & 0xFF;
  return 4;
}

/**
 * Deserialize scanner state.
 */
void tree_sitter_abc_external_scanner_deserialize(
  void *payload,
  const char *buffer,
  unsigned length
) {
  ScannerState *state = (ScannerState *)payload;
  if (length >= 4) {
    state->in_tune_body = buffer[0] != 0;
    state->in_text_block = buffer[1] != 0;
    state->line_number = ((uint16_t)(unsigned char)buffer[2] << 8) |
                         (uint16_t)(unsigned char)buffer[3];
  }
}

// ============================================================================
// Lexer Helper Macros
// ============================================================================

#define PEEK (lexer->lookahead)

// Undefine parser.h's versions (which take a state_value parameter)
// before defining our simpler parameterless versions for the external scanner
#undef ADVANCE
#undef SKIP
#define ADVANCE() lexer->advance(lexer, false)
#define SKIP() lexer->advance(lexer, true)
#define MARK_END() lexer->mark_end(lexer)
#define EOF_REACHED (lexer->eof(lexer))
#define EMIT(type) do { lexer->result_symbol = (type); return true; } while(0)

// ============================================================================
// Token Scanning Functions
// ============================================================================

/**
 * Scan whitespace: [ \t]+
 */
static bool scan_whitespace(TSLexer *lexer) {
  if (!is_ws_char(PEEK)) return false;

  while (is_ws_char(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_WS);
}

/**
 * Scan percent-prefixed tokens: comments (%) and directives (%%)
 *
 * Because TreeSitter doesn't support backtracking, we handle both token types
 * in one function. After consuming the first %, we check the second character
 * to determine which token type to emit.
 *
 * @param lexer The TreeSitter lexer
 * @param valid_symbols Array indicating which tokens are valid in current state
 * @return true if a token was emitted, false otherwise
 */
static bool scan_percent_token(TSLexer *lexer, const bool *valid_symbols) {
  if (PEEK != '%') return false;

  ADVANCE();  // Consume first %

  if (PEEK == '%') {
    // It's a directive: %%directive_name [args]
    ADVANCE();  // Consume second %

    // Consume directive content until end of line
    while (!EOF_REACHED && PEEK != '\n' && PEEK != '\r') {
      ADVANCE();
    }
    MARK_END();

    if (valid_symbols[TT_STYLESHEET_DIRECTIVE]) {
      EMIT(TT_STYLESHEET_DIRECTIVE);
    }
    // If directive not valid here, we still consumed it - return false
    // TreeSitter will report an error
    return false;
  }

  // It's a comment: %comment text
  while (!EOF_REACHED && PEEK != '\n' && PEEK != '\r') {
    ADVANCE();
  }
  MARK_END();

  if (valid_symbols[TT_COMMENT]) {
    EMIT(TT_COMMENT);
  }
  return false;
}

/**
 * Scan note letter: [a-gA-G]
 */
static bool scan_note_letter(TSLexer *lexer) {
  if (!is_note_letter(PEEK)) return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_NOTE_LETTER);
}

/**
 * Scan accidental: ^ ^^ ^/ _ __ _/ =
 */
static bool scan_accidental(TSLexer *lexer) {
  if (PEEK == '^') {
    ADVANCE();
    if (PEEK == '^' || PEEK == '/') {
      ADVANCE();
    }
    MARK_END();
    EMIT(TT_ACCIDENTAL);
  }

  if (PEEK == '_') {
    ADVANCE();
    if (PEEK == '_' || PEEK == '/') {
      ADVANCE();
    }
    MARK_END();
    EMIT(TT_ACCIDENTAL);
  }

  if (PEEK == '=') {
    ADVANCE();
    MARK_END();
    EMIT(TT_ACCIDENTAL);
  }

  return false;
}

/**
 * Scan octave modifiers: [',]+
 */
static bool scan_octave(TSLexer *lexer) {
  if (!is_octave_char(PEEK)) return false;

  while (is_octave_char(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_OCTAVE);
}

/**
 * Scan rest: [zZxX]
 */
static bool scan_rest(TSLexer *lexer) {
  if (!is_rest_char(PEEK)) return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_REST);
}

/**
 * Scan tie: -
 */
static bool scan_tie(TSLexer *lexer) {
  if (PEEK != '-') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_TIE);
}

/**
 * Scan decoration characters: [.~HLMOPRSTuv]+
 */
static bool scan_decoration(TSLexer *lexer) {
  if (!is_decoration_char(PEEK)) return false;

  while (is_decoration_char(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_DECORATION);
}

/**
 * Scan slur: ( or )
 */
static bool scan_slur(TSLexer *lexer) {
  if (PEEK == '(' || PEEK == ')') {
    ADVANCE();
    MARK_END();
    EMIT(TT_SLUR);
  }
  return false;
}

/**
 * Scan number (rhythm numerator): [0-9]+
 */
static bool scan_number(TSLexer *lexer) {
  if (!is_digit(PEEK)) return false;

  while (is_digit(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_RHY_NUMER);
}

/**
 * Scan rhythm separator: /
 */
static bool scan_rhythm_sep(TSLexer *lexer) {
  if (PEEK != '/') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_RHY_SEP);
}

/**
 * Scan broken rhythm: [<>]+
 */
static bool scan_broken_rhythm(TSLexer *lexer) {
  if (!is_broken_rhythm_char(PEEK)) return false;

  while (is_broken_rhythm_char(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_RHY_BRKN);
}

/**
 * Scan barline: | || |] [| :| |: :: etc.
 */
static bool scan_barline(TSLexer *lexer) {
  if (PEEK == '|') {
    ADVANCE();
    // Check for ||, |], |:, |1, |2, etc.
    if (PEEK == '|' || PEEK == ']' || PEEK == ':') {
      ADVANCE();
    } else if (is_digit(PEEK)) {
      // |1, |2 - repeat ending
      ADVANCE();
      MARK_END();
      EMIT(TT_BARLINE);
    }
    MARK_END();
    EMIT(TT_BARLINE);
  }

  if (PEEK == ':') {
    ADVANCE();
    if (PEEK == '|' || PEEK == ':') {
      ADVANCE();
      // :| or ::
      if (PEEK == '|') {
        ADVANCE();  // ::|
      }
      MARK_END();
      EMIT(TT_BARLINE);
    }
    // Just : alone is not a barline
    return false;
  }

  if (PEEK == '[') {
    ADVANCE();
    if (PEEK == '|') {
      ADVANCE();
      // [| or [|:
      if (PEEK == ':') {
        ADVANCE();
      }
      MARK_END();
      EMIT(TT_BARLINE);
    }
    // Check for [1, [2 (repeat endings)
    if (is_digit(PEEK)) {
      ADVANCE();
      MARK_END();
      EMIT(TT_BARLINE);
    }
    // Just [ alone - might be chord bracket
    return false;
  }

  return false;
}

/**
 * Scan chord brackets: [ and ]
 */
static bool scan_chord_bracket(TSLexer *lexer) {
  if (PEEK == '[') {
    ADVANCE();
    MARK_END();
    EMIT(TT_CHRD_LEFT_BRKT);
  }
  if (PEEK == ']') {
    ADVANCE();
    MARK_END();
    EMIT(TT_CHRD_RIGHT_BRKT);
  }
  return false;
}

/**
 * Scan grace group braces: { and }
 */
static bool scan_grace_brace(TSLexer *lexer) {
  if (PEEK == '{') {
    ADVANCE();
    MARK_END();
    EMIT(TT_GRC_GRP_LEFT_BRACE);
  }
  if (PEEK == '}') {
    ADVANCE();
    MARK_END();
    EMIT(TT_GRC_GRP_RGHT_BRACE);
  }
  return false;
}

/**
 * Scan annotation: "..."
 */
static bool scan_annotation(TSLexer *lexer) {
  if (PEEK != '"') return false;

  ADVANCE();  // consume opening "
  while (!EOF_REACHED && PEEK != '"' && PEEK != '\n') {
    if (PEEK == '\\') {
      ADVANCE();  // consume backslash
      if (!EOF_REACHED && PEEK != '\n') {
        ADVANCE();  // consume escaped char
      }
    } else {
      ADVANCE();
    }
  }
  if (PEEK == '"') {
    ADVANCE();  // consume closing "
  }
  MARK_END();
  EMIT(TT_ANNOTATION);
}

/**
 * Scan symbol: !...! or +...+
 */
static bool scan_symbol(TSLexer *lexer) {
  if (PEEK == '!') {
    ADVANCE();
    while (!EOF_REACHED && PEEK != '!' && PEEK != '\n') {
      ADVANCE();
    }
    if (PEEK == '!') {
      ADVANCE();
    }
    MARK_END();
    EMIT(TT_SYMBOL);
  }

  if (PEEK == '+') {
    ADVANCE();
    while (!EOF_REACHED && PEEK != '+' && PEEK != '\n') {
      ADVANCE();
    }
    if (PEEK == '+') {
      ADVANCE();
    }
    MARK_END();
    EMIT(TT_SYMBOL);
  }

  return false;
}

/**
 * Scan info line header: X:, T:, K:, etc.
 *
 * Info headers are a single letter immediately followed by a colon.
 * No whitespace is allowed between the letter and colon.
 *
 * IMPORTANT: This scanner should only be called in grammar positions where
 * an info header is expected (start of line in header/body context).
 * If called elsewhere and the pattern doesn't match, the consumed alpha
 * character will be lost. The grammar's valid_symbols mechanism should
 * prevent this.
 *
 * @param lexer The TreeSitter lexer
 * @param valid_symbols Array indicating which tokens are valid (for fallback)
 * @return true if an info header was emitted, false otherwise
 */
static bool scan_info_header(TSLexer *lexer, const bool *valid_symbols) {
  if (!is_alpha(PEEK)) return false;

  // Mark position before consuming anything
  MARK_END();

  ADVANCE();  // Consume alpha

  // Check for immediately following colon (no whitespace allowed)
  if (PEEK == ':') {
    ADVANCE();
    MARK_END();
    EMIT(TT_INF_HDR);
  }

  // Not an info header pattern (alpha not followed by colon)
  // We've consumed the alpha - try to emit as identifier as fallback
  MARK_END();
  if (valid_symbols[TT_IDENTIFIER]) {
    EMIT(TT_IDENTIFIER);
  }

  // If identifier not valid either, the character is lost
  // This indicates a grammar configuration issue
  return false;
}

/**
 * Scan ampersand: & for voice overlay or voice
 */
static bool scan_ampersand(TSLexer *lexer, const bool *valid_symbols) {
  if (PEEK != '&') return false;

  ADVANCE();
  MARK_END();

  // Check if followed by newline (voice overlay) or just voice
  if (valid_symbols[TT_VOICE_OVRLAY]) {
    EMIT(TT_VOICE_OVRLAY);
  }
  if (valid_symbols[TT_AMPERSAND]) {
    EMIT(TT_AMPERSAND);
  }
  return false;
}

/**
 * Scan system break: $
 */
static bool scan_system_break(TSLexer *lexer) {
  if (PEEK != '$') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_SYSTEM_BREAK);
}

/**
 * Scan y spacer: y followed by optional rhythm
 */
static bool scan_y_spacer(TSLexer *lexer) {
  if (PEEK != 'y') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_Y_SPC);
}

/**
 * Scan backtick spacer: `
 */
static bool scan_backtick_spacer(TSLexer *lexer) {
  if (PEEK != '`') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_BCKTCK_SPC);
}

/**
 * Scan line continuation: \ at end of line
 */
static bool scan_line_continuation(TSLexer *lexer) {
  if (PEEK != '\\') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_LINE_CONT);
}

/**
 * Scan general number: [0-9]+
 * Different from RHY_NUMER which is context-specific
 */
static bool scan_general_number(TSLexer *lexer) {
  if (!is_digit(PEEK)) return false;

  while (is_digit(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_NUMBER);
}

/**
 * Scan rhythm denominator: [0-9]+
 * Same as numerator but different token type
 */
static bool scan_rhythm_denom(TSLexer *lexer) {
  if (!is_digit(PEEK)) return false;

  while (is_digit(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_RHY_DENOM);
}

/**
 * Scan tuplet: (p:q:r format
 * This handles the opening paren that starts a tuplet
 */
static bool scan_tuplet_lparen(TSLexer *lexer) {
  if (PEEK != '(') return false;

  ADVANCE();
  // Check if followed by digit (indicates tuplet, not slur)
  if (is_digit(PEEK)) {
    MARK_END();
    EMIT(TT_TUPLET_LPAREN);
  }
  // Not a tuplet - might be slur; we've consumed ( already
  // This is a problem - need to handle this carefully
  MARK_END();
  return false;
}

/**
 * Scan tuplet colon separator
 */
static bool scan_tuplet_colon(TSLexer *lexer) {
  if (PEEK != ':') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_TUPLET_COLON);
}

/**
 * Scan inline field left bracket: [
 * This is [X: where X is a field letter
 */
static bool scan_inline_field_left(TSLexer *lexer) {
  if (PEEK != '[') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_INLN_FLD_LFT_BRKT);
}

/**
 * Scan inline field right bracket: ]
 */
static bool scan_inline_field_right(TSLexer *lexer) {
  if (PEEK != ']') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_INLN_FLD_RGT_BRKT);
}

/**
 * Scan grace group slash: / for acciaccatura
 */
static bool scan_grace_slash(TSLexer *lexer) {
  if (PEEK != '/') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_GRC_GRP_SLSH);
}

// ============================================================================
// Generic Punctuation Tokens (for directive/info line contexts)
// ============================================================================

static bool scan_equals(TSLexer *lexer) {
  if (PEEK != '=') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_EQL);
}

static bool scan_slash(TSLexer *lexer) {
  if (PEEK != '/') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_SLASH);
}

static bool scan_minus(TSLexer *lexer) {
  if (PEEK != '-') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_MINUS);
}

static bool scan_plus(TSLexer *lexer) {
  if (PEEK != '+') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_PLUS);
}

static bool scan_lparen(TSLexer *lexer) {
  if (PEEK != '(') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_LPAREN);
}

static bool scan_rparen(TSLexer *lexer) {
  if (PEEK != ')') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_RPAREN);
}

static bool scan_lbrace(TSLexer *lexer) {
  if (PEEK != '{') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_LBRACE);
}

static bool scan_rbrace(TSLexer *lexer) {
  if (PEEK != '}') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_RBRACE);
}

static bool scan_lbracket(TSLexer *lexer) {
  if (PEEK != '[') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_LBRACKET);
}

static bool scan_rbracket(TSLexer *lexer) {
  if (PEEK != ']') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_RBRACKET);
}

static bool scan_pipe(TSLexer *lexer) {
  if (PEEK != '|') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_PIPE);
}

/**
 * Scan identifier: [a-zA-Z_][a-zA-Z0-9_-]*
 */
static bool scan_identifier(TSLexer *lexer) {
  if (!is_identifier_start(PEEK)) return false;

  ADVANCE();
  while (is_identifier_char(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_IDENTIFIER);
}

/**
 * Scan info string: content of info line after header
 * Consumes until end of line
 */
static bool scan_info_string(TSLexer *lexer) {
  // Consume everything until end of line
  bool has_content = false;
  while (!EOF_REACHED && PEEK != '\n' && PEEK != '\r') {
    has_content = true;
    ADVANCE();
  }
  if (has_content) {
    MARK_END();
    EMIT(TT_INFO_STR);
  }
  return false;
}

/**
 * Scan escaped character: \X
 */
static bool scan_escaped_char(TSLexer *lexer) {
  if (PEEK != '\\') return false;

  ADVANCE();
  if (!EOF_REACHED && PEEK != '\n' && PEEK != '\r') {
    ADVANCE();  // Consume the escaped character
  }
  MARK_END();
  EMIT(TT_ESCAPED_CHAR);
}

/**
 * Scan chord symbol: "Cmaj7", "Am", etc. in quotes
 */
static bool scan_chord_symbol(TSLexer *lexer) {
  if (PEEK != '"') return false;

  ADVANCE();  // consume opening "
  while (!EOF_REACHED && PEEK != '"' && PEEK != '\n') {
    ADVANCE();
  }
  if (PEEK == '"') {
    ADVANCE();  // consume closing "
  }
  MARK_END();
  EMIT(TT_CHORD_SYMBOL);
}

/**
 * Scan lyric header: w: (lowercase) or W: (lyric section)
 */
static bool scan_lyric_header(TSLexer *lexer, const bool *valid_symbols) {
  if (PEEK != 'w' && PEEK != 'W') return false;

  bool is_section = (PEEK == 'W');
  ADVANCE();

  // Optional whitespace before colon
  while (PEEK == ' ' || PEEK == '\t') {
    ADVANCE();
  }

  if (PEEK == ':') {
    ADVANCE();
    MARK_END();
    if (is_section && valid_symbols[TT_LY_SECT_HDR]) {
      EMIT(TT_LY_SECT_HDR);
    }
    if (valid_symbols[TT_LY_HDR]) {
      EMIT(TT_LY_HDR);
    }
  }
  return false;
}

/**
 * Scan lyric tilde: ~ for space that aligns multiple words under one note
 */
static bool scan_lyric_tilde(TSLexer *lexer) {
  if (PEEK != '~') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_LY_SPS);
}

/**
 * Scan lyric text: syllable content
 */
static bool scan_lyric_text(TSLexer *lexer) {
  // Lyric text is any content until a delimiter
  // Delimiters: space, tab, -, _, *, ~, |, \, newline, %
  bool has_content = false;
  while (!EOF_REACHED) {
    int32_t c = PEEK;
    if (c == ' ' || c == '\t' || c == '-' || c == '_' ||
        c == '*' || c == '~' || c == '|' || c == '\\' ||
        c == '\n' || c == '\r' || c == '%') {
      break;
    }
    has_content = true;
    ADVANCE();
  }
  if (has_content) {
    MARK_END();
    EMIT(TT_LY_TXT);
  }
  return false;
}

/**
 * Scan lyric underscore: _ for held syllable
 */
static bool scan_lyric_underscore(TSLexer *lexer) {
  if (PEEK != '_') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_LY_UNDR);
}

/**
 * Scan lyric hyphen: - for syllable continuation
 */
static bool scan_lyric_hyphen(TSLexer *lexer) {
  if (PEEK != '-') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_LY_HYPH);
}

/**
 * Scan lyric star: * for skipped note
 */
static bool scan_lyric_star(TSLexer *lexer) {
  if (PEEK != '*') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_LY_STAR);
}

/**
 * Scan symbol line header: s:
 */
static bool scan_symbol_header(TSLexer *lexer) {
  if (PEEK != 's') return false;

  ADVANCE();

  // Optional whitespace before colon
  while (PEEK == ' ' || PEEK == '\t') {
    ADVANCE();
  }

  if (PEEK == ':') {
    ADVANCE();
    MARK_END();
    EMIT(TT_SY_HDR);
  }
  return false;
}

/**
 * Scan symbol line star: * alignment marker
 */
static bool scan_symbol_star(TSLexer *lexer) {
  if (PEEK != '*') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_SY_STAR);
}

/**
 * Scan symbol line text: content between alignment markers
 */
static bool scan_symbol_text(TSLexer *lexer) {
  bool has_content = false;
  while (!EOF_REACHED) {
    int32_t c = PEEK;
    // Stop at: space, tab, %, *, newline, or barline chars
    if (c == ' ' || c == '\t' || c == '%' || c == '*' ||
        c == '\n' || c == '\r' || c == '|') {
      break;
    }
    has_content = true;
    ADVANCE();
  }
  if (has_content) {
    MARK_END();
    EMIT(TT_SY_TXT);
  }
  return false;
}

/**
 * Scan tuplet p value: number after (
 */
static bool scan_tuplet_p(TSLexer *lexer) {
  if (!is_digit(PEEK)) return false;

  while (is_digit(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_TUPLET_P);
}

/**
 * Scan tuplet q value: number after first :
 */
static bool scan_tuplet_q(TSLexer *lexer) {
  if (!is_digit(PEEK)) return false;

  while (is_digit(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_TUPLET_Q);
}

/**
 * Scan tuplet r value: number after second :
 */
static bool scan_tuplet_r(TSLexer *lexer) {
  if (!is_digit(PEEK)) return false;

  while (is_digit(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_TUPLET_R);
}

/**
 * Scan repeat number: 1, 2, 3, etc. in repeat endings
 */
static bool scan_repeat_number(TSLexer *lexer) {
  // Skip optional leading whitespace
  while (PEEK == ' ' || PEEK == '\t') {
    ADVANCE();
  }

  if (!is_digit(PEEK)) return false;

  while (is_digit(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_REPEAT_NUMBER);
}

/**
 * Scan repeat comma: , separator in repeat numbers
 */
static bool scan_repeat_comma(TSLexer *lexer) {
  if (PEEK != ',') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_REPEAT_COMMA);
}

/**
 * Scan repeat dash: - for ranges like 1-3
 */
static bool scan_repeat_dash(TSLexer *lexer) {
  if (PEEK != '-') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_REPEAT_DASH);
}

/**
 * Scan repeat X: x notation like 1x2
 */
static bool scan_repeat_x(TSLexer *lexer) {
  if (PEEK != 'x' && PEEK != 'X') return false;
  ADVANCE();
  MARK_END();
  EMIT(TT_REPEAT_X);
}

/**
 * Scan info line continuation: +: at start of line
 */
static bool scan_info_continuation(TSLexer *lexer) {
  if (PEEK != '+') return false;

  ADVANCE();

  // Optional whitespace
  while (PEEK == ' ' || PEEK == '\t') {
    ADVANCE();
  }

  if (PEEK == ':') {
    ADVANCE();
    MARK_END();
    EMIT(TT_INF_CTND);
  }
  return false;
}

/**
 * Scan voice marker: & not followed by newline
 */
static bool scan_voice(TSLexer *lexer) {
  if (PEEK != '&') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_VOICE);
}

/**
 * Scan user symbol header: U:
 */
static bool scan_user_symbol_header(TSLexer *lexer) {
  if (PEEK != 'U') return false;

  ADVANCE();

  // Optional whitespace
  while (PEEK == ' ' || PEEK == '\t') {
    ADVANCE();
  }

  if (PEEK == ':') {
    ADVANCE();
    MARK_END();
    EMIT(TT_USER_SY_HDR);
  }
  return false;
}

/**
 * Scan user symbol variable: [h-wH-W~]
 */
static bool scan_user_symbol(TSLexer *lexer) {
  int32_t c = PEEK;
  if ((c >= 'h' && c <= 'w') || (c >= 'H' && c <= 'W') || c == '~') {
    ADVANCE();
    MARK_END();
    EMIT(TT_USER_SY);
  }
  return false;
}

/**
 * Scan user symbol invocation: single char that was declared
 * Note: In C scanner, we can't track declared symbols across parses,
 * so this is a simplified version that just matches the pattern
 */
static bool scan_user_symbol_invocation(TSLexer *lexer) {
  int32_t c = PEEK;
  if ((c >= 'h' && c <= 'w') || (c >= 'H' && c <= 'W') || c == '~') {
    ADVANCE();
    MARK_END();
    EMIT(TT_USER_SY_INVOCATION);
  }
  return false;
}

/**
 * Scan macro header: m:
 */
static bool scan_macro_header(TSLexer *lexer) {
  if (PEEK != 'm') return false;

  ADVANCE();

  // Optional whitespace
  while (PEEK == ' ' || PEEK == '\t') {
    ADVANCE();
  }

  if (PEEK == ':') {
    ADVANCE();
    MARK_END();
    EMIT(TT_MACRO_HDR);
  }
  return false;
}

/**
 * Scan macro variable: [a-xzA-XZ~][a-xzA-XZ0-9~]*
 * Note: 'y' is reserved for y-spacer
 */
static bool scan_macro_var(TSLexer *lexer) {
  int32_t c = PEEK;
  // First char: a-x, z, A-X, Z, or ~
  bool valid_start = (c >= 'a' && c <= 'x') || c == 'z' ||
                     (c >= 'A' && c <= 'X') || c == 'Z' || c == '~';
  if (!valid_start) return false;

  ADVANCE();

  // Subsequent chars
  while (!EOF_REACHED) {
    c = PEEK;
    bool valid = (c >= 'a' && c <= 'x') || c == 'z' ||
                 (c >= 'A' && c <= 'X') || c == 'Z' ||
                 (c >= '0' && c <= '9') || c == '~';
    if (!valid) break;
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_MACRO_VAR);
}

/**
 * Scan macro string: content of macro declaration
 */
static bool scan_macro_string(TSLexer *lexer) {
  bool has_content = false;
  while (!EOF_REACHED && PEEK != '\n' && PEEK != '\r' && PEEK != '%') {
    has_content = true;
    ADVANCE();
  }
  if (has_content) {
    MARK_END();
    EMIT(TT_MACRO_STR);
  }
  return false;
}

/**
 * Scan macro invocation: matches declared macro variables
 * Simplified version - in practice, grammar context determines this
 */
static bool scan_macro_invocation(TSLexer *lexer) {
  int32_t c = PEEK;
  bool valid_start = (c >= 'a' && c <= 'x') || c == 'z' ||
                     (c >= 'A' && c <= 'X') || c == 'Z' || c == '~';
  if (!valid_start) return false;

  ADVANCE();

  while (!EOF_REACHED) {
    c = PEEK;
    bool valid = (c >= 'a' && c <= 'x') || c == 'z' ||
                 (c >= 'A' && c <= 'X') || c == 'Z' ||
                 (c >= '0' && c <= '9') || c == '~';
    if (!valid) break;
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_MACRO_INVOCATION);
}

/**
 * Scan special literal: C (common time) or C| (cut time)
 */
static bool scan_special_literal(TSLexer *lexer) {
  if (PEEK != 'C') return false;

  ADVANCE();

  // Check for C| (cut time)
  if (PEEK == '|') {
    ADVANCE();
  }

  // Must be followed by whitespace, newline, %, or end
  int32_t c = PEEK;
  if (c == ' ' || c == '\t' || c == '\n' || c == '\r' ||
      c == '%' || c == ']' || EOF_REACHED) {
    MARK_END();
    EMIT(TT_SPECIAL_LITERAL);
  }
  return false;
}

/**
 * Scan measurement unit: in, cm, pt, etc.
 * Must immediately follow a number (no space)
 */
static bool scan_measurement_unit(TSLexer *lexer) {
  if (!is_alpha(PEEK)) return false;

  while (is_alpha(PEEK)) {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_MEASUREMENT_UNIT);
}

/**
 * Scan reserved character: characters reserved for future use
 * In ABC: # $ * ; ? @
 */
static bool scan_reserved_char(TSLexer *lexer) {
  int32_t c = PEEK;
  if (c == '#' || c == ';' || c == '?' || c == '@') {
    ADVANCE();
    MARK_END();
    EMIT(TT_RESERVED_CHAR);
  }
  return false;
}

/**
 * Scan section break (blank line) or EOL (single newline).
 *
 * Because TreeSitter cannot backtrack, this function handles both token types:
 * - If a double newline is found and TT_SCT_BRK is valid, emits SCT_BRK.
 * - Otherwise, if TT_EOL is valid, emits EOL for the single newline.
 * This prevents the no-backtrack issue where consuming the first \n for a
 * failed section break check would permanently lose the EOL token.
 */
static bool scan_section_break(TSLexer *lexer, ScannerState *state, const bool *valid_symbols) {
  if (PEEK != '\n' && PEEK != '\r') return false;

  // Consume first newline (\r?\n)
  if (PEEK == '\r') ADVANCE();
  if (PEEK != '\n') return false;  // bare \r without \n: no token
  ADVANCE();
  state->line_number++;
  MARK_END();  // mark position after first newline (token boundary for EOL)

  // Only attempt section break detection if SCT_BRK is valid
  if (valid_symbols[TT_SCT_BRK]) {
    if (PEEK == '\r') ADVANCE();  // lookahead past optional \r
    if (PEEK == '\n') {
      ADVANCE();
      state->line_number++;
      MARK_END();  // extend token to include second newline
      EMIT(TT_SCT_BRK);
    }
  }

  // Fallback: emit EOL if valid (MARK_END is still at first newline's end)
  if (valid_symbols[TT_EOL]) {
    EMIT(TT_EOL);
  }

  return false;  // unreachable in production (see grammar structure guarantee)
}

/**
 * Scan free text: any text not matching other patterns
 */
static bool scan_free_text(TSLexer *lexer) {
  bool has_content = false;
  while (!EOF_REACHED && PEEK != '\n' && PEEK != '\r') {
    has_content = true;
    ADVANCE();
  }
  if (has_content) {
    MARK_END();
    EMIT(TT_FREE_TXT);
  }
  return false;
}

/**
 * Scan invalid/unrecognized character
 */
static bool scan_invalid(TSLexer *lexer) {
  if (EOF_REACHED) return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_INVALID);
}

// ============================================================================
// Main Scanner Function
// ============================================================================

/**
 * Main scan function - called by TreeSitter to get next token.
 *
 * @param payload Scanner state
 * @param lexer TreeSitter lexer
 * @param valid_symbols Array of which tokens are valid in current state
 * @return true if a token was matched, false otherwise
 */
bool tree_sitter_abc_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  ScannerState *state = (ScannerState *)payload;

  // Check for EOF
  if (EOF_REACHED) {
    if (valid_symbols[TT_EOF]) {
      EMIT(TT_EOF);
    }
    return false;
  }

  // Try each token type in priority order
  // Order matters for ambiguous cases

  // Newline handling: section break (blank line) or EOL (single newline)
  if ((valid_symbols[TT_SCT_BRK] || valid_symbols[TT_EOL]) &&
      scan_section_break(lexer, state, valid_symbols)) return true;

  // Percent-prefixed tokens (comments % and directives %%)
  // Must handle both in one function to avoid consuming % then failing
  if ((valid_symbols[TT_COMMENT] || valid_symbols[TT_STYLESHEET_DIRECTIVE]) &&
      scan_percent_token(lexer, valid_symbols)) return true;

  // Whitespace
  if (valid_symbols[TT_WS] && scan_whitespace(lexer)) return true;

  // Line continuation (\ at end of line)
  if (valid_symbols[TT_LINE_CONT] && scan_line_continuation(lexer)) return true;

  // Escaped character (\X)
  if (valid_symbols[TT_ESCAPED_CHAR] && scan_escaped_char(lexer)) return true;

  // Chord symbol or annotation "..." - chord symbol takes precedence if valid
  if (valid_symbols[TT_CHORD_SYMBOL] && PEEK == '"') {
    if (scan_chord_symbol(lexer)) return true;
  }
  if (valid_symbols[TT_ANNOTATION] && scan_annotation(lexer)) return true;

  // Symbol !...! or +...+
  if (valid_symbols[TT_SYMBOL] && scan_symbol(lexer)) return true;

  // System break $
  if (valid_symbols[TT_SYSTEM_BREAK] && scan_system_break(lexer)) return true;

  // Backtick spacer `
  if (valid_symbols[TT_BCKTCK_SPC] && scan_backtick_spacer(lexer)) return true;

  // Barlines (check before chord brackets due to [| )
  if (valid_symbols[TT_BARLINE] && scan_barline(lexer)) return true;

  // Tuplet lparen - check before slur since both use (
  if (valid_symbols[TT_TUPLET_LPAREN] && scan_tuplet_lparen(lexer)) return true;

  // Tuplet colon
  if (valid_symbols[TT_TUPLET_COLON] && scan_tuplet_colon(lexer)) return true;

  // Accidentals
  if (valid_symbols[TT_ACCIDENTAL] && scan_accidental(lexer)) return true;

  // Y spacer - must check before note letters since y is also used
  if (valid_symbols[TT_Y_SPC] && scan_y_spacer(lexer)) return true;

  // Note letters
  if (valid_symbols[TT_NOTE_LETTER] && scan_note_letter(lexer)) return true;

  // Octave modifiers
  if (valid_symbols[TT_OCTAVE] && scan_octave(lexer)) return true;

  // Rests
  if (valid_symbols[TT_REST] && scan_rest(lexer)) return true;

  // Tie (in music context)
  if (valid_symbols[TT_TIE] && scan_tie(lexer)) return true;

  // Decorations
  if (valid_symbols[TT_DECORATION] && scan_decoration(lexer)) return true;

  // Slurs
  if (valid_symbols[TT_SLUR] && scan_slur(lexer)) return true;

  // Grace group braces
  if (valid_symbols[TT_GRC_GRP_LEFT_BRACE] && PEEK == '{') {
    if (scan_grace_brace(lexer)) return true;
  }
  if (valid_symbols[TT_GRC_GRP_RGHT_BRACE] && PEEK == '}') {
    if (scan_grace_brace(lexer)) return true;
  }

  // Grace group slash (acciaccatura)
  if (valid_symbols[TT_GRC_GRP_SLSH] && scan_grace_slash(lexer)) return true;

  // Inline field brackets
  if (valid_symbols[TT_INLN_FLD_LFT_BRKT] && PEEK == '[') {
    if (scan_inline_field_left(lexer)) return true;
  }
  if (valid_symbols[TT_INLN_FLD_RGT_BRKT] && PEEK == ']') {
    if (scan_inline_field_right(lexer)) return true;
  }

  // Chord brackets
  if (valid_symbols[TT_CHRD_LEFT_BRKT] && PEEK == '[') {
    if (scan_chord_bracket(lexer)) return true;
  }
  if (valid_symbols[TT_CHRD_RIGHT_BRKT] && PEEK == ']') {
    if (scan_chord_bracket(lexer)) return true;
  }

  // Rhythm elements
  if (valid_symbols[TT_RHY_NUMER] && is_digit(PEEK)) {
    if (scan_number(lexer)) return true;
  }
  if (valid_symbols[TT_RHY_DENOM] && scan_rhythm_denom(lexer)) return true;
  if (valid_symbols[TT_RHY_SEP] && scan_rhythm_sep(lexer)) return true;
  if (valid_symbols[TT_RHY_BRKN] && scan_broken_rhythm(lexer)) return true;

  // Lyric tokens
  if ((valid_symbols[TT_LY_HDR] || valid_symbols[TT_LY_SECT_HDR]) &&
      scan_lyric_header(lexer, valid_symbols)) return true;
  if (valid_symbols[TT_LY_UNDR] && scan_lyric_underscore(lexer)) return true;
  if (valid_symbols[TT_LY_HYPH] && scan_lyric_hyphen(lexer)) return true;
  if (valid_symbols[TT_LY_STAR] && scan_lyric_star(lexer)) return true;
  if (valid_symbols[TT_LY_SPS] && scan_lyric_tilde(lexer)) return true;
  if (valid_symbols[TT_LY_TXT] && scan_lyric_text(lexer)) return true;

  // Symbol line tokens
  if (valid_symbols[TT_SY_HDR] && scan_symbol_header(lexer)) return true;
  if (valid_symbols[TT_SY_STAR] && scan_symbol_star(lexer)) return true;
  if (valid_symbols[TT_SY_TXT] && scan_symbol_text(lexer)) return true;

  // Tuplet value tokens (p, q, r)
  if (valid_symbols[TT_TUPLET_P] && scan_tuplet_p(lexer)) return true;
  if (valid_symbols[TT_TUPLET_Q] && scan_tuplet_q(lexer)) return true;
  if (valid_symbols[TT_TUPLET_R] && scan_tuplet_r(lexer)) return true;

  // Repeat number tokens
  if (valid_symbols[TT_REPEAT_NUMBER] && scan_repeat_number(lexer)) return true;
  if (valid_symbols[TT_REPEAT_COMMA] && scan_repeat_comma(lexer)) return true;
  if (valid_symbols[TT_REPEAT_DASH] && scan_repeat_dash(lexer)) return true;
  if (valid_symbols[TT_REPEAT_X] && scan_repeat_x(lexer)) return true;

  // Info continuation (+:)
  if (valid_symbols[TT_INF_CTND] && scan_info_continuation(lexer)) return true;

  // User symbol tokens
  if (valid_symbols[TT_USER_SY_HDR] && scan_user_symbol_header(lexer)) return true;
  if (valid_symbols[TT_USER_SY] && scan_user_symbol(lexer)) return true;
  if (valid_symbols[TT_USER_SY_INVOCATION] && scan_user_symbol_invocation(lexer)) return true;

  // Macro tokens
  if (valid_symbols[TT_MACRO_HDR] && scan_macro_header(lexer)) return true;
  if (valid_symbols[TT_MACRO_VAR] && scan_macro_var(lexer)) return true;
  if (valid_symbols[TT_MACRO_STR] && scan_macro_string(lexer)) return true;
  if (valid_symbols[TT_MACRO_INVOCATION] && scan_macro_invocation(lexer)) return true;

  // Special literal (C, C|)
  if (valid_symbols[TT_SPECIAL_LITERAL] && scan_special_literal(lexer)) return true;

  // Info header (with fallback to identifier)
  if ((valid_symbols[TT_INF_HDR] || valid_symbols[TT_IDENTIFIER]) &&
      scan_info_header(lexer, valid_symbols)) return true;

  // Info string content
  if (valid_symbols[TT_INFO_STR] && scan_info_string(lexer)) return true;

  // Generic punctuation tokens (for directive/info line contexts)
  if (valid_symbols[TT_EQL] && scan_equals(lexer)) return true;
  if (valid_symbols[TT_SLASH] && scan_slash(lexer)) return true;
  if (valid_symbols[TT_MINUS] && scan_minus(lexer)) return true;
  if (valid_symbols[TT_PLUS] && scan_plus(lexer)) return true;
  if (valid_symbols[TT_LPAREN] && scan_lparen(lexer)) return true;
  if (valid_symbols[TT_RPAREN] && scan_rparen(lexer)) return true;
  if (valid_symbols[TT_LBRACE] && scan_lbrace(lexer)) return true;
  if (valid_symbols[TT_RBRACE] && scan_rbrace(lexer)) return true;
  if (valid_symbols[TT_LBRACKET] && scan_lbracket(lexer)) return true;
  if (valid_symbols[TT_RBRACKET] && scan_rbracket(lexer)) return true;
  if (valid_symbols[TT_PIPE] && scan_pipe(lexer)) return true;

  // General number (followed by optional measurement unit)
  if (valid_symbols[TT_NUMBER] && scan_general_number(lexer)) return true;

  // Measurement unit (must follow number)
  if (valid_symbols[TT_MEASUREMENT_UNIT] && scan_measurement_unit(lexer)) return true;

  // Voice marker (&)
  if (valid_symbols[TT_VOICE] && scan_voice(lexer)) return true;

  // Ampersand / voice overlay
  if ((valid_symbols[TT_AMPERSAND] || valid_symbols[TT_VOICE_OVRLAY]) &&
      scan_ampersand(lexer, valid_symbols)) return true;

  // Reserved characters
  if (valid_symbols[TT_RESERVED_CHAR] && scan_reserved_char(lexer)) return true;

  // Identifier (standalone)
  if (valid_symbols[TT_IDENTIFIER] && scan_identifier(lexer)) return true;

  // Free text (catch-all for line content)
  if (valid_symbols[TT_FREE_TXT] && scan_free_text(lexer)) return true;

  // Invalid character (error recovery)
  if (valid_symbols[TT_INVALID] && scan_invalid(lexer)) return true;

  // No token matched
  return false;
}
