#include "test_harness.h"

// ============================================================================
// scan_chord_bracket tests
// ============================================================================

void test_scan_chord_bracket_left() {
  printf("test_scan_chord_bracket_left... ");
  TSLexer lexer = create_test_lexer("[");
  ASSERT_TRUE(scan_chord_bracket(&lexer));
  ASSERT_EQ(TT_CHRD_LEFT_BRKT, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_chord_bracket_right() {
  printf("test_scan_chord_bracket_right... ");
  TSLexer lexer = create_test_lexer("]");
  ASSERT_TRUE(scan_chord_bracket(&lexer));
  ASSERT_EQ(TT_CHRD_RIGHT_BRKT, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_chord_bracket_invalid() {
  printf("test_scan_chord_bracket_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_chord_bracket(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_grace_brace tests
// ============================================================================

void test_scan_grace_brace_left() {
  printf("test_scan_grace_brace_left... ");
  TSLexer lexer = create_test_lexer("{");
  ASSERT_TRUE(scan_grace_brace(&lexer));
  ASSERT_EQ(TT_GRC_GRP_LEFT_BRACE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_grace_brace_right() {
  printf("test_scan_grace_brace_right... ");
  TSLexer lexer = create_test_lexer("}");
  ASSERT_TRUE(scan_grace_brace(&lexer));
  ASSERT_EQ(TT_GRC_GRP_RGHT_BRACE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_grace_brace_invalid() {
  printf("test_scan_grace_brace_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_grace_brace(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_grace_slash tests
// ============================================================================

void test_scan_grace_slash_valid() {
  printf("test_scan_grace_slash_valid... ");
  TSLexer lexer = create_test_lexer("/");
  ASSERT_TRUE(scan_grace_slash(&lexer));
  ASSERT_EQ(TT_GRC_GRP_SLSH, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_grace_slash_invalid() {
  printf("test_scan_grace_slash_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_grace_slash(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_inline_field_left tests
// ============================================================================

void test_scan_inline_field_left_valid() {
  printf("test_scan_inline_field_left_valid... ");
  TSLexer lexer = create_test_lexer("[");
  ASSERT_TRUE(scan_inline_field_left(&lexer));
  ASSERT_EQ(TT_INLN_FLD_LFT_BRKT, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_inline_field_left_invalid() {
  printf("test_scan_inline_field_left_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_inline_field_left(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_inline_field_right tests
// ============================================================================

void test_scan_inline_field_right_valid() {
  printf("test_scan_inline_field_right_valid... ");
  TSLexer lexer = create_test_lexer("]");
  ASSERT_TRUE(scan_inline_field_right(&lexer));
  ASSERT_EQ(TT_INLN_FLD_RGT_BRKT, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_inline_field_right_invalid() {
  printf("test_scan_inline_field_right_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_inline_field_right(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Bracket Scanner Tests ===\n\n");

  test_scan_chord_bracket_left();
  test_scan_chord_bracket_right();
  test_scan_chord_bracket_invalid();

  test_scan_grace_brace_left();
  test_scan_grace_brace_right();
  test_scan_grace_brace_invalid();

  test_scan_grace_slash_valid();
  test_scan_grace_slash_invalid();

  test_scan_inline_field_left_valid();
  test_scan_inline_field_left_invalid();

  test_scan_inline_field_right_valid();
  test_scan_inline_field_right_invalid();

  printf("\n=== All bracket tests passed ===\n\n");
  return 0;
}
