#include "test_harness.h"

// ============================================================================
// scan_info_header tests
// ============================================================================

void test_scan_info_header_X() {
  printf("test_scan_info_header_X... ");
  TSLexer lexer = create_test_lexer("X:");
  bool valid_symbols[TT_COUNT];
  enable_all_symbols(valid_symbols);
  ASSERT_TRUE(scan_info_header(&lexer, valid_symbols));
  ASSERT_EQ(TT_INF_HDR, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_info_header_T() {
  printf("test_scan_info_header_T... ");
  TSLexer lexer = create_test_lexer("T:Title");
  bool valid_symbols[TT_COUNT];
  enable_all_symbols(valid_symbols);
  ASSERT_TRUE(scan_info_header(&lexer, valid_symbols));
  ASSERT_EQ(TT_INF_HDR, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_info_header_K() {
  printf("test_scan_info_header_K... ");
  TSLexer lexer = create_test_lexer("K:C");
  bool valid_symbols[TT_COUNT];
  enable_all_symbols(valid_symbols);
  ASSERT_TRUE(scan_info_header(&lexer, valid_symbols));
  ASSERT_EQ(TT_INF_HDR, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_info_header_not_alpha() {
  printf("test_scan_info_header_not_alpha... ");
  TSLexer lexer = create_test_lexer("1:");
  bool valid_symbols[TT_COUNT];
  enable_all_symbols(valid_symbols);
  ASSERT_FALSE(scan_info_header(&lexer, valid_symbols));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_info_header_no_colon() {
  printf("test_scan_info_header_no_colon... ");
  // Alpha not followed by colon - should fallback to identifier
  TSLexer lexer = create_test_lexer("AB");
  bool valid_symbols[TT_COUNT];
  enable_all_symbols(valid_symbols);
  ASSERT_TRUE(scan_info_header(&lexer, valid_symbols));
  // Falls back to TT_IDENTIFIER because 'A' is not followed by ':'
  ASSERT_EQ(TT_IDENTIFIER, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_info_header_no_colon_no_fallback() {
  printf("test_scan_info_header_no_colon_no_fallback... ");
  // Alpha not followed by colon, identifier not valid
  TSLexer lexer = create_test_lexer("AB");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_INF_HDR);
  ASSERT_FALSE(scan_info_header(&lexer, valid_symbols));
  TEST_PASS();
}

// ============================================================================
// scan_info_string tests
// ============================================================================

void test_scan_info_string_simple() {
  printf("test_scan_info_string_simple... ");
  TSLexer lexer = create_test_lexer("Title");
  ASSERT_TRUE(scan_info_string(&lexer));
  ASSERT_EQ(TT_INFO_STR, lexer.result_symbol);
  ASSERT_EQ(5, get_current_pos());
  TEST_PASS();
}

void test_scan_info_string_with_spaces() {
  printf("test_scan_info_string_with_spaces... ");
  TSLexer lexer = create_test_lexer("My Title Here");
  ASSERT_TRUE(scan_info_string(&lexer));
  ASSERT_EQ(TT_INFO_STR, lexer.result_symbol);
  ASSERT_EQ(13, get_current_pos());
  TEST_PASS();
}

void test_scan_info_string_stops_at_newline() {
  printf("test_scan_info_string_stops_at_newline... ");
  TSLexer lexer = create_test_lexer("Title\nNext");
  ASSERT_TRUE(scan_info_string(&lexer));
  ASSERT_EQ(TT_INFO_STR, lexer.result_symbol);
  ASSERT_EQ(5, get_current_pos());
  TEST_PASS();
}

void test_scan_info_string_empty() {
  printf("test_scan_info_string_empty... ");
  TSLexer lexer = create_test_lexer("\n");
  ASSERT_FALSE(scan_info_string(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_info_continuation tests
// ============================================================================

void test_scan_info_continuation_valid() {
  printf("test_scan_info_continuation_valid... ");
  TSLexer lexer = create_test_lexer("+:");
  ASSERT_TRUE(scan_info_continuation(&lexer));
  ASSERT_EQ(TT_INF_CTND, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_info_continuation_with_ws() {
  printf("test_scan_info_continuation_with_ws... ");
  TSLexer lexer = create_test_lexer("+ :");
  ASSERT_TRUE(scan_info_continuation(&lexer));
  ASSERT_EQ(TT_INF_CTND, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_info_continuation_no_colon() {
  printf("test_scan_info_continuation_no_colon... ");
  TSLexer lexer = create_test_lexer("+A");
  ASSERT_FALSE(scan_info_continuation(&lexer));
  TEST_PASS();
}

void test_scan_info_continuation_invalid() {
  printf("test_scan_info_continuation_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_info_continuation(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_percent_token tests
// ============================================================================

void test_scan_percent_token_comment() {
  printf("test_scan_percent_token_comment... ");
  TSLexer lexer = create_test_lexer("%comment text\n");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_COMMENT);
  ASSERT_TRUE(scan_percent_token(&lexer, valid_symbols));
  ASSERT_EQ(TT_COMMENT, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_percent_token_directive() {
  printf("test_scan_percent_token_directive... ");
  TSLexer lexer = create_test_lexer("%%scale 0.75\n");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_STYLESHEET_DIRECTIVE);
  ASSERT_TRUE(scan_percent_token(&lexer, valid_symbols));
  ASSERT_EQ(TT_STYLESHEET_DIRECTIVE, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_percent_token_not_percent() {
  printf("test_scan_percent_token_not_percent... ");
  TSLexer lexer = create_test_lexer("A");
  bool valid_symbols[TT_COUNT];
  enable_all_symbols(valid_symbols);
  ASSERT_FALSE(scan_percent_token(&lexer, valid_symbols));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_percent_token_comment_stops_at_newline() {
  printf("test_scan_percent_token_comment_stops_at_newline... ");
  TSLexer lexer = create_test_lexer("%hello\nworld");
  bool valid_symbols[TT_COUNT];
  enable_symbols(valid_symbols, 1, TT_COMMENT);
  ASSERT_TRUE(scan_percent_token(&lexer, valid_symbols));
  ASSERT_EQ(6, get_current_pos());  // %hello consumed, \n not
  TEST_PASS();
}

// ============================================================================
// scan_voice tests
// ============================================================================

void test_scan_voice_valid() {
  printf("test_scan_voice_valid... ");
  TSLexer lexer = create_test_lexer("&");
  ASSERT_TRUE(scan_voice(&lexer));
  ASSERT_EQ(TT_VOICE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_voice_invalid() {
  printf("test_scan_voice_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_voice(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Info Scanner Tests ===\n\n");

  test_scan_info_header_X();
  test_scan_info_header_T();
  test_scan_info_header_K();
  test_scan_info_header_not_alpha();
  test_scan_info_header_no_colon();
  test_scan_info_header_no_colon_no_fallback();

  test_scan_info_string_simple();
  test_scan_info_string_with_spaces();
  test_scan_info_string_stops_at_newline();
  test_scan_info_string_empty();

  test_scan_info_continuation_valid();
  test_scan_info_continuation_with_ws();
  test_scan_info_continuation_no_colon();
  test_scan_info_continuation_invalid();

  test_scan_percent_token_comment();
  test_scan_percent_token_directive();
  test_scan_percent_token_not_percent();
  test_scan_percent_token_comment_stops_at_newline();

  test_scan_voice_valid();
  test_scan_voice_invalid();

  printf("\n=== All info tests passed ===\n\n");
  return 0;
}
