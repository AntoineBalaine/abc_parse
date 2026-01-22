#include "test_harness.h"

// ============================================================================
// scan_ampersand tests
// ============================================================================

void test_scan_ampersand_voice_overlay() {
  printf("test_scan_ampersand_voice_overlay... ");
  TSLexer lexer = create_test_lexer("&");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_VOICE_OVRLAY);
  ASSERT_TRUE(scan_ampersand(&lexer, valid_symbols));
  ASSERT_EQ(TT_VOICE_OVRLAY, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_ampersand_generic() {
  printf("test_scan_ampersand_generic... ");
  TSLexer lexer = create_test_lexer("&");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_AMPERSAND);
  ASSERT_TRUE(scan_ampersand(&lexer, valid_symbols));
  ASSERT_EQ(TT_AMPERSAND, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_ampersand_neither_valid() {
  printf("test_scan_ampersand_neither_valid... ");
  TSLexer lexer = create_test_lexer("&");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 0);
  ASSERT_FALSE(scan_ampersand(&lexer, valid_symbols));
  TEST_PASS();
}

void test_scan_ampersand_invalid() {
  printf("test_scan_ampersand_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  bool valid_symbols[TT_COUNT];
  enable_all_symbols(valid_symbols);
  ASSERT_FALSE(scan_ampersand(&lexer, valid_symbols));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_system_break tests
// ============================================================================

void test_scan_system_break_valid() {
  printf("test_scan_system_break_valid... ");
  TSLexer lexer = create_test_lexer("$");
  ASSERT_TRUE(scan_system_break(&lexer));
  ASSERT_EQ(TT_SYSTEM_BREAK, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_system_break_invalid() {
  printf("test_scan_system_break_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_system_break(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_y_spacer tests
// ============================================================================

void test_scan_y_spacer_valid() {
  printf("test_scan_y_spacer_valid... ");
  TSLexer lexer = create_test_lexer("y");
  ASSERT_TRUE(scan_y_spacer(&lexer));
  ASSERT_EQ(TT_Y_SPC, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_y_spacer_invalid() {
  printf("test_scan_y_spacer_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_y_spacer(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_backtick_spacer tests
// ============================================================================

void test_scan_backtick_spacer_valid() {
  printf("test_scan_backtick_spacer_valid... ");
  TSLexer lexer = create_test_lexer("`");
  ASSERT_TRUE(scan_backtick_spacer(&lexer));
  ASSERT_EQ(TT_BCKTCK_SPC, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_backtick_spacer_invalid() {
  printf("test_scan_backtick_spacer_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_backtick_spacer(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_line_continuation tests
// ============================================================================

void test_scan_line_continuation_valid() {
  printf("test_scan_line_continuation_valid... ");
  TSLexer lexer = create_test_lexer("\\");
  ASSERT_TRUE(scan_line_continuation(&lexer));
  ASSERT_EQ(TT_LINE_CONT, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_line_continuation_invalid() {
  printf("test_scan_line_continuation_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_line_continuation(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Special Token Scanner Tests ===\n\n");

  test_scan_ampersand_voice_overlay();
  test_scan_ampersand_generic();
  test_scan_ampersand_neither_valid();
  test_scan_ampersand_invalid();

  test_scan_system_break_valid();
  test_scan_system_break_invalid();

  test_scan_y_spacer_valid();
  test_scan_y_spacer_invalid();

  test_scan_backtick_spacer_valid();
  test_scan_backtick_spacer_invalid();

  test_scan_line_continuation_valid();
  test_scan_line_continuation_invalid();

  printf("\n=== All special token tests passed ===\n\n");
  return 0;
}
