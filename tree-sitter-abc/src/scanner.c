/**
 * TreeSitter external scanner for ABC music notation
 *
 * This scanner mirrors the architecture of the TypeScript scanner in
 * parse/parsers/scan2.ts, using a context struct and boolean sub-functions.
 *
 * Full implementation in Phase 2B - this is a minimal stub for build setup.
 */

#include "scanner.h"

// TreeSitter external scanner API functions

/**
 * Called once when the parser is created.
 * Allocates and initializes the scanner context.
 */
void *tree_sitter_abc_external_scanner_create(void) {
  ScanCtx *ctx = malloc(sizeof(ScanCtx));
  if (!ctx) return NULL;

  memset(ctx, 0, sizeof(ScanCtx));
  ctx->macros = stringmap_create();
  ctx->user_symbols = stringmap_create();
  // Pattern initialization deferred to Phase 2B
  // ctx_init_patterns(ctx);

  return ctx;
}

/**
 * Called once when the parser is destroyed.
 * Frees all allocated resources.
 */
void tree_sitter_abc_external_scanner_destroy(void *payload) {
  ScanCtx *ctx = (ScanCtx *)payload;
  if (!ctx) return;

  if (ctx->source) {
    free((void *)ctx->source);
  }
  if (ctx->macros) {
    stringmap_free(ctx->macros);
  }
  if (ctx->user_symbols) {
    stringmap_free(ctx->user_symbols);
  }
  // Pattern cleanup deferred to Phase 2B
  // ctx_free_patterns(ctx);

  free(ctx);
}

/**
 * Serializes the scanner state to a buffer.
 * Called by TreeSitter for incremental parsing.
 */
unsigned tree_sitter_abc_external_scanner_serialize(
  void *payload,
  char *buffer
) {
  ScanCtx *ctx = (ScanCtx *)payload;
  unsigned pos = 0;

  // Fixed state (4 bytes)
  buffer[pos++] = ctx->in_text_block;
  buffer[pos++] = ctx->in_tune_body;
  buffer[pos++] = (ctx->line >> 8) & 0xFF;
  buffer[pos++] = ctx->line & 0xFF;

  // Full macro/user-symbol serialization deferred to Phase 2B
  // For now, just store the count as 0
  buffer[pos++] = 0;  // macro_count
  buffer[pos++] = 0;  // user_symbol_count

  return pos;
}

/**
 * Deserializes the scanner state from a buffer.
 * Called by TreeSitter for incremental parsing.
 */
void tree_sitter_abc_external_scanner_deserialize(
  void *payload,
  const char *buffer,
  unsigned length
) {
  ScanCtx *ctx = (ScanCtx *)payload;
  if (length < 6) return;  // Match serialize output size (4 fixed + 2 counts)

  unsigned pos = 0;
  ctx->in_text_block = buffer[pos++];
  ctx->in_tune_body = buffer[pos++];
  ctx->line = (buffer[pos] << 8) | buffer[pos + 1];
  pos += 2;

  // Full macro/user-symbol deserialization deferred to Phase 2B
}

/**
 * Main scan function - called by TreeSitter for each token.
 * Returns true if a token was matched, false otherwise.
 */
bool tree_sitter_abc_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  ScanCtx *ctx = (ScanCtx *)payload;
  ctx->lexer = lexer;

  // Skip leading whitespace for now
  // Full implementation in Phase 2B

  // Minimal stub: just return false (no token matched)
  // The grammar will handle basic structure
  return false;
}

// String map implementation

StringMap *stringmap_create(void) {
  StringMap *map = malloc(sizeof(StringMap));
  if (map) {
    map->head = NULL;
  }
  return map;
}

void stringmap_free(StringMap *map) {
  if (!map) return;
  stringmap_clear(map);
  free(map);
}

void stringmap_clear(StringMap *map) {
  if (!map) return;
  StringMapEntry *entry = map->head;
  while (entry) {
    StringMapEntry *next = entry->next;
    free(entry->key);
    free(entry->value);
    free(entry);
    entry = next;
  }
  map->head = NULL;
}

void stringmap_set(StringMap *map, const char *key, const char *value) {
  if (!map || !key || !value) return;

  // Check if key exists
  for (StringMapEntry *entry = map->head; entry; entry = entry->next) {
    if (strcmp(entry->key, key) == 0) {
      free(entry->value);
      entry->value = strdup(value);
      return;
    }
  }

  // Add new entry
  StringMapEntry *entry = malloc(sizeof(StringMapEntry));
  if (!entry) return;
  entry->key = strdup(key);
  entry->value = strdup(value);
  if (!entry->key || !entry->value) {
    free(entry->key);    // Safe: free(NULL) is valid
    free(entry->value);
    free(entry);
    return;
  }
  entry->next = map->head;
  map->head = entry;
}

const char *stringmap_get(StringMap *map, const char *key) {
  if (!map || !key) return NULL;
  for (StringMapEntry *entry = map->head; entry; entry = entry->next) {
    if (strcmp(entry->key, key) == 0) {
      return entry->value;
    }
  }
  return NULL;
}

// Context operations - stubs for Phase 1, full implementation in Phase 2B

void ctx_init(ScanCtx *ctx, TSLexer *lexer) {
  ctx->lexer = lexer;
  ctx->start = 0;
  ctx->current = 0;
  ctx->line = 0;
  ctx->line_start = 0;
  ctx->in_text_block = false;
  ctx->in_tune_body = false;
}

bool ctx_test_char(ScanCtx *ctx, char c) {
  if (ctx->current >= ctx->source_len) return false;
  return ctx->source[ctx->current] == c;
}

bool ctx_test_str(ScanCtx *ctx, const char *str) {
  size_t len = strlen(str);
  if (ctx->current + len > ctx->source_len) return false;
  return strncmp(&ctx->source[ctx->current], str, len) == 0;
}

bool ctx_test_charset(ScanCtx *ctx, const char *charset) {
  if (ctx->current >= ctx->source_len) return false;
  return strchr(charset, ctx->source[ctx->current]) != NULL;
}

void ctx_advance(ScanCtx *ctx, size_t count) {
  ctx->current += count;
}

char ctx_peek(ScanCtx *ctx) {
  if (ctx->current >= ctx->source_len) return '\0';
  return ctx->source[ctx->current];
}

char ctx_peek_next(ScanCtx *ctx) {
  if (ctx->current + 1 >= ctx->source_len) return '\0';
  return ctx->source[ctx->current + 1];
}

bool ctx_is_at_end(ScanCtx *ctx) {
  return ctx->current >= ctx->source_len;
}

void ctx_emit(ScanCtx *ctx, TokenType type) {
  size_t chars_to_advance = ctx->current - ctx->start;
  for (size_t i = 0; i < chars_to_advance; i++) {
    ctx->lexer->advance(ctx->lexer, false);
  }
  ctx->lexer->mark_end(ctx->lexer);
  ctx->lexer->result_symbol = type;
  ctx->start = ctx->current;
}

// Pattern and sub-scanner stubs - will be implemented in Phase 2B
void ctx_init_patterns(ScanCtx *ctx) { (void)ctx; }
void ctx_free_patterns(ScanCtx *ctx) { (void)ctx; }
bool ctx_test_regex(ScanCtx *ctx, PatternId pat) { (void)ctx; (void)pat; return false; }
size_t ctx_match_regex(ScanCtx *ctx, PatternId pat) { (void)ctx; (void)pat; return 0; }

bool scan_comment(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_ws(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_eol(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_annotation(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_inline_field(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_chord(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_grace_group(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_tuplet(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_barline(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_decoration(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_note(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_pitch(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_rhythm(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_rest(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_tie(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_slur(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_symbol(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_ampersand(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_line_continuation(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_info_line(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_lyric_line(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_symbol_line(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_directive(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_system_break(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_y_spacer(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_bcktck_spacer(ScanCtx *ctx) { (void)ctx; return false; }
bool scan_repeat_numbers(ScanCtx *ctx) { (void)ctx; return false; }
bool collect_invalid_token(ScanCtx *ctx) { (void)ctx; return false; }
bool is_recovery_point(ScanCtx *ctx) { (void)ctx; return false; }
