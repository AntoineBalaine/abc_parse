#ifndef TEST_HARNESS_H
#define TEST_HARNESS_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdarg.h>

// Include TreeSitter header first to get the real TSLexer definition
#include <tree_sitter/parser.h>

// Include scanner.h for token types and ScannerState
#include "../src/scanner.h"

// ============================================================================
// Mock TSLexer State
// ============================================================================

typedef struct {
  const char* input;      // Input string
  size_t pos;             // Current position
  size_t length;          // Total length
  size_t mark_pos;        // Marked end position
  char consumed[1024];    // Buffer of consumed characters (for debugging)
  size_t consumed_len;    // Length of consumed buffer
} MockLexerState;

// Global state for the mock lexer (because TSLexer uses function pointers)
static MockLexerState g_mock_state;

// ============================================================================
// TSLexer Function Implementations
// ============================================================================

/**
 * Advance function: Consume current character and move to next.
 */
static void mock_advance(TSLexer* lexer, bool skip) {
  if (g_mock_state.pos < g_mock_state.length) {
    // Track consumed characters for debugging
    if (!skip && g_mock_state.consumed_len < sizeof(g_mock_state.consumed) - 1) {
      g_mock_state.consumed[g_mock_state.consumed_len++] = g_mock_state.input[g_mock_state.pos];
      g_mock_state.consumed[g_mock_state.consumed_len] = '\0';
    }
    g_mock_state.pos++;
  }
  // Update lookahead to next character (or 0 at EOF)
  lexer->lookahead = (g_mock_state.pos < g_mock_state.length)
    ? (int32_t)(unsigned char)g_mock_state.input[g_mock_state.pos]
    : 0;
}

/**
 * Mark end function: Mark current position as the end of the token.
 */
static void mock_mark_end(TSLexer* lexer) {
  (void)lexer;
  g_mock_state.mark_pos = g_mock_state.pos;
}

/**
 * EOF function: Check if at end of input.
 */
static bool mock_eof(const TSLexer* lexer) {
  (void)lexer;
  return g_mock_state.pos >= g_mock_state.length;
}

/**
 * Get column function: Return current column (simplified as position).
 */
static uint32_t mock_get_column(TSLexer* lexer) {
  (void)lexer;
  return (uint32_t)g_mock_state.pos;
}

// ============================================================================
// Test Harness API
// ============================================================================

/**
 * Initialize mock lexer with input string.
 * Returns a TSLexer struct ready for use with scan_* functions.
 */
static TSLexer create_test_lexer(const char* input) {
  // Reset global state
  g_mock_state.input = input;
  g_mock_state.pos = 0;
  g_mock_state.length = strlen(input);
  g_mock_state.mark_pos = 0;
  g_mock_state.consumed_len = 0;
  g_mock_state.consumed[0] = '\0';

  // Create lexer with mock function pointers
  TSLexer lexer;
  lexer.lookahead = (input[0] != '\0') ? (int32_t)(unsigned char)input[0] : 0;
  lexer.result_symbol = 0;
  lexer.advance = mock_advance;
  lexer.mark_end = mock_mark_end;
  lexer.eof = mock_eof;
  lexer.get_column = mock_get_column;
  return lexer;
}

/**
 * Create a ScannerState for testing functions that require it.
 */
static ScannerState create_test_state(void) {
  ScannerState state;
  memset(&state, 0, sizeof(state));
  state.line_number = 1;
  return state;
}

/**
 * Get the consumed text from the lexer (for verification).
 */
static const char* get_consumed_text(void) {
  return g_mock_state.consumed;
}

/**
 * Get current position in input.
 */
static size_t get_current_pos(void) {
  return g_mock_state.pos;
}

/**
 * Get marked end position.
 */
static size_t get_mark_pos(void) {
  return g_mock_state.mark_pos;
}

/**
 * Create a valid_symbols array with all symbols enabled.
 */
static void enable_all_symbols(bool* valid_symbols) {
  for (int i = 0; i < TT_COUNT; i++) {
    valid_symbols[i] = true;
  }
}

/**
 * Create a valid_symbols array with only specified symbols enabled.
 */
static void enable_symbols(bool* valid_symbols, int count, ...) {
  // First clear all
  for (int i = 0; i < TT_COUNT; i++) {
    valid_symbols[i] = false;
  }
  // Enable specified
  va_list args;
  va_start(args, count);
  for (int i = 0; i < count; i++) {
    int symbol = va_arg(args, int);
    valid_symbols[symbol] = true;
  }
  va_end(args);
}

// ============================================================================
// Test Result Macros
// ============================================================================

#define TEST_PASS() printf("PASS\n")
#define TEST_FAIL(msg) do { printf("FAIL: %s\n", msg); assert(0); } while(0)

#define ASSERT_TRUE(cond) do { \
  if (!(cond)) { \
    printf("FAIL: expected true but got false at line %d\n", __LINE__); \
    assert(0); \
  } \
} while(0)

#define ASSERT_FALSE(cond) do { \
  if (cond) { \
    printf("FAIL: expected false but got true at line %d\n", __LINE__); \
    assert(0); \
  } \
} while(0)

#define ASSERT_EQ(expected, actual) do { \
  if ((expected) != (actual)) { \
    printf("FAIL: expected %d but got %d at line %d\n", (int)(expected), (int)(actual), __LINE__); \
    assert(0); \
  } \
} while(0)

#define ASSERT_STR_EQ(expected, actual) do { \
  if (strcmp((expected), (actual)) != 0) { \
    printf("FAIL: expected \"%s\" but got \"%s\" at line %d\n", (expected), (actual), __LINE__); \
    assert(0); \
  } \
} while(0)

// ============================================================================
// Include scanner.c LAST to access static functions
// ============================================================================

#include "../src/scanner.c"

#endif // TEST_HARNESS_H
