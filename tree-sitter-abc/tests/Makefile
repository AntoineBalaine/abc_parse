CC = cc
CFLAGS = -I . -I ../src -Wall -Wextra -Wno-unused-function -Wno-unused-parameter

TESTS = test_whitespace test_pitch test_rhythm test_barline test_tuplet \
        test_bracket test_info test_symbol test_special test_lyrics \
        test_symbol_line test_repeat test_user_macro test_directive test_punctuation

.PHONY: test-scanner clean $(TESTS)

test-scanner: $(TESTS)
	@echo "=== All scanner tests passed ==="

$(TESTS): %: %.c test_harness.h ../src/scanner.c ../src/scanner.h
	$(CC) $(CFLAGS) -o $@ $<
	./$@

clean:
	rm -f $(TESTS)
