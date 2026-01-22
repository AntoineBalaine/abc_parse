/**
 * Minimal tree-sitter parser.h stub for testing the external scanner.
 * Provides only the types needed by scanner.h and scanner.c.
 */
#ifndef TREE_SITTER_PARSER_H_
#define TREE_SITTER_PARSER_H_

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

typedef uint16_t TSSymbol;
typedef uint16_t TSStateId;

typedef struct TSLexer TSLexer;

struct TSLexer {
  int32_t lookahead;
  TSSymbol result_symbol;
  void (*advance)(TSLexer *, bool);
  void (*mark_end)(TSLexer *);
  uint32_t (*get_column)(TSLexer *);
  bool (*eof)(const TSLexer *);
};

#endif // TREE_SITTER_PARSER_H_
