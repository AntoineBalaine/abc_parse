#include "test_harness.h"

// ============================================================================
// scan_tuplet_lparen tests
// ============================================================================

void test_scan_tuplet_lparen_valid() {
  printf("test_scan_tuplet_lparen_valid... ");
  // ( followed by digit is a tuplet
  TSLexer lexer = create_test_lexer("(3");
  ASSERT_TRUE(scan_tuplet_lparen(&lexer));
  ASSERT_EQ(TT_TUPLET_LPAREN, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());  // only consumes the (
  TEST_PASS();
}

void test_scan_tuplet_lparen_digit5() {
  printf("test_scan_tuplet_lparen_digit5... ");
  TSLexer lexer = create_test_lexer("(5");
  ASSERT_TRUE(scan_tuplet_lparen(&lexer));
  ASSERT_EQ(TT_TUPLET_LPAREN, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_tuplet_lparen_not_digit() {
  printf("test_scan_tuplet_lparen_not_digit... ");
  // ( not followed by digit: ( consumed but no token emitted (no backtracking)
  TSLexer lexer = create_test_lexer("(A");
  ASSERT_FALSE(scan_tuplet_lparen(&lexer));
  ASSERT_EQ(1, get_current_pos());  // ( consumed but no token emitted
  TEST_PASS();
}

void test_scan_tuplet_lparen_not_paren() {
  printf("test_scan_tuplet_lparen_not_paren... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_tuplet_lparen(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_tuplet_colon tests
// ============================================================================

void test_scan_tuplet_colon_valid() {
  printf("test_scan_tuplet_colon_valid... ");
  TSLexer lexer = create_test_lexer(":");
  ASSERT_TRUE(scan_tuplet_colon(&lexer));
  ASSERT_EQ(TT_TUPLET_COLON, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_tuplet_colon_invalid() {
  printf("test_scan_tuplet_colon_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_tuplet_colon(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_tuplet_p tests
// ============================================================================

void test_scan_tuplet_p_single() {
  printf("test_scan_tuplet_p_single... ");
  TSLexer lexer = create_test_lexer("3");
  ASSERT_TRUE(scan_tuplet_p(&lexer));
  ASSERT_EQ(TT_TUPLET_P, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_tuplet_p_multi() {
  printf("test_scan_tuplet_p_multi... ");
  TSLexer lexer = create_test_lexer("12");
  ASSERT_TRUE(scan_tuplet_p(&lexer));
  ASSERT_EQ(TT_TUPLET_P, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_tuplet_p_invalid() {
  printf("test_scan_tuplet_p_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_tuplet_p(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_tuplet_q tests
// ============================================================================

void test_scan_tuplet_q_single() {
  printf("test_scan_tuplet_q_single... ");
  TSLexer lexer = create_test_lexer("2");
  ASSERT_TRUE(scan_tuplet_q(&lexer));
  ASSERT_EQ(TT_TUPLET_Q, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_tuplet_q_invalid() {
  printf("test_scan_tuplet_q_invalid... ");
  TSLexer lexer = create_test_lexer(":");
  ASSERT_FALSE(scan_tuplet_q(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_tuplet_r tests
// ============================================================================

void test_scan_tuplet_r_single() {
  printf("test_scan_tuplet_r_single... ");
  TSLexer lexer = create_test_lexer("3");
  ASSERT_TRUE(scan_tuplet_r(&lexer));
  ASSERT_EQ(TT_TUPLET_R, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_tuplet_r_multi() {
  printf("test_scan_tuplet_r_multi... ");
  TSLexer lexer = create_test_lexer("6");
  ASSERT_TRUE(scan_tuplet_r(&lexer));
  ASSERT_EQ(TT_TUPLET_R, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_tuplet_r_invalid() {
  printf("test_scan_tuplet_r_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_tuplet_r(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Tuplet Scanner Tests ===\n\n");

  test_scan_tuplet_lparen_valid();
  test_scan_tuplet_lparen_digit5();
  test_scan_tuplet_lparen_not_digit();
  test_scan_tuplet_lparen_not_paren();

  test_scan_tuplet_colon_valid();
  test_scan_tuplet_colon_invalid();

  test_scan_tuplet_p_single();
  test_scan_tuplet_p_multi();
  test_scan_tuplet_p_invalid();

  test_scan_tuplet_q_single();
  test_scan_tuplet_q_invalid();

  test_scan_tuplet_r_single();
  test_scan_tuplet_r_multi();
  test_scan_tuplet_r_invalid();

  printf("\n=== All tuplet tests passed ===\n\n");
  return 0;
}
