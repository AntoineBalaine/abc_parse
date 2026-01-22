#include "test_harness.h"

// ============================================================================
// scan_user_symbol_header tests
// ============================================================================

void test_scan_user_symbol_header_valid() {
  printf("test_scan_user_symbol_header_valid... ");
  TSLexer lexer = create_test_lexer("U:");
  ASSERT_TRUE(scan_user_symbol_header(&lexer));
  ASSERT_EQ(TT_USER_SY_HDR, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_user_symbol_header_with_ws() {
  printf("test_scan_user_symbol_header_with_ws... ");
  TSLexer lexer = create_test_lexer("U :");
  ASSERT_TRUE(scan_user_symbol_header(&lexer));
  ASSERT_EQ(TT_USER_SY_HDR, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_user_symbol_header_no_colon() {
  printf("test_scan_user_symbol_header_no_colon... ");
  TSLexer lexer = create_test_lexer("UA");
  ASSERT_FALSE(scan_user_symbol_header(&lexer));
  TEST_PASS();
}

void test_scan_user_symbol_header_wrong_letter() {
  printf("test_scan_user_symbol_header_wrong_letter... ");
  TSLexer lexer = create_test_lexer("A:");
  ASSERT_FALSE(scan_user_symbol_header(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_user_symbol tests
// ============================================================================

void test_scan_user_symbol_lowercase() {
  printf("test_scan_user_symbol_lowercase... ");
  const char* valid[] = {"h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w"};
  for (int i = 0; i < 16; i++) {
    TSLexer lexer = create_test_lexer(valid[i]);
    ASSERT_TRUE(scan_user_symbol(&lexer));
    ASSERT_EQ(TT_USER_SY, lexer.result_symbol);
    ASSERT_EQ(1, get_current_pos());
  }
  TEST_PASS();
}

void test_scan_user_symbol_uppercase() {
  printf("test_scan_user_symbol_uppercase... ");
  const char* valid[] = {"H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W"};
  for (int i = 0; i < 16; i++) {
    TSLexer lexer = create_test_lexer(valid[i]);
    ASSERT_TRUE(scan_user_symbol(&lexer));
    ASSERT_EQ(TT_USER_SY, lexer.result_symbol);
  }
  TEST_PASS();
}

void test_scan_user_symbol_tilde() {
  printf("test_scan_user_symbol_tilde... ");
  TSLexer lexer = create_test_lexer("~");
  ASSERT_TRUE(scan_user_symbol(&lexer));
  ASSERT_EQ(TT_USER_SY, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_user_symbol_invalid() {
  printf("test_scan_user_symbol_invalid... ");
  // a-g are note letters, not user symbols
  TSLexer lexer = create_test_lexer("a");
  ASSERT_FALSE(scan_user_symbol(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_user_symbol_invocation tests
// ============================================================================

void test_scan_user_symbol_invocation_valid() {
  printf("test_scan_user_symbol_invocation_valid... ");
  TSLexer lexer = create_test_lexer("h");
  ASSERT_TRUE(scan_user_symbol_invocation(&lexer));
  ASSERT_EQ(TT_USER_SY_INVOCATION, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_user_symbol_invocation_invalid() {
  printf("test_scan_user_symbol_invocation_invalid... ");
  TSLexer lexer = create_test_lexer("a");
  ASSERT_FALSE(scan_user_symbol_invocation(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_macro_header tests
// ============================================================================

void test_scan_macro_header_valid() {
  printf("test_scan_macro_header_valid... ");
  TSLexer lexer = create_test_lexer("m:");
  ASSERT_TRUE(scan_macro_header(&lexer));
  ASSERT_EQ(TT_MACRO_HDR, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_header_with_ws() {
  printf("test_scan_macro_header_with_ws... ");
  TSLexer lexer = create_test_lexer("m :");
  ASSERT_TRUE(scan_macro_header(&lexer));
  ASSERT_EQ(TT_MACRO_HDR, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_header_no_colon() {
  printf("test_scan_macro_header_no_colon... ");
  TSLexer lexer = create_test_lexer("mA");
  ASSERT_FALSE(scan_macro_header(&lexer));
  TEST_PASS();
}

void test_scan_macro_header_wrong_letter() {
  printf("test_scan_macro_header_wrong_letter... ");
  TSLexer lexer = create_test_lexer("A:");
  ASSERT_FALSE(scan_macro_header(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_macro_var tests
// ============================================================================

void test_scan_macro_var_single() {
  printf("test_scan_macro_var_single... ");
  TSLexer lexer = create_test_lexer("n");
  ASSERT_TRUE(scan_macro_var(&lexer));
  ASSERT_EQ(TT_MACRO_VAR, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_var_multi() {
  printf("test_scan_macro_var_multi... ");
  TSLexer lexer = create_test_lexer("abc");
  ASSERT_TRUE(scan_macro_var(&lexer));
  ASSERT_EQ(TT_MACRO_VAR, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_var_with_digits() {
  printf("test_scan_macro_var_with_digits... ");
  TSLexer lexer = create_test_lexer("n123");
  ASSERT_TRUE(scan_macro_var(&lexer));
  ASSERT_EQ(TT_MACRO_VAR, lexer.result_symbol);
  ASSERT_EQ(4, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_var_tilde() {
  printf("test_scan_macro_var_tilde... ");
  TSLexer lexer = create_test_lexer("~");
  ASSERT_TRUE(scan_macro_var(&lexer));
  ASSERT_EQ(TT_MACRO_VAR, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_macro_var_excludes_y() {
  printf("test_scan_macro_var_excludes_y... ");
  // 'y' is reserved for y-spacer, so the var stops before it
  TSLexer lexer = create_test_lexer("ay");
  ASSERT_TRUE(scan_macro_var(&lexer));
  ASSERT_EQ(1, get_current_pos());  // Only 'a' consumed
  TEST_PASS();
}

void test_scan_macro_var_invalid() {
  printf("test_scan_macro_var_invalid... ");
  // 'y' alone is not valid start
  TSLexer lexer = create_test_lexer("y");
  ASSERT_FALSE(scan_macro_var(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_macro_string tests
// ============================================================================

void test_scan_macro_string_simple() {
  printf("test_scan_macro_string_simple... ");
  TSLexer lexer = create_test_lexer("content here");
  ASSERT_TRUE(scan_macro_string(&lexer));
  ASSERT_EQ(TT_MACRO_STR, lexer.result_symbol);
  ASSERT_EQ(12, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_string_stops_at_newline() {
  printf("test_scan_macro_string_stops_at_newline... ");
  TSLexer lexer = create_test_lexer("content\nnext");
  ASSERT_TRUE(scan_macro_string(&lexer));
  ASSERT_EQ(7, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_string_stops_at_percent() {
  printf("test_scan_macro_string_stops_at_percent... ");
  TSLexer lexer = create_test_lexer("content%comment");
  ASSERT_TRUE(scan_macro_string(&lexer));
  ASSERT_EQ(7, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_string_empty() {
  printf("test_scan_macro_string_empty... ");
  TSLexer lexer = create_test_lexer("\n");
  ASSERT_FALSE(scan_macro_string(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_macro_invocation tests
// ============================================================================

void test_scan_macro_invocation_single() {
  printf("test_scan_macro_invocation_single... ");
  TSLexer lexer = create_test_lexer("n");
  ASSERT_TRUE(scan_macro_invocation(&lexer));
  ASSERT_EQ(TT_MACRO_INVOCATION, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_invocation_multi() {
  printf("test_scan_macro_invocation_multi... ");
  TSLexer lexer = create_test_lexer("abc");
  ASSERT_TRUE(scan_macro_invocation(&lexer));
  ASSERT_EQ(TT_MACRO_INVOCATION, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_macro_invocation_invalid() {
  printf("test_scan_macro_invocation_invalid... ");
  TSLexer lexer = create_test_lexer("y");
  ASSERT_FALSE(scan_macro_invocation(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== User Symbol/Macro Scanner Tests ===\n\n");

  test_scan_user_symbol_header_valid();
  test_scan_user_symbol_header_with_ws();
  test_scan_user_symbol_header_no_colon();
  test_scan_user_symbol_header_wrong_letter();

  test_scan_user_symbol_lowercase();
  test_scan_user_symbol_uppercase();
  test_scan_user_symbol_tilde();
  test_scan_user_symbol_invalid();

  test_scan_user_symbol_invocation_valid();
  test_scan_user_symbol_invocation_invalid();

  test_scan_macro_header_valid();
  test_scan_macro_header_with_ws();
  test_scan_macro_header_no_colon();
  test_scan_macro_header_wrong_letter();

  test_scan_macro_var_single();
  test_scan_macro_var_multi();
  test_scan_macro_var_with_digits();
  test_scan_macro_var_tilde();
  test_scan_macro_var_excludes_y();
  test_scan_macro_var_invalid();

  test_scan_macro_string_simple();
  test_scan_macro_string_stops_at_newline();
  test_scan_macro_string_stops_at_percent();
  test_scan_macro_string_empty();

  test_scan_macro_invocation_single();
  test_scan_macro_invocation_multi();
  test_scan_macro_invocation_invalid();

  printf("\n=== All user symbol/macro tests passed ===\n\n");
  return 0;
}
