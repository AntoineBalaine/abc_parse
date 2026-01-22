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
 * Scan end of line: \r?\n
 */
static bool scan_eol(TSLexer *lexer, ScannerState *state) {
  if (PEEK == '\r') {
    ADVANCE();
  }
  if (PEEK == '\n') {
    ADVANCE();
    MARK_END();
    state->line_number++;
    EMIT(TT_EOL);
  }
  return false;
}

/**
 * Scan comment: %...\n (but not %%)
 */
static bool scan_comment(TSLexer *lexer) {
  if (PEEK != '%') return false;

  ADVANCE();
  // Check for %% (directive, not comment)
  if (PEEK == '%') {
    // This is a directive, not a comment - let grammar handle it
    return false;
  }

  // Consume until end of line
  while (!EOF_REACHED && PEEK != '\n' && PEEK != '\r') {
    ADVANCE();
  }
  MARK_END();
  EMIT(TT_COMMENT);
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
 */
static bool scan_info_header(TSLexer *lexer) {
  if (!is_alpha(PEEK)) return false;

  // Need to peek ahead to check for colon
  // Since we can't backtrack, we commit once we see alpha
  int32_t first = PEEK;
  ADVANCE();

  // Skip optional whitespace before colon
  while (is_ws_char(PEEK)) {
    ADVANCE();
  }

  if (PEEK == ':') {
    ADVANCE();
    MARK_END();
    EMIT(TT_INF_HDR);
  }

  // Not an info header - we've consumed characters but that's OK
  // The grammar will handle partial matches
  return false;
}

/**
 * Scan ampersand (voice overlay): &
 */
static bool scan_ampersand(TSLexer *lexer) {
  if (PEEK != '&') return false;

  ADVANCE();
  MARK_END();
  EMIT(TT_AMPERSAND);
}

/**
 * Scan section break: blank line (handled at EOL level)
 */
static bool scan_section_break(TSLexer *lexer, ScannerState *state) {
  // Section break is typically an empty line
  // This is context-dependent and may need grammar support
  (void)state;
  return false;
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

  // Skip leading whitespace if not looking for WS token
  // (Actually, let's not skip - ABC whitespace can be significant)

  // Check for EOF
  if (EOF_REACHED) {
    if (valid_symbols[TT_EOF]) {
      EMIT(TT_EOF);
    }
    return false;
  }

  // Try each token type in priority order
  // Order matters for ambiguous cases

  // Comments first (% but not %%)
  if (valid_symbols[TT_COMMENT] && scan_comment(lexer)) return true;

  // End of line
  if (valid_symbols[TT_EOL] && scan_eol(lexer, state)) return true;

  // Whitespace
  if (valid_symbols[TT_WS] && scan_whitespace(lexer)) return true;

  // Annotation "..."
  if (valid_symbols[TT_ANNOTATION] && scan_annotation(lexer)) return true;

  // Symbol !...! or +...+
  if (valid_symbols[TT_SYMBOL] && scan_symbol(lexer)) return true;

  // Barlines (check before chord brackets due to [| )
  if (valid_symbols[TT_BARLINE] && scan_barline(lexer)) return true;

  // Accidentals
  if (valid_symbols[TT_ACCIDENTAL] && scan_accidental(lexer)) return true;

  // Note letters
  if (valid_symbols[TT_NOTE_LETTER] && scan_note_letter(lexer)) return true;

  // Octave modifiers
  if (valid_symbols[TT_OCTAVE] && scan_octave(lexer)) return true;

  // Rests
  if (valid_symbols[TT_REST] && scan_rest(lexer)) return true;

  // Tie
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

  // Chord brackets
  if (valid_symbols[TT_CHRD_LEFT_BRKT] && PEEK == '[') {
    if (scan_chord_bracket(lexer)) return true;
  }
  if (valid_symbols[TT_CHRD_RIGHT_BRKT] && PEEK == ']') {
    if (scan_chord_bracket(lexer)) return true;
  }

  // Rhythm elements
  if (valid_symbols[TT_RHY_NUMER] && scan_number(lexer)) return true;
  if (valid_symbols[TT_RHY_SEP] && scan_rhythm_sep(lexer)) return true;
  if (valid_symbols[TT_RHY_BRKN] && scan_broken_rhythm(lexer)) return true;

  // Info header
  if (valid_symbols[TT_INF_HDR] && scan_info_header(lexer)) return true;

  // Ampersand
  if (valid_symbols[TT_AMPERSAND] && scan_ampersand(lexer)) return true;

  // No token matched
  return false;
}
