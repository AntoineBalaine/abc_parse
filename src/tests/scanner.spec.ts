import assert from "assert";
import { Scanner } from "../Scanner";
import { TokenType } from "../types";

// create a test for each token type
// create a test builder
const testBuilder = (
  tokenName: string,
  lexeme: string,
  tokenType: TokenType,
  result_literal: string | number | null = null,
  lineNumber: number = 0
) => {
  it(`should handle case "${lexeme}" ${tokenName}`, () => {
    let scanner = new Scanner(lexeme);
    const tokens = scanner.scanTokens();
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, tokenType);
    assert.equal(tokens[0].lexeme, lexeme);
    assert.equal(tokens[0].literal, result_literal);
    assert.equal(tokens[0].line, lineNumber);
  });
};

describe("Scanner", () => {
  describe("individual tokens", () => {
    testBuilder("APOSTROPHE", "'", TokenType.APOSTROPHE);
    testBuilder("ANTISLASH_EOL", "\\\n", TokenType.ANTISLASH_EOL);
    testBuilder("ESCAPED_CHAR", "\\e", TokenType.ESCAPED_CHAR);
    testBuilder("AMPERSAND", "&", TokenType.AMPERSAND);
    testBuilder("BARLINE", "|", TokenType.BARLINE);
    testBuilder("BAR_COLON", "|:", TokenType.BAR_COLON);
    testBuilder("BAR_DBL", "||", TokenType.BAR_DBL);
    testBuilder("BAR_DIGIT", "|1", TokenType.BAR_DIGIT);
    testBuilder("COLON", ":", TokenType.COLON);
    testBuilder("COLON_BAR", ":|", TokenType.COLON_BAR);
    testBuilder("COLON_BAR_DIGIT", ":|2", TokenType.COLON_BAR_DIGIT, null);
    testBuilder("COLON_DBL", "::", TokenType.COLON_DBL);
    testBuilder("COLON_NUMBER", ":1", TokenType.COLON_NUMBER);
    testBuilder("COMMA", ",", TokenType.COMMA);
    testBuilder("COMMENT", "%this is a comment", TokenType.COMMENT);
    testBuilder("DOT", ".", TokenType.DOT);
    testBuilder("EOL", "\n", TokenType.EOL, null, 0);
    testBuilder("FLAT", "_", TokenType.FLAT);
    testBuilder("FLAT_DBL", "__", TokenType.FLAT_DBL);
    testBuilder("GREATER", ">>>>", TokenType.GREATER);
    testBuilder("LEFTBRKT_BAR", "[|", TokenType.LEFTBRKT_BAR);
    testBuilder("LEFTBRKT_NUMBER", "[2", TokenType.LEFTBRKT_NUMBER);
    testBuilder("LEFT_BRACE", "{", TokenType.LEFT_BRACE);
    testBuilder("LEFTBRKT", "[", TokenType.LEFTBRKT);
    testBuilder("LEFTPAREN", "(", TokenType.LEFTPAREN);
    testBuilder("LEFTPAREN_NUMBER", "(1", TokenType.LEFTPAREN_NUMBER);
    testBuilder("LESS", "<<<<<", TokenType.LESS);
    testBuilder("NOTE_LETTER", "A", TokenType.NOTE_LETTER);
    testBuilder("LETTER", "W", TokenType.LETTER);
    testBuilder("LETTER_COLON", "X:", TokenType.LETTER_COLON);
    testBuilder("MINUS", "-", TokenType.MINUS);
    testBuilder("NUMBER", "1234", TokenType.NUMBER, 1234);
    testBuilder("PLUS", "+", TokenType.PLUS);
    testBuilder("PLUS_COLON", "+:", TokenType.PLUS_COLON);
    testBuilder("RIGHT_BRACE", "}", TokenType.RIGHT_BRACE);
    testBuilder("RIGHT_BRKT", "]", TokenType.RIGHT_BRKT);
    testBuilder("RIGHT_PAREN", ")", TokenType.RIGHT_PAREN);
    testBuilder("SHARP", "^", TokenType.SHARP);
    //testBuilder("SHARP", "♯", TokenType.SHARP)
    testBuilder("SHARP_DBL", "^^", TokenType.SHARP_DBL);
    /**
     * I am not including unicode characters
     * This would be a full rework to implement
     * using comparisons with the unicode points, as:
     * [...this.source][this.current]
     */
    //testBuilder("SHARP_DBL", "𝄪", TokenType.SHARP_DBL)
    //testBuilder("NATURAL", "♮", TokenType.NATURAL)
    //testBuilder("FLAT", "♭", TokenType.FLAT)
    //testBuilder("FLAT_DBL", "𝄫", TokenType.FLAT_DBL)

    testBuilder("SLASH", "//", TokenType.SLASH);
    testBuilder("STRING", '"string"', TokenType.STRING, "string");
    testBuilder("STYLESHEET_DIRECTIVE", "%%", TokenType.STYLESHEET_DIRECTIVE);
    testBuilder("SYMBOL", "![a-zA-Z]!", TokenType.SYMBOL);
    testBuilder("TILDE", "~", TokenType.TILDE);
    testBuilder("WHITESPACE", " ", TokenType.WHITESPACE);
  });
  describe("multiple tokens", () => {
    it("should handle info directive", () => {
      let scanner = new Scanner("X:1");
      const tokens = scanner.scanTokens();
      assert.equal(tokens.length, 3);
      assert.equal(tokens[0].type, TokenType.LETTER_COLON);
      assert.equal(tokens[0].lexeme, "X:");
      assert.equal(tokens[0].literal, null);
      assert.equal(tokens[0].line, 0);
      assert.equal(tokens[1].type, TokenType.NUMBER);
      assert.equal(tokens[1].lexeme, "1");
      assert.equal(tokens[1].literal, 1);
      assert.equal(tokens[1].line, 0);
    });
    it("should handle multiple tokens", () => {
      let scanner = new Scanner("A B");
      const tokens = scanner.scanTokens();
      assert.equal(tokens.length, 4);
      assert.equal(tokens[0].type, TokenType.NOTE_LETTER);
      assert.equal(tokens[0].lexeme, "A");
      assert.equal(tokens[0].literal, null);
      assert.equal(tokens[0].line, 0);
      assert.equal(tokens[1].type, TokenType.WHITESPACE);
      assert.equal(tokens[1].lexeme, " ");
      assert.equal(tokens[1].literal, null);
      assert.equal(tokens[1].line, 0);
      assert.equal(tokens[2].type, TokenType.NOTE_LETTER);
      assert.equal(tokens[2].lexeme, "B");
      assert.equal(tokens[2].literal, null);
      assert.equal(tokens[2].line, 0);
      assert.equal(tokens[3].type, TokenType.EOF);
      assert.equal(tokens[3].lexeme, "\n");
      assert.equal(tokens[3].literal, null);
      assert.equal(tokens[3].line, 0);
    });
    it("should handle multiple tokens with comments", () => {
      let scanner = new Scanner("A B %comment");
      const tokens = scanner.scanTokens();
      assert.equal(tokens.length, 6);
      assert.equal(tokens[0].type, TokenType.NOTE_LETTER);
      assert.equal(tokens[0].lexeme, "A");
      assert.equal(tokens[0].literal, null);
      assert.equal(tokens[0].line, 0);
      assert.equal(tokens[1].type, TokenType.WHITESPACE);
      assert.equal(tokens[1].lexeme, " ");
      assert.equal(tokens[1].literal, null);
      assert.equal(tokens[1].line, 0);
      assert.equal(tokens[2].type, TokenType.NOTE_LETTER);
      assert.equal(tokens[2].lexeme, "B");
      assert.equal(tokens[2].literal, null);
      assert.equal(tokens[2].line, 0);
      assert.equal(tokens[3].type, TokenType.WHITESPACE);
      assert.equal(tokens[3].lexeme, " ");
      assert.equal(tokens[3].literal, null);
      assert.equal(tokens[3].line, 0);
      assert.equal(tokens[4].type, TokenType.COMMENT);
      assert.equal(tokens[4].lexeme, "%comment");
      assert.equal(tokens[4].literal, null);
      assert.equal(tokens[4].line, 0);
    });
    it("should figure out the correct position for comments", () => {
      let scanner = new Scanner("A B\n%comment");
      const tokens = scanner.scanTokens();
      assert.equal(tokens[4].type, TokenType.COMMENT);
      assert.equal(tokens[4].lexeme, "%comment");
      assert.equal(tokens[4].literal, null);
      assert.equal(tokens[4].line, 1);
      assert.equal(tokens[4].position, 0);
    });
    it("should handle colon followed by a number, twice", () => {
      let scanner = new Scanner(":1:1");
      const tokens = scanner.scanTokens();
      assert.equal(tokens[0].type, TokenType.COLON_NUMBER);
      assert.equal(tokens[1].type, TokenType.COLON_NUMBER);
    });
    it("should handle double colon followed by a number", () => {
      let scanner = new Scanner("::1");
      const tokens = scanner.scanTokens();
      assert.equal(tokens[0].type, TokenType.COLON);
      assert.equal(tokens[1].type, TokenType.COLON_NUMBER);
    });

  });
  describe("special cases", () => {
    it("should handle any ASCII charaters", () => {
      let scanner = new Scanner("! ! #$&'()*+,-./0123456789:;<=>?@");
      const tokens = scanner.scanTokens();
      assert.equal(tokens.length, 23);
    });
    it("should handle meter", () => {
      let scanner = new Scanner("S:Copyright 1935, Chappell & Co, Inc\nM:4/4");
      const tokens = scanner.scanTokens();
      assert.equal(tokens.length, 38);
    });
  });
});
