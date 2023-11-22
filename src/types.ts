export enum TokenType {
  APOSTROPHE,
  ANTISLASH_EOL,
  BARLINE, //|
  BAR_COLON, // |:
  BAR_DBL, // ||
  BAR_DIGIT, // |1
  BAR_RIGHTBRKT, // |]
  COLON, // :
  COLON_BAR, // :|
  COLON_BAR_DIGIT, // :|1
  COLON_DBL, // ::
  COMMA, //,,,,,,
  COMMENT,
  DOLLAR, //$
  DOT,
  EOF,
  EOL,
  FLAT, // ♭
  FLAT_DBL, // 𝄫
  GREATER, //>>>>>
  LEFTBRKT_BAR, // [|
  LEFTBRKT_NUMBER, // [number
  LEFT_BRACE, // {
  LEFTBRKT, // [
  LEFTPAREN, // (
  LEFTPAREN_NUMBER, // (1
  LESS, // <<<<<
  NOTE_LETTER,
  LETTER,
  LETTER_COLON,
  MINUS, //-
  NATURAL, // ♮
  NUMBER,
  PLUS, //+
  PLUS_COLON, //+: - extending info line
  RESERVED_CHAR,
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

/**
 * these are ripped off vscode's typescript definitions
 */
export type Position = {
  /**
   * The zero-based line value.
   */
  line: number;
  /**
   * The zero-based character value.
   */
  character: number;
};

export type Range = {

  /**
   * The start position. It is before or equal to [end](#Range.end).
   */
  start: Position;

  /**
   * The end position. It is after or equal to [start](#Range.start).
   */
  end: Position;
};