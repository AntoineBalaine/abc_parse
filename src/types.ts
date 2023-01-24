export enum TokenType {
  ANTISLASH_EOL,
  BARLINE, //|
  BAR_COLON, // |:
  BAR_DBL, // ||
  BAR_RIGHTBRKT, // |]
  COLON, // :
  COLON_BAR, // :|
  COLON_DBL, // ::
  COMMA, //,,,,,,
  COMMENT,
  DOT,
  EOF,
  EOL,
  FLAT, // ♭
  FLAT_DBL, // 𝄫
  GREATER, //>>>>>
  LEFTBRKT_BAR, // [|
  LEFTBRKT_NUMBER, // [number
  LEFT_BRACE, // {
  /**
   * intégrer ici les inline info fields?
   */
  LEFTBRKT, // [
  LEFTPAREN, // (
  LEFTPAREN_NUMBER, // (
  LESS, // <<<<<
  /**
   * into default case
   */
  LETTER_LOWERCASE_COLON,
  LETTER_UPPERCASE_COLON,
  LETTER_LOWERCASE,
  LETTER_UPPERCASE,
  MINUS, //-
  NATURAL, // ♮
  NUMBER,
  PLUS, //+
  PLUS_COLON, //+
  RIGHT_BRACE, // }
  RIGHT_BRKT,
  RIGHT_PAREN, // )
  SHARP, // ♯
  SHARP_DBL, // 𝄪
  SLASH, // ////
  STRING, // any un-categorizable text
  STYLESHEET_DIRECTIVE, // %%
  SYMBOL, // ![a-zA-Z]!
  TILDE, // ~
  /**
   * # * ; ? @ are reserved symbols, treated as ws
   */
  WHITESPACE,
}
