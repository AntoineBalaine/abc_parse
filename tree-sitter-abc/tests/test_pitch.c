#include "test_harness.h"

// ============================================================================
// scan_note_letter tests
// ============================================================================

void test_scan_note_letter_valid() {
  printf("test_scan_note_letter_valid... ");
  const char* valid[] = {"a", "b", "c", "d", "e", "f", "g", "A", "B", "C", "D", "E", "F", "G"};
  for (int i = 0; i < 14; i++) {
    TSLexer lexer = create_test_lexer(valid[i]);
    ASSERT_TRUE(scan_note_letter(&lexer));
    ASSERT_EQ(TT_NOTE_LETTER, lexer.result_symbol);
    ASSERT_EQ(1, get_current_pos());
  }
  TEST_PASS();
}

void test_scan_note_letter_invalid() {
  printf("test_scan_note_letter_invalid... ");
  const char* invalid[] = {"h", "H", "1", "|", " ", "z", "x", "y"};
  for (int i = 0; i < 8; i++) {
    TSLexer lexer = create_test_lexer(invalid[i]);
    ASSERT_FALSE(scan_note_letter(&lexer));
    ASSERT_EQ(0, get_current_pos());
  }
  TEST_PASS();
}

void test_scan_note_letter_only_first() {
  printf("test_scan_note_letter_only_first... ");
  // Only consumes one letter
  TSLexer lexer = create_test_lexer("AB");
  ASSERT_TRUE(scan_note_letter(&lexer));
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_accidental tests
// ============================================================================

void test_scan_accidental_sharp() {
  printf("test_scan_accidental_sharp... ");
  TSLexer lexer = create_test_lexer("^A");
  ASSERT_TRUE(scan_accidental(&lexer));
  ASSERT_EQ(TT_ACCIDENTAL, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_accidental_double_sharp() {
  printf("test_scan_accidental_double_sharp... ");
  TSLexer lexer = create_test_lexer("^^A");
  ASSERT_TRUE(scan_accidental(&lexer));
  ASSERT_EQ(TT_ACCIDENTAL, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_accidental_half_sharp() {
  printf("test_scan_accidental_half_sharp... ");
  TSLexer lexer = create_test_lexer("^/A");
  ASSERT_TRUE(scan_accidental(&lexer));
  ASSERT_EQ(TT_ACCIDENTAL, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_accidental_flat() {
  printf("test_scan_accidental_flat... ");
  TSLexer lexer = create_test_lexer("_A");
  ASSERT_TRUE(scan_accidental(&lexer));
  ASSERT_EQ(TT_ACCIDENTAL, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_accidental_double_flat() {
  printf("test_scan_accidental_double_flat... ");
  TSLexer lexer = create_test_lexer("__A");
  ASSERT_TRUE(scan_accidental(&lexer));
  ASSERT_EQ(TT_ACCIDENTAL, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_accidental_half_flat() {
  printf("test_scan_accidental_half_flat... ");
  TSLexer lexer = create_test_lexer("_/A");
  ASSERT_TRUE(scan_accidental(&lexer));
  ASSERT_EQ(TT_ACCIDENTAL, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_accidental_natural() {
  printf("test_scan_accidental_natural... ");
  TSLexer lexer = create_test_lexer("=A");
  ASSERT_TRUE(scan_accidental(&lexer));
  ASSERT_EQ(TT_ACCIDENTAL, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_accidental_invalid() {
  printf("test_scan_accidental_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_accidental(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_octave tests
// ============================================================================

void test_scan_octave_up_single() {
  printf("test_scan_octave_up_single... ");
  TSLexer lexer = create_test_lexer("'");
  ASSERT_TRUE(scan_octave(&lexer));
  ASSERT_EQ(TT_OCTAVE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_octave_up_multiple() {
  printf("test_scan_octave_up_multiple... ");
  TSLexer lexer = create_test_lexer("''");
  ASSERT_TRUE(scan_octave(&lexer));
  ASSERT_EQ(TT_OCTAVE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_octave_down_single() {
  printf("test_scan_octave_down_single... ");
  TSLexer lexer = create_test_lexer(",");
  ASSERT_TRUE(scan_octave(&lexer));
  ASSERT_EQ(TT_OCTAVE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_octave_down_multiple() {
  printf("test_scan_octave_down_multiple... ");
  TSLexer lexer = create_test_lexer(",,");
  ASSERT_TRUE(scan_octave(&lexer));
  ASSERT_EQ(TT_OCTAVE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());
  TEST_PASS();
}

void test_scan_octave_mixed() {
  printf("test_scan_octave_mixed... ");
  // Mixed markers: scanner consumes both (is_octave_char matches both ' and ,)
  // This is musically nonsensical but the scanner does not reject it
  TSLexer lexer = create_test_lexer("',");
  ASSERT_TRUE(scan_octave(&lexer));
  ASSERT_EQ(TT_OCTAVE, lexer.result_symbol);
  ASSERT_EQ(2, get_current_pos());  // Both consumed as a single octave token
  TEST_PASS();
}

void test_scan_octave_invalid() {
  printf("test_scan_octave_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_octave(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_rest tests
// ============================================================================

void test_scan_rest_valid() {
  printf("test_scan_rest_valid... ");
  const char* valid[] = {"z", "Z", "x", "X"};
  for (int i = 0; i < 4; i++) {
    TSLexer lexer = create_test_lexer(valid[i]);
    ASSERT_TRUE(scan_rest(&lexer));
    ASSERT_EQ(TT_REST, lexer.result_symbol);
    ASSERT_EQ(1, get_current_pos());
  }
  TEST_PASS();
}

void test_scan_rest_invalid() {
  printf("test_scan_rest_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_rest(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

void test_scan_rest_only_one() {
  printf("test_scan_rest_only_one... ");
  // Only consumes one rest char
  TSLexer lexer = create_test_lexer("zz");
  ASSERT_TRUE(scan_rest(&lexer));
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_tie tests
// ============================================================================

void test_scan_tie_valid() {
  printf("test_scan_tie_valid... ");
  TSLexer lexer = create_test_lexer("-");
  ASSERT_TRUE(scan_tie(&lexer));
  ASSERT_EQ(TT_TIE, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_tie_invalid() {
  printf("test_scan_tie_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_tie(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_decoration tests
// ============================================================================

void test_scan_decoration_dot() {
  printf("test_scan_decoration_dot... ");
  TSLexer lexer = create_test_lexer(".");
  ASSERT_TRUE(scan_decoration(&lexer));
  ASSERT_EQ(TT_DECORATION, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_decoration_tilde() {
  printf("test_scan_decoration_tilde... ");
  TSLexer lexer = create_test_lexer("~");
  ASSERT_TRUE(scan_decoration(&lexer));
  ASSERT_EQ(TT_DECORATION, lexer.result_symbol);
  TEST_PASS();
}

void test_scan_decoration_multiple() {
  printf("test_scan_decoration_multiple... ");
  // Multiple decoration chars consumed together
  TSLexer lexer = create_test_lexer("~.H");
  ASSERT_TRUE(scan_decoration(&lexer));
  ASSERT_EQ(TT_DECORATION, lexer.result_symbol);
  ASSERT_EQ(3, get_current_pos());
  TEST_PASS();
}

void test_scan_decoration_all_chars() {
  printf("test_scan_decoration_all_chars... ");
  // All valid decoration chars: . ~ H L M O P R S T u v
  const char* singles[] = {".", "~", "H", "L", "M", "O", "P", "R", "S", "T", "u", "v"};
  for (int i = 0; i < 12; i++) {
    TSLexer lexer = create_test_lexer(singles[i]);
    ASSERT_TRUE(scan_decoration(&lexer));
    ASSERT_EQ(TT_DECORATION, lexer.result_symbol);
  }
  TEST_PASS();
}

void test_scan_decoration_stops_at_non_deco() {
  printf("test_scan_decoration_stops_at_non_deco... ");
  TSLexer lexer = create_test_lexer(".A");
  ASSERT_TRUE(scan_decoration(&lexer));
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_decoration_invalid() {
  printf("test_scan_decoration_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_decoration(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// scan_slur tests
// ============================================================================

void test_scan_slur_open() {
  printf("test_scan_slur_open... ");
  TSLexer lexer = create_test_lexer("(");
  ASSERT_TRUE(scan_slur(&lexer));
  ASSERT_EQ(TT_SLUR, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_slur_close() {
  printf("test_scan_slur_close... ");
  TSLexer lexer = create_test_lexer(")");
  ASSERT_TRUE(scan_slur(&lexer));
  ASSERT_EQ(TT_SLUR, lexer.result_symbol);
  ASSERT_EQ(1, get_current_pos());
  TEST_PASS();
}

void test_scan_slur_invalid() {
  printf("test_scan_slur_invalid... ");
  TSLexer lexer = create_test_lexer("A");
  ASSERT_FALSE(scan_slur(&lexer));
  ASSERT_EQ(0, get_current_pos());
  TEST_PASS();
}

// ============================================================================
// Main
// ============================================================================

int main() {
  printf("\n=== Pitch/Note Scanner Tests ===\n\n");

  test_scan_note_letter_valid();
  test_scan_note_letter_invalid();
  test_scan_note_letter_only_first();

  test_scan_accidental_sharp();
  test_scan_accidental_double_sharp();
  test_scan_accidental_half_sharp();
  test_scan_accidental_flat();
  test_scan_accidental_double_flat();
  test_scan_accidental_half_flat();
  test_scan_accidental_natural();
  test_scan_accidental_invalid();

  test_scan_octave_up_single();
  test_scan_octave_up_multiple();
  test_scan_octave_down_single();
  test_scan_octave_down_multiple();
  test_scan_octave_mixed();
  test_scan_octave_invalid();

  test_scan_rest_valid();
  test_scan_rest_invalid();
  test_scan_rest_only_one();

  test_scan_tie_valid();
  test_scan_tie_invalid();

  test_scan_decoration_dot();
  test_scan_decoration_tilde();
  test_scan_decoration_multiple();
  test_scan_decoration_all_chars();
  test_scan_decoration_stops_at_non_deco();
  test_scan_decoration_invalid();

  test_scan_slur_open();
  test_scan_slur_close();
  test_scan_slur_invalid();

  printf("\n=== All pitch/note tests passed ===\n\n");
  return 0;
}
