#include "test_harness.h"

// ============================================================================
// scan_identifier tests
// ============================================================================

void test_scan_identifier_alpha() {
  printf("test_scan_identifier_alpha... ");
  TSLexer lexer = create_test_lexer("scale");
  ASSERT_TRUE(scan_identifier(&lexer));
  ASSERT_EQ(TT_IDENTIFIER, lexer.result_symbol);
  ASSERT_EQ(5, get_current_pos());
  TEST_PASS();
}

void test_scan_identifier_with_underscore() {
  printf("test_scan_identifier_with_underscore... ");
  TSLexer lexer = create_test_lexer("page_width");
  ASSERT_TRUE(scan_identifier(&lexer));
  ASSERT_EQ(TT_IDENTIFIER, lexer.result_symbol);
  ASSERT_EQ(10, get_current_pos());
  TEST_PASS();
}

void test_scan_identifier_with_dash() {
  printf("test_scan_identifier_with_dash... ");
  TSLexer lexer = create_test_lexer("page-width");
  ASSERT_TRUE(scan_identifier(&lexer));
  ASSERT_EQ(TT_IDENTIFIER, lexer.result_symbol);
  ASSERT_EQ(10, get_current_pos());
  TEST_PASS();
}

void test_scan_identifier_with_digits() {
  printf("test_scan_identifier_with_digits... ");
  TSLexer lexer = create_test_lexer("font2");
  ASSERT_TRUE(scan_identifier(&lexer));
  ASSERT_EQ(TT_IDENTIFIER, lexer.result_symbol);
  ASSERT_EQ(5, get_current_pos());
  TEST_PASS();
}

void test_scan_identifier_starts_with_underscore() {
  printf("test_scan_identifier_starts_with_underscore... ");
  TSLexer lexer = create_test_lexer("_internal");
  ASSERT_TRUE(scan_identifier(&lexer));
  ASSERT_EQ(TT_IDENTIFIER, lexer.result_symbol);
  ASSERT_EQ(9, get_current_pos());
  TEST_PASS();
}

void test_scan_identifier_stops_at_space() {
  printf("test_scan_identifier_stops_at_space... ");
  TSLexer lexer = create_test_lexer("name value");
  ASSERT_TRUE(scan_identifier(&lexer));
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_identifier_invalid_start_digit() {
  printf("test_scan_identifier_invalid_start_digit... ");
  TSLexer lexer = create_test_lexer("123abc");
  ASSERT_FALSE(scan_identifier(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_identifier_invalid_start_special() {
  printf("test_scan_identifier_invalid_start_special... ");
  TSLexer lexer = create_test_lexer("+abc");
  ASSERT_FALSE(scan_identifier(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_measurement_unit tests
// ============================================================================

void test_scan_measurement_unit_cm() {
  printf("test_scan_measurement_unit_cm... ");
  TSLexer lexer = create_test_lexer("cm");
  ASSERT_TRUE(scan_measurement_unit(&lexer));
  ASSERT_EQ(TT_MEASUREMENT_UNIT, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_measurement_unit_in() {
  printf("test_scan_measurement_unit_in... ");
  TSLexer lexer = create_test_lexer("in");
  ASSERT_TRUE(scan_measurement_unit(&lexer));
  ASSERT_EQ(TT_MEASUREMENT_UNIT, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_measurement_unit_pt() {
  printf("test_scan_measurement_unit_pt... ");
  TSLexer lexer = create_test_lexer("pt");
  ASSERT_TRUE(scan_measurement_unit(&lexer));
  ASSERT_EQ(TT_MEASUREMENT_UNIT, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_measurement_unit_stops_at_non_alpha() {
  printf("test_scan_measurement_unit_stops_at_non_alpha... ");
  TSLexer lexer = create_test_lexer("cm ");
  ASSERT_TRUE(scan_measurement_unit(&lexer));
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_measurement_unit_invalid() {
  printf("test_scan_measurement_unit_invalid... ");
  TSLexer lexer = create_test_lexer("123");
  ASSERT_FALSE(scan_measurement_unit(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_special_literal tests
// ============================================================================

void test_scan_special_literal_C() {
  printf("test_scan_special_literal_C... ");
  TSLexer lexer = create_test_lexer("C ");
  ASSERT_TRUE(scan_special_literal(&lexer));
  ASSERT_EQ(TT_SPECIAL_LITERAL, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_special_literal_C_pipe() {
  printf("test_scan_special_literal_C_pipe... ");
  TSLexer lexer = create_test_lexer("C| ");
  ASSERT_TRUE(scan_special_literal(&lexer));
  ASSERT_EQ(TT_SPECIAL_LITERAL, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_special_literal_C_newline() {
  printf("test_scan_special_literal_C_newline... ");
  TSLexer lexer = create_test_lexer("C\n");
  ASSERT_TRUE(scan_special_literal(&lexer));
  ASSERT_EQ(TT_SPECIAL_LITERAL, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_special_literal_C_bracket() {
  printf("test_scan_special_literal_C_bracket... ");
  TSLexer lexer = create_test_lexer("C]");
  ASSERT_TRUE(scan_special_literal(&lexer));
  ASSERT_EQ(TT_SPECIAL_LITERAL, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_special_literal_C_at_eof() {
  printf("test_scan_special_literal_C_at_eof... ");
  // C at EOF is a valid special literal
  TSLexer lexer = create_test_lexer("C");
  ASSERT_TRUE(scan_special_literal(&lexer));
  ASSERT_EQ(TT_SPECIAL_LITERAL, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_special_literal_not_C() {
  printf("test_scan_special_literal_not_C... ");
  TSLexer lexer = create_test_lexer("A ");
  ASSERT_FALSE(scan_special_literal(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_special_literal_C_followed_by_alpha() {
  printf("test_scan_special_literal_C_followed_by_alpha... ");
  // "CA" - C followed by alpha is not a special literal
  TSLexer lexer = create_test_lexer("CA");
  ASSERT_FALSE(scan_special_literal(&lexer));
  TEST_PASS();
}

// ============================================================================
// scan_free_text tests
// ============================================================================

void test_scan_free_text_simple() {
  printf("test_scan_free_text_simple... ");
  TSLexer lexer = create_test_lexer("This is free text");
  ASSERT_TRUE(scan_free_text(&lexer));
  ASSERT_EQ(TT_FREE_TXT, lexer.result_symbol);
  ASSERT_EQ(17, get_current_pos());
  TEST_PASS();
}

void test_scan_free_text_stops_at_newline() {
  printf("test_scan_free_text_stops_at_newline... ");
  TSLexer lexer = create_test_lexer("Line 1\nLine 2");
  ASSERT_TRUE(scan_free_text(&lexer));
  ASSERT_EQ(6, get_current_pos());
  TEST_PASS();
}

void test_scan_free_text_empty() {
  printf("test_scan_free_text_empty... ");
  TSLexer lexer = create_test_lexer("\n");
  ASSERT_FALSE(scan_free_text(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_free_text_with_special_chars() {
  printf("test_scan_free_text_with_special_chars... ");
  TSLexer lexer = create_test_lexer("Page $P of $N");
  ASSERT_TRUE(scan_free_text(&lexer));
  ASSERT_EQ(TT_FREE_TXT, lexer.result_symbol);
  ASSERT_EQ(13, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Directive Scanner Tests ===\n\n");

  test_scan_identifier_alpha();
  test_scan_identifier_with_underscore();
  test_scan_identifier_with_dash();
  test_scan_identifier_with_digits();
  test_scan_identifier_starts_with_underscore();
  test_scan_identifier_stops_at_space();
  test_scan_identifier_invalid_start_digit();
  test_scan_identifier_invalid_start_special();

  test_scan_measurement_unit_cm();
  test_scan_measurement_unit_in();
  test_scan_measurement_unit_pt();
  test_scan_measurement_unit_stops_at_non_alpha();
  test_scan_measurement_unit_invalid();

  test_scan_special_literal_C();
  test_scan_special_literal_C_pipe();
  test_scan_special_literal_C_newline();
  test_scan_special_literal_C_bracket();
  test_scan_special_literal_C_at_eof();
  test_scan_special_literal_not_C();
  test_scan_special_literal_C_followed_by_alpha();

  test_scan_free_text_simple();
  test_scan_free_text_stops_at_newline();
  test_scan_free_text_empty();
  test_scan_free_text_with_special_chars();

  printf("\n=== All directive tests passed ===\n\n");
  return 0;
}
