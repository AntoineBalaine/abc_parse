#include "test_harness.h"

// ============================================================================
// scan_whitespace tests
// ============================================================================

void test_scan_whitespace_space() {
  printf("test_scan_whitespace_space... ");
  TSLexer lexer = create_test_lexer(" ");
  ASSERT_TRUE(scan_whitespace(&lexer));
  ASSERT_EQ(TT_WS, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_whitespace_tab() {
  printf("test_scan_whitespace_tab... ");
  TSLexer lexer = create_test_lexer("\t");
  ASSERT_TRUE(scan_whitespace(&lexer));
  ASSERT_EQ(TT_WS, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_whitespace_multiple() {
  printf("test_scan_whitespace_multiple... ");
  TSLexer lexer = create_test_lexer("   \t  ");
  ASSERT_TRUE(scan_whitespace(&lexer));
  ASSERT_EQ(TT_WS, lexer.result_symbol);
  ASSERT_EQ(6, get_current_pos());
  TEST_PASS();
}

void test_scan_whitespace_stops_at_non_ws() {
  printf("test_scan_whitespace_stops_at_non_ws... ");
  TSLexer lexer = create_test_lexer("  A");
  ASSERT_TRUE(scan_whitespace(&lexer));
  ASSERT_EQ(TT_WS, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_whitespace_invalid() {
  printf("test_scan_whitespace_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_whitespace(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_whitespace_newline_not_ws() {
  printf("test_scan_whitespace_newline_not_ws... ");
  TSLexer lexer = create_test_lexer("\n");
  ASSERT_FALSE(scan_whitespace(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_section_break tests (handles both SCT_BRK and EOL)
// ============================================================================

// --- Double newline (section break) tests ---

void test_scan_section_break_double_newline() {
  printf("test_scan_section_break_double_newline... ");
  TSLexer lexer = create_test_lexer("\n\n");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_SCT_BRK, lexer.result_symbol);
  ASSERT_EQ(3, state.line_number);
  TEST_PASS();
}

void test_scan_section_break_crlf_crlf() {
  printf("test_scan_section_break_crlf_crlf... ");
  TSLexer lexer = create_test_lexer("\r\n\r\n");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_SCT_BRK, lexer.result_symbol);
  ASSERT_EQ(3, state.line_number);
  TEST_PASS();
}

// --- Single newline (EOL fallback) tests ---

void test_scan_section_break_single_lf_emits_eol() {
  printf("test_scan_section_break_single_lf_emits_eol... ");
  TSLexer lexer = create_test_lexer("\n");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  TEST_PASS();
}

void test_scan_section_break_single_crlf_emits_eol() {
  printf("test_scan_section_break_single_crlf_emits_eol... ");
  TSLexer lexer = create_test_lexer("\r\n");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_section_break_single_newline_emits_eol() {
  printf("test_scan_section_break_single_newline_emits_eol... ");
  // With both SCT_BRK and EOL valid, a single newline emits EOL
  TSLexer lexer = create_test_lexer("\nA");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  TEST_PASS();
}

void test_scan_section_break_single_crlf_both_valid_emits_eol() {
  printf("test_scan_section_break_single_crlf_both_valid_emits_eol... ");
  TSLexer lexer = create_test_lexer("\r\nA");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  TEST_PASS();
}

void test_scan_section_break_lf_at_eof_emits_eol() {
  printf("test_scan_section_break_lf_at_eof_emits_eol... ");
  TSLexer lexer = create_test_lexer("\n");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  TEST_PASS();
}

// --- Double newline with only EOL valid (no SCT_BRK) ---

void test_scan_section_break_double_newline_only_eol_valid() {
  printf("test_scan_section_break_double_newline_only_eol_valid... ");
  // When SCT_BRK is not valid, only the first newline is consumed as EOL
  TSLexer lexer = create_test_lexer("\n\n");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  TEST_PASS();
}

// --- Edge cases ---

void test_scan_section_break_lf_cr_nonewline_emits_eol() {
  printf("test_scan_section_break_lf_cr_nonewline_emits_eol... ");
  // \n followed by \r then non-newline: SCT_BRK lookahead fails, emits EOL
  TSLexer lexer = create_test_lexer("\n\rA");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  valid[TT_EOL] = true;
  ASSERT_TRUE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  ASSERT_EQ(1, get_mark_pos());  // token boundary at first \n, not at \r
  TEST_PASS();
}

void test_scan_section_break_single_newline_no_eol_valid() {
  printf("test_scan_section_break_single_newline_no_eol_valid... ");
  // Only SCT_BRK valid, single newline: returns false (unreachable in production)
  TSLexer lexer = create_test_lexer("\nA");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  ASSERT_FALSE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(1, get_mark_pos());  // MARK_END was called after \n (cursor restarts here)
  TEST_PASS();
}

void test_scan_section_break_bare_cr() {
  printf("test_scan_section_break_bare_cr... ");
  // \r not followed by \n: returns false (no MARK_END, cursor resets)
  TSLexer lexer = create_test_lexer("\rA");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  valid[TT_EOL] = true;
  ASSERT_FALSE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(1, get_current_pos());  // \r consumed but no MARK_END
  ASSERT_EQ(1, state.line_number);  // line_number not incremented
  TEST_PASS();
}

void test_scan_section_break_not_newline() {
  printf("test_scan_section_break_not_newline... ");
  TSLexer lexer = create_test_lexer("A");
  ScannerState state = create_test_state();
  bool valid[TT_COUNT] = {0};
  valid[TT_SCT_BRK] = true;
  valid[TT_EOL] = true;
  ASSERT_FALSE(scan_section_break(&lexer, &state, valid));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Whitespace/EOL Scanner Tests ===\n\n");

  test_scan_whitespace_space();
  test_scan_whitespace_tab();
  test_scan_whitespace_multiple();
  test_scan_whitespace_stops_at_non_ws();
  test_scan_whitespace_invalid();
  test_scan_whitespace_newline_not_ws();

  // Section break (double newline)
  test_scan_section_break_double_newline();
  test_scan_section_break_crlf_crlf();

  // EOL fallback (single newline)
  test_scan_section_break_single_lf_emits_eol();
  test_scan_section_break_single_crlf_emits_eol();
  test_scan_section_break_single_newline_emits_eol();
  test_scan_section_break_single_crlf_both_valid_emits_eol();
  test_scan_section_break_lf_at_eof_emits_eol();

  // Double newline with only EOL valid
  test_scan_section_break_double_newline_only_eol_valid();

  // Edge cases
  test_scan_section_break_lf_cr_nonewline_emits_eol();
  test_scan_section_break_single_newline_no_eol_valid();
  test_scan_section_break_bare_cr();
  test_scan_section_break_not_newline();

  printf("\n=== All whitespace/EOL tests passed ===\n\n");
  return 0;
}
