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
// scan_eol tests
// ============================================================================

void test_scan_eol_lf() {
  printf("test_scan_eol_lf... ");
  TSLexer lexer = create_test_lexer("\n");
  ScannerState state = create_test_state();
  ASSERT_TRUE(scan_eol(&lexer, &state));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  TEST_PASS();
}

void test_scan_eol_crlf() {
  printf("test_scan_eol_crlf... ");
  TSLexer lexer = create_test_lexer("\r\n");
  ScannerState state = create_test_state();
  ASSERT_TRUE(scan_eol(&lexer, &state));
  ASSERT_EQ(TT_EOL, lexer.result_symbol);
  ASSERT_EQ(2, state.line_number);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_eol_invalid() {
  printf("test_scan_eol_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ScannerState state = create_test_state();
  ASSERT_FALSE(scan_eol(&lexer, &state));
  ASSERT_EQ(1, state.line_number);
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_eol_cr_alone() {
  printf("test_scan_eol_cr_alone... ");
  // \r not followed by \n: returns false but consumes the \r (no backtracking)
  TSLexer lexer = create_test_lexer("\rA");
  ScannerState state = create_test_state();
  ASSERT_FALSE(scan_eol(&lexer, &state));
  ASSERT_EQ(1, get_current_pos());  // \r consumed but no token emitted
  TEST_PASS();
}

// ============================================================================
// scan_section_break tests
// ============================================================================

void test_scan_section_break_double_newline() {
  printf("test_scan_section_break_double_newline... ");
  TSLexer lexer = create_test_lexer("\n\n");
  ScannerState state = create_test_state();
  ASSERT_TRUE(scan_section_break(&lexer, &state));
  ASSERT_EQ(TT_SCT_BRK, lexer.result_symbol);
  ASSERT_EQ(3, state.line_number);
  TEST_PASS();
}

void test_scan_section_break_crlf_crlf() {
  printf("test_scan_section_break_crlf_crlf... ");
  TSLexer lexer = create_test_lexer("\r\n\r\n");
  ScannerState state = create_test_state();
  ASSERT_TRUE(scan_section_break(&lexer, &state));
  ASSERT_EQ(TT_SCT_BRK, lexer.result_symbol);
  ASSERT_EQ(3, state.line_number);
  TEST_PASS();
}

void test_scan_section_break_single_newline() {
  printf("test_scan_section_break_single_newline... ");
  TSLexer lexer = create_test_lexer("\nA");
  ScannerState state = create_test_state();
  ASSERT_FALSE(scan_section_break(&lexer, &state));
  TEST_PASS();
}

void test_scan_section_break_not_newline() {
  printf("test_scan_section_break_not_newline... ");
  TSLexer lexer = create_test_lexer("A");
  ScannerState state = create_test_state();
  ASSERT_FALSE(scan_section_break(&lexer, &state));
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

  test_scan_eol_lf();
  test_scan_eol_crlf();
  test_scan_eol_invalid();
  test_scan_eol_cr_alone();

  test_scan_section_break_double_newline();
  test_scan_section_break_crlf_crlf();
  test_scan_section_break_single_newline();
  test_scan_section_break_not_newline();

  printf("\n=== All whitespace/EOL tests passed ===\n\n");
  return 0;
}
