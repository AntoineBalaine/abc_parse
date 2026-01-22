#include "test_harness.h"

// ============================================================================
// scan_lyric_header tests
// ============================================================================

void test_scan_lyric_header_lowercase() {
  printf("test_scan_lyric_header_lowercase... ");
  TSLexer lexer = create_test_lexer("w:lyrics");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 2, TT_LY_HDR, TT_LY_SECT_HDR);
  ASSERT_TRUE(scan_lyric_header(&lexer, valid_symbols));
  ASSERT_EQ(TT_LY_HDR, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_header_uppercase() {
  printf("test_scan_lyric_header_uppercase... ");
  TSLexer lexer = create_test_lexer("W:section lyrics");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 2, TT_LY_HDR, TT_LY_SECT_HDR);
  ASSERT_TRUE(scan_lyric_header(&lexer, valid_symbols));
  ASSERT_EQ(TT_LY_SECT_HDR, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_header_with_ws() {
  printf("test_scan_lyric_header_with_ws... ");
  TSLexer lexer = create_test_lexer("w :");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_LY_HDR);
  ASSERT_TRUE(scan_lyric_header(&lexer, valid_symbols));
  ASSERT_EQ(TT_LY_HDR, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_header_no_colon() {
  printf("test_scan_lyric_header_no_colon... ");
  TSLexer lexer = create_test_lexer("wA");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_LY_HDR);
  ASSERT_FALSE(scan_lyric_header(&lexer, valid_symbols));
  TEST_PASS();
}

void test_scan_lyric_header_invalid() {
  printf("test_scan_lyric_header_invalid... ");
  TSLexer lexer = create_test_lexer("A:");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_LY_HDR);
  ASSERT_FALSE(scan_lyric_header(&lexer, valid_symbols));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_lyric_text tests
// ============================================================================

void test_scan_lyric_text_simple() {
  printf("test_scan_lyric_text_simple... ");
  TSLexer lexer = create_test_lexer("hello");
  ASSERT_TRUE(scan_lyric_text(&lexer));
  ASSERT_EQ(TT_LY_TXT, lexer.result_symbol);
  ASSERT_EQ(5, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_text_stops_at_hyphen() {
  printf("test_scan_lyric_text_stops_at_hyphen... ");
  TSLexer lexer = create_test_lexer("syll-able");
  ASSERT_TRUE(scan_lyric_text(&lexer));
  ASSERT_EQ(TT_LY_TXT, lexer.result_symbol);
  ASSERT_EQ(4, get_current_pos());  // "syll"
  TEST_PASS();
}

void test_scan_lyric_text_stops_at_space() {
  printf("test_scan_lyric_text_stops_at_space... ");
  TSLexer lexer = create_test_lexer("word next");
  ASSERT_TRUE(scan_lyric_text(&lexer));
  ASSERT_EQ(4, get_current_pos());  // "word"
  TEST_PASS();
}

void test_scan_lyric_text_stops_at_underscore() {
  printf("test_scan_lyric_text_stops_at_underscore... ");
  TSLexer lexer = create_test_lexer("hold_");
  ASSERT_TRUE(scan_lyric_text(&lexer));
  ASSERT_EQ(4, get_current_pos());  // "hold"
  TEST_PASS();
}

void test_scan_lyric_text_stops_at_star() {
  printf("test_scan_lyric_text_stops_at_star... ");
  TSLexer lexer = create_test_lexer("word*");
  ASSERT_TRUE(scan_lyric_text(&lexer));
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_text_stops_at_tilde() {
  printf("test_scan_lyric_text_stops_at_tilde... ");
  TSLexer lexer = create_test_lexer("of~the");
  ASSERT_TRUE(scan_lyric_text(&lexer));
  ASSERT_EQ(2, get_current_pos());  // "of"
  TEST_PASS();
}

void test_scan_lyric_text_stops_at_barline() {
  printf("test_scan_lyric_text_stops_at_barline... ");
  TSLexer lexer = create_test_lexer("word|next");
  ASSERT_TRUE(scan_lyric_text(&lexer));
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_text_stops_at_backslash() {
  printf("test_scan_lyric_text_stops_at_backslash... ");
  TSLexer lexer = create_test_lexer("word\\next");
  ASSERT_TRUE(scan_lyric_text(&lexer));
  ASSERT_EQ(4, get_current_pos());  // "word"
  TEST_PASS();
}

void test_scan_lyric_text_empty() {
  printf("test_scan_lyric_text_empty... ");
  TSLexer lexer = create_test_lexer("-next");
  ASSERT_FALSE(scan_lyric_text(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_lyric_underscore tests
// ============================================================================

void test_scan_lyric_underscore_valid() {
  printf("test_scan_lyric_underscore_valid... ");
  TSLexer lexer = create_test_lexer("_");
  ASSERT_TRUE(scan_lyric_underscore(&lexer));
  ASSERT_EQ(TT_LY_UNDR, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_underscore_invalid() {
  printf("test_scan_lyric_underscore_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_lyric_underscore(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_lyric_hyphen tests
// ============================================================================

void test_scan_lyric_hyphen_valid() {
  printf("test_scan_lyric_hyphen_valid... ");
  TSLexer lexer = create_test_lexer("-");
  ASSERT_TRUE(scan_lyric_hyphen(&lexer));
  ASSERT_EQ(TT_LY_HYPH, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_hyphen_invalid() {
  printf("test_scan_lyric_hyphen_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_lyric_hyphen(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_lyric_star tests
// ============================================================================

void test_scan_lyric_star_valid() {
  printf("test_scan_lyric_star_valid... ");
  TSLexer lexer = create_test_lexer("*");
  ASSERT_TRUE(scan_lyric_star(&lexer));
  ASSERT_EQ(TT_LY_STAR, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_star_invalid() {
  printf("test_scan_lyric_star_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_lyric_star(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_lyric_tilde tests
// ============================================================================

void test_scan_lyric_tilde_valid() {
  printf("test_scan_lyric_tilde_valid... ");
  TSLexer lexer = create_test_lexer("~");
  ASSERT_TRUE(scan_lyric_tilde(&lexer));
  ASSERT_EQ(TT_LY_SPS, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_lyric_tilde_invalid() {
  printf("test_scan_lyric_tilde_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_lyric_tilde(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Lyrics Scanner Tests ===\n\n");

  test_scan_lyric_header_lowercase();
  test_scan_lyric_header_uppercase();
  test_scan_lyric_header_with_ws();
  test_scan_lyric_header_no_colon();
  test_scan_lyric_header_invalid();

  test_scan_lyric_text_simple();
  test_scan_lyric_text_stops_at_hyphen();
  test_scan_lyric_text_stops_at_space();
  test_scan_lyric_text_stops_at_underscore();
  test_scan_lyric_text_stops_at_star();
  test_scan_lyric_text_stops_at_tilde();
  test_scan_lyric_text_stops_at_barline();
  test_scan_lyric_text_stops_at_backslash();
  test_scan_lyric_text_empty();

  test_scan_lyric_underscore_valid();
  test_scan_lyric_underscore_invalid();

  test_scan_lyric_hyphen_valid();
  test_scan_lyric_hyphen_invalid();

  test_scan_lyric_star_valid();
  test_scan_lyric_star_invalid();

  test_scan_lyric_tilde_valid();
  test_scan_lyric_tilde_invalid();

  printf("\n=== All lyrics tests passed ===\n\n");
  return 0;
}
