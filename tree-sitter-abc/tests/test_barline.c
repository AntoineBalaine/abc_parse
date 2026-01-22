#include "test_harness.h"

// ============================================================================
// scan_barline tests
// ============================================================================

void test_scan_barline_single() {
  printf("test_scan_barline_single... ");
  TSLexer lexer = create_test_lexer("|");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_double() {
  printf("test_scan_barline_double... ");
  TSLexer lexer = create_test_lexer("||");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_thin_thick() {
  printf("test_scan_barline_thin_thick... ");
  TSLexer lexer = create_test_lexer("|]");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_thick_thin() {
  printf("test_scan_barline_thick_thin... ");
  TSLexer lexer = create_test_lexer("[|");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_repeat_start() {
  printf("test_scan_barline_repeat_start... ");
  TSLexer lexer = create_test_lexer("|:");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_repeat_end() {
  printf("test_scan_barline_repeat_end... ");
  TSLexer lexer = create_test_lexer(":|");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_double_repeat() {
  printf("test_scan_barline_double_repeat... ");
  TSLexer lexer = create_test_lexer("::");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_repeat_number() {
  printf("test_scan_barline_repeat_number... ");
  TSLexer lexer = create_test_lexer("|1");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_bracket_number() {
  printf("test_scan_barline_bracket_number... ");
  TSLexer lexer = create_test_lexer("[1");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_thick_thin_repeat() {
  printf("test_scan_barline_thick_thin_repeat... ");
  TSLexer lexer = create_test_lexer("[|:");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_colon_alone() {
  printf("test_scan_barline_colon_alone... ");
  // : not followed by | or : is not a barline, but : is consumed (no backtracking)
  TSLexer lexer = create_test_lexer(":A");
  ASSERT_FALSE(scan_barline(&lexer));
  ASSERT_EQ(1, get_current_pos());  // : consumed but no token emitted
  TEST_PASS();
}

void test_scan_barline_bracket_alone() {
  printf("test_scan_barline_bracket_alone... ");
  // [ not followed by | or digit: [ consumed but no barline emitted
  TSLexer lexer = create_test_lexer("[A");
  ASSERT_FALSE(scan_barline(&lexer));
  ASSERT_EQ(1, get_current_pos());  // [ consumed but no token emitted
  TEST_PASS();
}

void test_scan_barline_invalid() {
  printf("test_scan_barline_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_barline(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_barline_double_colon_pipe() {
  printf("test_scan_barline_double_colon_pipe... ");
  // ::| pattern
  TSLexer lexer = create_test_lexer("::|");
  ASSERT_TRUE(scan_barline(&lexer));
  ASSERT_EQ(TT_BARLINE, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Barline Scanner Tests ===\n\n");

  test_scan_barline_single();
  test_scan_barline_double();
  test_scan_barline_thin_thick();
  test_scan_barline_thick_thin();
  test_scan_barline_repeat_start();
  test_scan_barline_repeat_end();
  test_scan_barline_double_repeat();
  test_scan_barline_repeat_number();
  test_scan_barline_bracket_number();
  test_scan_barline_thick_thin_repeat();
  test_scan_barline_colon_alone();
  test_scan_barline_bracket_alone();
  test_scan_barline_invalid();
  test_scan_barline_double_colon_pipe();

  printf("\n=== All barline tests passed ===\n\n");
  return 0;
}
