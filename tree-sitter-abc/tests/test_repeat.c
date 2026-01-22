#include "test_harness.h"

// ============================================================================
// scan_repeat_number tests
// ============================================================================

void test_scan_repeat_number_single() {
  printf("test_scan_repeat_number_single... ");
  TSLexer lexer = create_test_lexer("1");
  ASSERT_TRUE(scan_repeat_number(&lexer));
  ASSERT_EQ(TT_REPEAT_NUMBER, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_repeat_number_multi_digit() {
  printf("test_scan_repeat_number_multi_digit... ");
  TSLexer lexer = create_test_lexer("123");
  ASSERT_TRUE(scan_repeat_number(&lexer));
  ASSERT_EQ(TT_REPEAT_NUMBER, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_repeat_number_with_leading_ws() {
  printf("test_scan_repeat_number_with_leading_ws... ");
  TSLexer lexer = create_test_lexer("  2");
  ASSERT_TRUE(scan_repeat_number(&lexer));
  ASSERT_EQ(TT_REPEAT_NUMBER, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_repeat_number_invalid() {
  printf("test_scan_repeat_number_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_repeat_number(&lexer));
  TEST_PASS();
}

// ============================================================================
// scan_repeat_comma tests
// ============================================================================

void test_scan_repeat_comma_valid() {
  printf("test_scan_repeat_comma_valid... ");
  TSLexer lexer = create_test_lexer(",");
  ASSERT_TRUE(scan_repeat_comma(&lexer));
  ASSERT_EQ(TT_REPEAT_COMMA, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_repeat_comma_invalid() {
  printf("test_scan_repeat_comma_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_repeat_comma(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_repeat_dash tests
// ============================================================================

void test_scan_repeat_dash_valid() {
  printf("test_scan_repeat_dash_valid... ");
  TSLexer lexer = create_test_lexer("-");
  ASSERT_TRUE(scan_repeat_dash(&lexer));
  ASSERT_EQ(TT_REPEAT_DASH, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_repeat_dash_invalid() {
  printf("test_scan_repeat_dash_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_repeat_dash(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_repeat_x tests
// ============================================================================

void test_scan_repeat_x_lowercase() {
  printf("test_scan_repeat_x_lowercase... ");
  TSLexer lexer = create_test_lexer("x");
  ASSERT_TRUE(scan_repeat_x(&lexer));
  ASSERT_EQ(TT_REPEAT_X, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_repeat_x_uppercase() {
  printf("test_scan_repeat_x_uppercase... ");
  TSLexer lexer = create_test_lexer("X");
  ASSERT_TRUE(scan_repeat_x(&lexer));
  ASSERT_EQ(TT_REPEAT_X, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_repeat_x_invalid() {
  printf("test_scan_repeat_x_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_repeat_x(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Repeat Scanner Tests ===\n\n");

  test_scan_repeat_number_single();
  test_scan_repeat_number_multi_digit();
  test_scan_repeat_number_with_leading_ws();
  test_scan_repeat_number_invalid();

  test_scan_repeat_comma_valid();
  test_scan_repeat_comma_invalid();

  test_scan_repeat_dash_valid();
  test_scan_repeat_dash_invalid();

  test_scan_repeat_x_lowercase();
  test_scan_repeat_x_uppercase();
  test_scan_repeat_x_invalid();

  printf("\n=== All repeat tests passed ===\n\n");
  return 0;
}
