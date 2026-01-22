#include "test_harness.h"

// ============================================================================
// scan_number tests (rhythm numerator)
// ============================================================================

void test_scan_number_single_digit() {
  printf("test_scan_number_single_digit... ");
  TSLexer lexer = create_test_lexer("3");
  ASSERT_TRUE(scan_number(&lexer));
  ASSERT_EQ(TT_RHY_NUMER, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_number_multi_digit() {
  printf("test_scan_number_multi_digit... ");
  TSLexer lexer = create_test_lexer("20");
  ASSERT_TRUE(scan_number(&lexer));
  ASSERT_EQ(TT_RHY_NUMER, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_number_stops_at_non_digit() {
  printf("test_scan_number_stops_at_non_digit... ");
  TSLexer lexer = create_test_lexer("42A");
  ASSERT_TRUE(scan_number(&lexer));
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_number_invalid() {
  printf("test_scan_number_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_number(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_rhythm_sep tests
// ============================================================================

void test_scan_rhythm_sep_valid() {
  printf("test_scan_rhythm_sep_valid... ");
  TSLexer lexer = create_test_lexer("/");
  ASSERT_TRUE(scan_rhythm_sep(&lexer));
  ASSERT_EQ(TT_RHY_SEP, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_rhythm_sep_invalid() {
  printf("test_scan_rhythm_sep_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_rhythm_sep(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_broken_rhythm tests
// ============================================================================

void test_scan_broken_rhythm_single_right() {
  printf("test_scan_broken_rhythm_single_right... ");
  TSLexer lexer = create_test_lexer(">");
  ASSERT_TRUE(scan_broken_rhythm(&lexer));
  ASSERT_EQ(TT_RHY_BRKN, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_broken_rhythm_double_right() {
  printf("test_scan_broken_rhythm_double_right... ");
  TSLexer lexer = create_test_lexer(">>");
  ASSERT_TRUE(scan_broken_rhythm(&lexer));
  ASSERT_EQ(TT_RHY_BRKN, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_broken_rhythm_single_left() {
  printf("test_scan_broken_rhythm_single_left... ");
  TSLexer lexer = create_test_lexer("<");
  ASSERT_TRUE(scan_broken_rhythm(&lexer));
  ASSERT_EQ(TT_RHY_BRKN, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_broken_rhythm_double_left() {
  printf("test_scan_broken_rhythm_double_left... ");
  TSLexer lexer = create_test_lexer("<<");
  ASSERT_TRUE(scan_broken_rhythm(&lexer));
  ASSERT_EQ(TT_RHY_BRKN, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_broken_rhythm_invalid() {
  printf("test_scan_broken_rhythm_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_broken_rhythm(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_rhythm_denom tests
// ============================================================================

void test_scan_rhythm_denom_single() {
  printf("test_scan_rhythm_denom_single... ");
  TSLexer lexer = create_test_lexer("4");
  ASSERT_TRUE(scan_rhythm_denom(&lexer));
  ASSERT_EQ(TT_RHY_DENOM, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_rhythm_denom_multi() {
  printf("test_scan_rhythm_denom_multi... ");
  TSLexer lexer = create_test_lexer("16");
  ASSERT_TRUE(scan_rhythm_denom(&lexer));
  ASSERT_EQ(TT_RHY_DENOM, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_rhythm_denom_invalid() {
  printf("test_scan_rhythm_denom_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_rhythm_denom(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_general_number tests
// ============================================================================

void test_scan_general_number_single() {
  printf("test_scan_general_number_single... ");
  TSLexer lexer = create_test_lexer("7");
  ASSERT_TRUE(scan_general_number(&lexer));
  ASSERT_EQ(TT_NUMBER, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_general_number_multi() {
  printf("test_scan_general_number_multi... ");
  TSLexer lexer = create_test_lexer("120");
  ASSERT_TRUE(scan_general_number(&lexer));
  ASSERT_EQ(TT_NUMBER, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_general_number_invalid() {
  printf("test_scan_general_number_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_general_number(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Rhythm Scanner Tests ===\n\n");

  test_scan_number_single_digit();
  test_scan_number_multi_digit();
  test_scan_number_stops_at_non_digit();
  test_scan_number_invalid();

  test_scan_rhythm_sep_valid();
  test_scan_rhythm_sep_invalid();

  test_scan_broken_rhythm_single_right();
  test_scan_broken_rhythm_double_right();
  test_scan_broken_rhythm_single_left();
  test_scan_broken_rhythm_double_left();
  test_scan_broken_rhythm_invalid();

  test_scan_rhythm_denom_single();
  test_scan_rhythm_denom_multi();
  test_scan_rhythm_denom_invalid();

  test_scan_general_number_single();
  test_scan_general_number_multi();
  test_scan_general_number_invalid();

  printf("\n=== All rhythm tests passed ===\n\n");
  return 0;
}
