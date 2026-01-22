#include "test_harness.h"

// ============================================================================
// scan_annotation tests
// ============================================================================

void test_scan_annotation_simple() {
  printf("test_scan_annotation_simple... ");
  TSLexer lexer = create_test_lexer("\"text\"");
  ASSERT_TRUE(scan_annotation(&lexer));
  ASSERT_EQ(TT_ANNOTATION, lexer.result_symbol);
  ASSERT_EQ(6, get_current_pos());
  TEST_PASS();
}

void test_scan_annotation_with_spaces() {
  printf("test_scan_annotation_with_spaces... ");
  TSLexer lexer = create_test_lexer("\"text with spaces\"");
  ASSERT_TRUE(scan_annotation(&lexer));
  ASSERT_EQ(TT_ANNOTATION, lexer.result_symbol);
  ASSERT_EQ(18, get_current_pos());
  TEST_PASS();
}

void test_scan_annotation_escaped_quote() {
  printf("test_scan_annotation_escaped_quote... ");
  TSLexer lexer = create_test_lexer("\"D\\\"\"");
  ASSERT_TRUE(scan_annotation(&lexer));
  ASSERT_EQ(TT_ANNOTATION, lexer.result_symbol);
  ASSERT_EQ(5, get_current_pos());
  TEST_PASS();
}

void test_scan_annotation_unterminated() {
  printf("test_scan_annotation_unterminated... ");
  // Stops at newline without closing quote
  TSLexer lexer = create_test_lexer("\"unterminated\n");
  ASSERT_TRUE(scan_annotation(&lexer));
  ASSERT_EQ(TT_ANNOTATION, lexer.result_symbol);
  // Consumed up to \n (not including it)
  ASSERT_EQ(13, get_current_pos());
  TEST_PASS();
}

void test_scan_annotation_eof_no_close() {
  printf("test_scan_annotation_eof_no_close... ");
  // Annotation at EOF without closing quote or trailing newline
  TSLexer lexer = create_test_lexer("\"unterminated");
  ASSERT_TRUE(scan_annotation(&lexer));
  ASSERT_EQ(TT_ANNOTATION, lexer.result_symbol);
  ASSERT_EQ(13, get_current_pos());
  TEST_PASS();
}

void test_scan_annotation_not_quote() {
  printf("test_scan_annotation_not_quote... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_annotation(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_symbol tests
// ============================================================================

void test_scan_symbol_exclamation() {
  printf("test_scan_symbol_exclamation... ");
  TSLexer lexer = create_test_lexer("!trill!");
  ASSERT_TRUE(scan_symbol(&lexer));
  ASSERT_EQ(TT_SYMBOL, lexer.result_symbol);
  ASSERT_EQ(7, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_plus() {
  printf("test_scan_symbol_plus... ");
  TSLexer lexer = create_test_lexer("+fermata+");
  ASSERT_TRUE(scan_symbol(&lexer));
  ASSERT_EQ(TT_SYMBOL, lexer.result_symbol);
  ASSERT_EQ(9, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_not_symbol() {
  printf("test_scan_symbol_not_symbol... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_symbol(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_symbol_unterminated_excl() {
  printf("test_scan_symbol_unterminated_excl... ");
  // Stops at newline
  TSLexer lexer = create_test_lexer("!trill\n");
  ASSERT_TRUE(scan_symbol(&lexer));
  ASSERT_EQ(TT_SYMBOL, lexer.result_symbol);
  TEST_PASS();
}

// ============================================================================
// scan_chord_symbol tests
// ============================================================================

void test_scan_chord_symbol_simple() {
  printf("test_scan_chord_symbol_simple... ");
  TSLexer lexer = create_test_lexer("\"Am\"");
  ASSERT_TRUE(scan_chord_symbol(&lexer));
  ASSERT_EQ(TT_CHORD_SYMBOL, lexer.result_symbol);
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_chord_symbol_complex() {
  printf("test_scan_chord_symbol_complex... ");
  TSLexer lexer = create_test_lexer("\"Cmaj7\"");
  ASSERT_TRUE(scan_chord_symbol(&lexer));
  ASSERT_EQ(TT_CHORD_SYMBOL, lexer.result_symbol);
  ASSERT_EQ(7, get_current_pos());
  TEST_PASS();
}

void test_scan_chord_symbol_not_quote() {
  printf("test_scan_chord_symbol_not_quote... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_chord_symbol(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_escaped_char tests
// ============================================================================

void test_scan_escaped_char_valid() {
  printf("test_scan_escaped_char_valid... ");
  TSLexer lexer = create_test_lexer("\\n");
  ASSERT_TRUE(scan_escaped_char(&lexer));
  ASSERT_EQ(TT_ESCAPED_CHAR, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_escaped_char_backslash_at_eol() {
  printf("test_scan_escaped_char_backslash_at_eol... ");
  // \ followed by newline does not consume the newline
  TSLexer lexer = create_test_lexer("\\\n");
  ASSERT_TRUE(scan_escaped_char(&lexer));
  ASSERT_EQ(TT_ESCAPED_CHAR, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());  // Only backslash consumed
  TEST_PASS();
}

void test_scan_escaped_char_not_backslash() {
  printf("test_scan_escaped_char_not_backslash... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_escaped_char(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Symbol Scanner Tests ===\n\n");

  test_scan_annotation_simple();
  test_scan_annotation_with_spaces();
  test_scan_annotation_escaped_quote();
  test_scan_annotation_unterminated();
  test_scan_annotation_eof_no_close();
  test_scan_annotation_not_quote();

  test_scan_symbol_exclamation();
  test_scan_symbol_plus();
  test_scan_symbol_not_symbol();
  test_scan_symbol_unterminated_excl();

  test_scan_chord_symbol_simple();
  test_scan_chord_symbol_complex();
  test_scan_chord_symbol_not_quote();

  test_scan_escaped_char_valid();
  test_scan_escaped_char_backslash_at_eol();
  test_scan_escaped_char_not_backslash();

  printf("\n=== All symbol tests passed ===\n\n");
  return 0;
}
