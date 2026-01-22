#include "test_harness.h"

// ============================================================================
// scan_symbol_header tests
// ============================================================================

void test_scan_symbol_header_valid() {
  printf("test_scan_symbol_header_valid... ");
  TSLexer lexer = create_test_lexer("s:content");
  ASSERT_TRUE(scan_symbol_header(&lexer));
  ASSERT_EQ(TT_SY_HDR, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_header_with_ws() {
  printf("test_scan_symbol_header_with_ws... ");
  TSLexer lexer = create_test_lexer("s :content");
  ASSERT_TRUE(scan_symbol_header(&lexer));
  ASSERT_EQ(TT_SY_HDR, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_header_no_colon() {
  printf("test_scan_symbol_header_no_colon... ");
  TSLexer lexer = create_test_lexer("sA");
  ASSERT_FALSE(scan_symbol_header(&lexer));
  TEST_PASS();
}

void test_scan_symbol_header_wrong_letter() {
  printf("test_scan_symbol_header_wrong_letter... ");
  TSLexer lexer = create_test_lexer("A:");
  ASSERT_FALSE(scan_symbol_header(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_symbol_star tests
// ============================================================================

void test_scan_symbol_star_valid() {
  printf("test_scan_symbol_star_valid... ");
  TSLexer lexer = create_test_lexer("*");
  ASSERT_TRUE(scan_symbol_star(&lexer));
  ASSERT_EQ(TT_SY_STAR, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_star_invalid() {
  printf("test_scan_symbol_star_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_symbol_star(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_symbol_text tests
// ============================================================================

void test_scan_symbol_text_simple() {
  printf("test_scan_symbol_text_simple... ");
  TSLexer lexer = create_test_lexer("hello");
  ASSERT_TRUE(scan_symbol_text(&lexer));
  ASSERT_EQ(TT_SY_TXT, lexer.result_symbol);
  ASSERT_EQ(5, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_text_stops_at_space() {
  printf("test_scan_symbol_text_stops_at_space... ");
  TSLexer lexer = create_test_lexer("word next");
  ASSERT_TRUE(scan_symbol_text(&lexer));
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_text_stops_at_star() {
  printf("test_scan_symbol_text_stops_at_star... ");
  TSLexer lexer = create_test_lexer("text*more");
  ASSERT_TRUE(scan_symbol_text(&lexer));
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_text_stops_at_barline() {
  printf("test_scan_symbol_text_stops_at_barline... ");
  TSLexer lexer = create_test_lexer("text|bar");
  ASSERT_TRUE(scan_symbol_text(&lexer));
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_text_stops_at_percent() {
  printf("test_scan_symbol_text_stops_at_percent... ");
  TSLexer lexer = create_test_lexer("text%comment");
  ASSERT_TRUE(scan_symbol_text(&lexer));
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_text_empty() {
  printf("test_scan_symbol_text_empty... ");
  TSLexer lexer = create_test_lexer(" next");
  ASSERT_FALSE(scan_symbol_text(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Symbol Line Scanner Tests ===\n\n");

  test_scan_symbol_header_valid();
  test_scan_symbol_header_with_ws();
  test_scan_symbol_header_no_colon();
  test_scan_symbol_header_wrong_letter();

  test_scan_symbol_star_valid();
  test_scan_symbol_star_invalid();

  test_scan_symbol_text_simple();
  test_scan_symbol_text_stops_at_space();
  test_scan_symbol_text_stops_at_star();
  test_scan_symbol_text_stops_at_barline();
  test_scan_symbol_text_stops_at_percent();
  test_scan_symbol_text_empty();

  printf("\n=== All symbol line tests passed ===\n\n");
  return 0;
}
