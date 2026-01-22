#include "test_harness.h"

// ============================================================================
// scan_equals tests
// ============================================================================

void test_scan_equals_valid() {
  printf("test_scan_equals_valid... ");
  TSLexer lexer = create_test_lexer("=");
  ASSERT_TRUE(scan_equals(&lexer));
  ASSERT_EQ(TT_EQL, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_equals_invalid() {
  printf("test_scan_equals_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_equals(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_slash tests
// ============================================================================

void test_scan_slash_valid() {
  printf("test_scan_slash_valid... ");
  TSLexer lexer = create_test_lexer("/");
  ASSERT_TRUE(scan_slash(&lexer));
  ASSERT_EQ(TT_SLASH, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_slash_invalid() {
  printf("test_scan_slash_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_slash(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_minus tests
// ============================================================================

void test_scan_minus_valid() {
  printf("test_scan_minus_valid... ");
  TSLexer lexer = create_test_lexer("-");
  ASSERT_TRUE(scan_minus(&lexer));
  ASSERT_EQ(TT_MINUS, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_minus_invalid() {
  printf("test_scan_minus_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_minus(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_plus tests
// ============================================================================

void test_scan_plus_valid() {
  printf("test_scan_plus_valid... ");
  TSLexer lexer = create_test_lexer("+");
  ASSERT_TRUE(scan_plus(&lexer));
  ASSERT_EQ(TT_PLUS, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_plus_invalid() {
  printf("test_scan_plus_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_plus(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_lparen tests
// ============================================================================

void test_scan_lparen_valid() {
  printf("test_scan_lparen_valid... ");
  TSLexer lexer = create_test_lexer("(");
  ASSERT_TRUE(scan_lparen(&lexer));
  ASSERT_EQ(TT_LPAREN, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_lparen_invalid() {
  printf("test_scan_lparen_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_lparen(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_rparen tests
// ============================================================================

void test_scan_rparen_valid() {
  printf("test_scan_rparen_valid... ");
  TSLexer lexer = create_test_lexer(")");
  ASSERT_TRUE(scan_rparen(&lexer));
  ASSERT_EQ(TT_RPAREN, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_rparen_invalid() {
  printf("test_scan_rparen_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_rparen(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_lbrace tests
// ============================================================================

void test_scan_lbrace_valid() {
  printf("test_scan_lbrace_valid... ");
  TSLexer lexer = create_test_lexer("{");
  ASSERT_TRUE(scan_lbrace(&lexer));
  ASSERT_EQ(TT_LBRACE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_lbrace_invalid() {
  printf("test_scan_lbrace_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_lbrace(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_rbrace tests
// ============================================================================

void test_scan_rbrace_valid() {
  printf("test_scan_rbrace_valid... ");
  TSLexer lexer = create_test_lexer("}");
  ASSERT_TRUE(scan_rbrace(&lexer));
  ASSERT_EQ(TT_RBRACE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_rbrace_invalid() {
  printf("test_scan_rbrace_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_rbrace(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_lbracket tests
// ============================================================================

void test_scan_lbracket_valid() {
  printf("test_scan_lbracket_valid... ");
  TSLexer lexer = create_test_lexer("[");
  ASSERT_TRUE(scan_lbracket(&lexer));
  ASSERT_EQ(TT_LBRACKET, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_lbracket_invalid() {
  printf("test_scan_lbracket_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_lbracket(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_rbracket tests
// ============================================================================

void test_scan_rbracket_valid() {
  printf("test_scan_rbracket_valid... ");
  TSLexer lexer = create_test_lexer("]");
  ASSERT_TRUE(scan_rbracket(&lexer));
  ASSERT_EQ(TT_RBRACKET, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_rbracket_invalid() {
  printf("test_scan_rbracket_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_rbracket(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_pipe tests
// ============================================================================

void test_scan_pipe_valid() {
  printf("test_scan_pipe_valid... ");
  TSLexer lexer = create_test_lexer("|");
  ASSERT_TRUE(scan_pipe(&lexer));
  ASSERT_EQ(TT_PIPE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_pipe_invalid() {
  printf("test_scan_pipe_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_pipe(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_reserved_char tests
// ============================================================================

void test_scan_reserved_char_hash() {
  printf("test_scan_reserved_char_hash... ");
  TSLexer lexer = create_test_lexer("#");
  ASSERT_TRUE(scan_reserved_char(&lexer));
  ASSERT_EQ(TT_RESERVED_CHAR, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_reserved_char_semicolon() {
  printf("test_scan_reserved_char_semicolon... ");
  TSLexer lexer = create_test_lexer(";");
  ASSERT_TRUE(scan_reserved_char(&lexer));
  ASSERT_EQ(TT_RESERVED_CHAR, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_reserved_char_question() {
  printf("test_scan_reserved_char_question... ");
  TSLexer lexer = create_test_lexer("?");
  ASSERT_TRUE(scan_reserved_char(&lexer));
  ASSERT_EQ(TT_RESERVED_CHAR, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_reserved_char_at() {
  printf("test_scan_reserved_char_at... ");
  TSLexer lexer = create_test_lexer("@");
  ASSERT_TRUE(scan_reserved_char(&lexer));
  ASSERT_EQ(TT_RESERVED_CHAR, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_reserved_char_invalid() {
  printf("test_scan_reserved_char_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_reserved_char(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_invalid tests
// ============================================================================

void test_scan_invalid_consumes_one() {
  printf("test_scan_invalid_consumes_one... ");
  TSLexer lexer = create_test_lexer("Z");
  ASSERT_TRUE(scan_invalid(&lexer));
  ASSERT_EQ(TT_INVALID, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_invalid_eof() {
  printf("test_scan_invalid_eof... ");
  TSLexer lexer = create_test_lexer("");
  ASSERT_FALSE(scan_invalid(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Punctuation Scanner Tests ===\n\n");

  test_scan_equals_valid();
  test_scan_equals_invalid();

  test_scan_slash_valid();
  test_scan_slash_invalid();

  test_scan_minus_valid();
  test_scan_minus_invalid();

  test_scan_plus_valid();
  test_scan_plus_invalid();

  test_scan_lparen_valid();
  test_scan_lparen_invalid();

  test_scan_rparen_valid();
  test_scan_rparen_invalid();

  test_scan_lbrace_valid();
  test_scan_lbrace_invalid();

  test_scan_rbrace_valid();
  test_scan_rbrace_invalid();

  test_scan_lbracket_valid();
  test_scan_lbracket_invalid();

  test_scan_rbracket_valid();
  test_scan_rbracket_invalid();

  test_scan_pipe_valid();
  test_scan_pipe_invalid();

  test_scan_reserved_char_hash();
  test_scan_reserved_char_semicolon();
  test_scan_reserved_char_question();
  test_scan_reserved_char_at();
  test_scan_reserved_char_invalid();

  test_scan_invalid_consumes_one();
  test_scan_invalid_eof();

  printf("\n=== All punctuation tests passed ===\n\n");
  return 0;
}
