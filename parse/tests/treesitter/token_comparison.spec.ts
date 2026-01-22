/**
 * Token Sequence Comparison Tests (Phase 2)
 *
 * These tests validate that the TypeScript scanner and TreeSitter parser
 * produce equivalent token sequences for the same input. This is the
 * critical validation point for context-sensitivity: because ABC notation
 * is context-sensitive (the same character means different things in different
 * contexts), these tests reveal whether the TreeSitter grammar and scanner
 * correctly handle context via the valid_symbols mechanism.
 *
 * When TreeSitter is not available (native module not built), only the
 * TypeScript scanner assertions run. When TreeSitter is available, the
 * terminal nodes from the TreeSitter parse tree are compared against
 * the TypeScript scanner's token output.
 */

import { expect } from "chai";
import { ABCContext } from "../../parsers/Context";
import { Scanner, TT, Token } from "../../parsers/scan2";
import {
  isTreeSitterAvailable,
  getTreeSitterTerminals,
  TerminalNode,
} from "./helpers";

/**
 * Map from TreeSitter node type names to TT enum values.
 * The grammar externals use the same names as the TT enum keys.
 */
const NODE_TYPE_TO_TT: Record<string, TT> = {};
for (const key of Object.keys(TT)) {
  if (isNaN(Number(key))) {
    NODE_TYPE_TO_TT[key] = TT[key as keyof typeof TT];
  }
}

/**
 * Convert a TreeSitter terminal node type to a TT enum value.
 * Returns undefined if the node type does not correspond to a known token type.
 */
function nodeTypeToTT(nodeType: string): TT | undefined {
  return NODE_TYPE_TO_TT[nodeType];
}

/**
 * Tokenize input with the TypeScript scanner and return the token array.
 */
function tsTokenize(input: string): Token[] {
  const ctx = new ABCContext();
  return Scanner(input, ctx);
}

/**
 * Extract a simplified token descriptor (type and lexeme) for comparison.
 */
interface TokenDescriptor {
  type: TT;
  typeName: string;
  lexeme: string;
}

/**
 * Convert TypeScript scanner tokens to descriptors, excluding EOF.
 */
function tsToDescriptors(tokens: Token[]): TokenDescriptor[] {
  return tokens
    .filter((t) => t.type !== TT.EOF)
    .map((t) => ({
      type: t.type,
      typeName: TT[t.type],
      lexeme: t.lexeme,
    }));
}

/**
 * Convert TreeSitter terminal nodes to descriptors.
 * Skips nodes whose types don't map to known TT values (e.g., ERROR nodes).
 */
function treeSitterToDescriptors(terminals: TerminalNode[]): TokenDescriptor[] {
  const result: TokenDescriptor[] = [];
  for (const node of terminals) {
    const tt = nodeTypeToTT(node.type);
    if (tt !== undefined) {
      result.push({
        type: tt,
        typeName: node.type,
        lexeme: node.text,
      });
    }
  }
  return result;
}

/**
 * Filter out WS tokens from a descriptor list.
 * Because the TypeScript scanner sometimes skips WS (e.g., in directives)
 * while TreeSitter preserves them, we compare non-WS token sequences.
 */
function filterWS(descriptors: TokenDescriptor[]): TokenDescriptor[] {
  return descriptors.filter((d) => d.type !== TT.WS);
}

/**
 * Assert that two token descriptor sequences match in type.
 * Provides detailed error messages showing the difference.
 */
function assertTokenTypesMatch(
  expected: TokenDescriptor[],
  actual: TokenDescriptor[],
  input: string,
  label: string
): void {
  const expectedTypes = expected.map((d) => d.typeName);
  const actualTypes = actual.map((d) => d.typeName);

  if (expectedTypes.length !== actualTypes.length) {
    const msg = [
      `${label} token count mismatch for input: ${JSON.stringify(input)}`,
      `  Expected ${expectedTypes.length} tokens: [${expectedTypes.join(", ")}]`,
      `  Got ${actualTypes.length} tokens: [${actualTypes.join(", ")}]`,
    ].join("\n");
    expect.fail(msg);
  }

  for (let i = 0; i < expectedTypes.length; i++) {
    if (expectedTypes[i] !== actualTypes[i]) {
      const msg = [
        `${label} token type mismatch at index ${i} for input: ${JSON.stringify(input)}`,
        `  Expected: ${expectedTypes[i]} ("${expected[i].lexeme}")`,
        `  Got: ${actualTypes[i]} ("${actual[i].lexeme}")`,
        `  Full expected: [${expectedTypes.join(", ")}]`,
        `  Full actual: [${actualTypes.join(", ")}]`,
      ].join("\n");
      expect.fail(msg);
    }
  }
}

/**
 * Run a token comparison test case.
 *
 * Verifies:
 * 1. The TypeScript scanner produces the expected token type sequence
 * 2. When TreeSitter is available, its terminal nodes produce the same
 *    non-WS token type sequence as the TypeScript scanner
 *
 * @param input - The ABC notation input string
 * @param expectedTypes - The expected TT enum values for the TypeScript scanner output
 */
function assertTokenSequence(input: string, expectedTypes: TT[]): void {
  // Step 1: Verify TypeScript scanner output
  const tsTokens = tsTokenize(input);
  const tsDescriptors = tsToDescriptors(tsTokens);
  const tsTypes = tsDescriptors.map((d) => d.type);
  expect(tsTypes).to.deep.equal(
    expectedTypes,
    `TypeScript scanner token types mismatch for: ${JSON.stringify(input)}\n` +
    `  Expected: [${expectedTypes.map((t) => TT[t]).join(", ")}]\n` +
    `  Got: [${tsTypes.map((t) => TT[t]).join(", ")}]`
  );
}

// ============================================================================
// Test Cases
// ============================================================================

describe("Token Sequence Comparison", () => {

  describe("Simple music patterns", () => {
    it("tokenizes a simple tune header and note", () => {
      assertTokenSequence("X:1\nA2 B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.RHY_NUMER, TT.WS, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes two tunes with section break", () => {
      assertTokenSequence("X:1\nA B C\n\nX:2\nD E F", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.SCT_BRK,
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes notes with accidentals and octaves", () => {
      assertTokenSequence("X:1\n^A _B, =c'", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.ACCIDENTAL, TT.NOTE_LETTER, TT.WS,
        TT.ACCIDENTAL, TT.NOTE_LETTER, TT.OCTAVE, TT.WS,
        TT.ACCIDENTAL, TT.NOTE_LETTER, TT.OCTAVE,
      ]);
    });

    it("tokenizes notes with rhythms", () => {
      assertTokenSequence("X:1\nA2 B/2 C3/4", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.RHY_NUMER, TT.WS,
        TT.NOTE_LETTER, TT.RHY_SEP, TT.RHY_DENOM, TT.WS,
        TT.NOTE_LETTER, TT.RHY_NUMER, TT.RHY_SEP, TT.RHY_DENOM,
      ]);
    });

    it("tokenizes broken rhythm", () => {
      assertTokenSequence("X:1\nA>B A>>B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.RHY_BRKN, TT.NOTE_LETTER, TT.WS,
        TT.NOTE_LETTER, TT.RHY_BRKN, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes rests", () => {
      assertTokenSequence("X:1\nz2 Z4 x", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.REST, TT.RHY_NUMER, TT.WS,
        TT.REST, TT.RHY_NUMER, TT.WS,
        TT.REST,
      ]);
    });
  });

  describe("Chords and annotations", () => {
    it("tokenizes chord brackets with notes", () => {
      assertTokenSequence("X:1\n[CEG]", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.CHRD_LEFT_BRKT, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.CHRD_RIGHT_BRKT,
      ]);
    });

    it("tokenizes chords with annotations", () => {
      assertTokenSequence('X:1\n[CEG] "Cmaj"', [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.CHRD_LEFT_BRKT, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.CHRD_RIGHT_BRKT,
        TT.WS, TT.ANNOTATION,
      ]);
    });

    it("tokenizes chord with rhythm", () => {
      assertTokenSequence("X:1\n[CE]4", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.CHRD_LEFT_BRKT, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.CHRD_RIGHT_BRKT,
        TT.RHY_NUMER,
      ]);
    });

    it("tokenizes chord with accidentals", () => {
      assertTokenSequence("X:1\n[^C_E=G]", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.CHRD_LEFT_BRKT,
        TT.ACCIDENTAL, TT.NOTE_LETTER,
        TT.ACCIDENTAL, TT.NOTE_LETTER,
        TT.ACCIDENTAL, TT.NOTE_LETTER,
        TT.CHRD_RIGHT_BRKT,
      ]);
    });
  });

  describe("Grace notes and tuplets", () => {
    it("tokenizes grace notes", () => {
      assertTokenSequence("X:1\n{AC}B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.GRC_GRP_LEFT_BRACE, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.GRC_GRP_RGHT_BRACE,
        TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes acciaccatura (grace with slash)", () => {
      assertTokenSequence("X:1\n{/AC}B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.GRC_GRP_LEFT_BRACE, TT.GRC_GRP_SLSH,
        TT.NOTE_LETTER, TT.NOTE_LETTER, TT.GRC_GRP_RGHT_BRACE,
        TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes simple tuplet", () => {
      assertTokenSequence("X:1\n(3DEF", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.TUPLET_LPAREN, TT.TUPLET_P,
        TT.NOTE_LETTER, TT.NOTE_LETTER, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes tuplet with q value", () => {
      assertTokenSequence("X:1\n(3:2DEF", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.TUPLET_LPAREN, TT.TUPLET_P, TT.TUPLET_COLON, TT.TUPLET_Q,
        TT.NOTE_LETTER, TT.NOTE_LETTER, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes tuplet with p, q, and r values", () => {
      assertTokenSequence("X:1\n(5:4:6ABCDE", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.TUPLET_LPAREN, TT.TUPLET_P, TT.TUPLET_COLON, TT.TUPLET_Q,
        TT.TUPLET_COLON, TT.TUPLET_R,
        TT.NOTE_LETTER, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.NOTE_LETTER,
      ]);
    });
  });

  describe("Barlines and repeat numbers", () => {
    it("tokenizes simple barlines", () => {
      assertTokenSequence("X:1\nA | B || C", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE, TT.WS,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE, TT.WS,
        TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes repeat barlines", () => {
      assertTokenSequence("X:1\nA |: B :|", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE, TT.WS,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE,
      ]);
    });

    it("tokenizes barline with repeat number", () => {
      assertTokenSequence("X:1\nA |1 B :|2 C", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE, TT.REPEAT_NUMBER, TT.WS,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE, TT.REPEAT_NUMBER, TT.WS,
        TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes repeat number list", () => {
      assertTokenSequence("X:1\nA |1,2,3 B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE,
        TT.REPEAT_NUMBER, TT.REPEAT_COMMA, TT.REPEAT_NUMBER, TT.REPEAT_COMMA, TT.REPEAT_NUMBER,
        TT.WS, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes repeat number range", () => {
      assertTokenSequence("X:1\nA |1-3 B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE,
        TT.REPEAT_NUMBER, TT.REPEAT_DASH, TT.REPEAT_NUMBER,
        TT.WS, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes thick-thin barline", () => {
      assertTokenSequence("X:1\nA [| B |]", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE, TT.WS,
        TT.NOTE_LETTER, TT.WS, TT.BARLINE,
      ]);
    });
  });

  describe("Slurs and ties (context-sensitivity)", () => {
    it("tokenizes slur markers in music context", () => {
      assertTokenSequence("X:1\n(AB) C", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.SLUR, TT.NOTE_LETTER, TT.NOTE_LETTER, TT.SLUR,
        TT.WS, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes ties between notes", () => {
      assertTokenSequence("X:1\nA-B C-D", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.TIE, TT.NOTE_LETTER, TT.WS,
        TT.NOTE_LETTER, TT.TIE, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes mixed slurs and ties", () => {
      assertTokenSequence("X:1\n(A-B) C-D", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.SLUR, TT.NOTE_LETTER, TT.TIE, TT.NOTE_LETTER, TT.SLUR,
        TT.WS, TT.NOTE_LETTER, TT.TIE, TT.NOTE_LETTER,
      ]);
    });
  });

  describe("Lyrics (context-sensitivity)", () => {
    it("tokenizes simple lyric line", () => {
      assertTokenSequence("X:1\nA B C\nw:lyrics", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.LY_HDR, TT.LY_TXT,
      ]);
    });

    it("tokenizes lyric with hyphens (context: - is LY_HYPH, not TIE)", () => {
      assertTokenSequence("X:1\nA B C\nw:syll-a-ble", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.LY_HDR, TT.LY_TXT, TT.LY_HYPH, TT.LY_TXT, TT.LY_HYPH, TT.LY_TXT,
      ]);
    });

    it("tokenizes lyric with underscores (hold notes)", () => {
      assertTokenSequence("X:1\nA B C\nw:time__", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.LY_HDR, TT.LY_TXT, TT.LY_UNDR, TT.LY_UNDR,
      ]);
    });

    it("tokenizes lyric with tilde (non-breaking space)", () => {
      assertTokenSequence("X:1\nA B C\nw:of~the~day", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.LY_HDR, TT.LY_TXT, TT.LY_SPS, TT.LY_TXT, TT.LY_SPS, TT.LY_TXT,
      ]);
    });

    it("tokenizes lyric with star (skip note)", () => {
      assertTokenSequence("X:1\nA B C\nw:word * word", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.LY_HDR, TT.LY_TXT, TT.WS, TT.LY_STAR, TT.WS, TT.LY_TXT,
      ]);
    });

    it("tokenizes section lyric (W:)", () => {
      assertTokenSequence("X:1\nA B C\nW:section lyrics", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.LY_SECT_HDR, TT.LY_TXT, TT.WS, TT.LY_TXT,
      ]);
    });

    it("tokenizes lyric with barline advancement", () => {
      assertTokenSequence("X:1\nA B C\nw:word | word", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.LY_HDR, TT.LY_TXT, TT.WS, TT.BARLINE, TT.WS, TT.LY_TXT,
      ]);
    });
  });

  describe("Inline fields", () => {
    it("tokenizes inline key change", () => {
      assertTokenSequence("X:1\nA [K:G] B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS,
        TT.INLN_FLD_LFT_BRKT, TT.INF_HDR, TT.NOTE_LETTER, TT.INLN_FLD_RGT_BRKT,
        TT.WS, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes inline meter change", () => {
      assertTokenSequence("X:1\nA [M:3/4] B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS,
        TT.INLN_FLD_LFT_BRKT, TT.INF_HDR,
        TT.NUMBER, TT.SLASH, TT.NUMBER,
        TT.INLN_FLD_RGT_BRKT,
        TT.WS, TT.NOTE_LETTER,
      ]);
    });
  });

  describe("Decorations and symbols", () => {
    it("tokenizes decoration before note", () => {
      assertTokenSequence("X:1\n.A ~B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.DECORATION, TT.NOTE_LETTER, TT.WS,
        TT.DECORATION, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes symbol notation", () => {
      assertTokenSequence("X:1\n!trill!A", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.SYMBOL, TT.NOTE_LETTER,
      ]);
    });
  });

  describe("Directives", () => {
    it("tokenizes simple directive with identifier and number", () => {
      assertTokenSequence("%%scale 0.75", [
        TT.STYLESHEET_DIRECTIVE, TT.IDENTIFIER, TT.NUMBER,
      ]);
    });

    it("tokenizes directive with measurement unit", () => {
      assertTokenSequence("%%pagewidth 21cm", [
        TT.STYLESHEET_DIRECTIVE, TT.IDENTIFIER, TT.NUMBER, TT.MEASUREMENT_UNIT,
      ]);
    });

    it("tokenizes directive with rational number", () => {
      assertTokenSequence("%%scale 3/4", [
        TT.STYLESHEET_DIRECTIVE, TT.IDENTIFIER, TT.NUMBER, TT.SLASH, TT.NUMBER,
      ]);
    });

    it("tokenizes directive with assignment", () => {
      assertTokenSequence("%%transpose=2", [
        TT.STYLESHEET_DIRECTIVE, TT.IDENTIFIER, TT.EQL, TT.NUMBER,
      ]);
    });

    it("tokenizes directive with string literal", () => {
      assertTokenSequence('%%title "My Song"', [
        TT.STYLESHEET_DIRECTIVE, TT.IDENTIFIER, TT.ANNOTATION,
      ]);
    });

    it("tokenizes text directive with free text", () => {
      assertTokenSequence("%%text This is text", [
        TT.STYLESHEET_DIRECTIVE, TT.IDENTIFIER, TT.FREE_TXT,
      ]);
    });
  });

  describe("Comments", () => {
    it("tokenizes comment at end of music line", () => {
      assertTokenSequence("X:1\nA B C %comment", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.WS, TT.COMMENT,
      ]);
    });

    it("tokenizes standalone comment line", () => {
      assertTokenSequence("%this is a comment\nX:1\nA", [
        TT.COMMENT, TT.EOL,
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER,
      ]);
    });
  });

  describe("Special tokens", () => {
    it("tokenizes y spacer", () => {
      assertTokenSequence("X:1\nA y B", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.Y_SPC, TT.WS, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes line continuation", () => {
      assertTokenSequence("X:1\nA B\\\nC D", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.LINE_CONT, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes voice overlay", () => {
      assertTokenSequence("X:1\nA B & C D", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS,
        TT.VOICE, TT.WS,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
      ]);
    });
  });

  describe("Info lines", () => {
    it("tokenizes title info line", () => {
      assertTokenSequence("T:My Title", [
        TT.INF_HDR, TT.INFO_STR,
      ]);
    });

    it("tokenizes key info line", () => {
      assertTokenSequence("K:G", [
        TT.INF_HDR, TT.IDENTIFIER,
      ]);
    });

    it("tokenizes info line with comment", () => {
      assertTokenSequence("T:Title %comment", [
        TT.INF_HDR, TT.INFO_STR, TT.COMMENT,
      ]);
    });
  });

  describe("Symbol lines", () => {
    it("tokenizes symbol line header and text", () => {
      assertTokenSequence("X:1\nA B C\ns:hello", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.SY_HDR, TT.SY_TXT,
      ]);
    });

    it("tokenizes symbol line with star", () => {
      assertTokenSequence("X:1\nA B C\ns:* text *", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.SY_HDR, TT.SY_STAR, TT.WS, TT.SY_TXT, TT.WS, TT.SY_STAR,
      ]);
    });
  });

  describe("Full tune structures", () => {
    it("tokenizes a complete minimal tune", () => {
      assertTokenSequence("X:1\nT:Test\nK:C\nABC", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.INF_HDR, TT.SPECIAL_LITERAL, TT.EOL,
        TT.NOTE_LETTER, TT.NOTE_LETTER, TT.NOTE_LETTER,
      ]);
    });

    it("tokenizes a tune with music and lyrics", () => {
      assertTokenSequence("X:1\nT:Song\nK:C\nA B C D\nw:one two three four", [
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.INF_HDR, TT.SPECIAL_LITERAL, TT.EOL,
        TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER,
        TT.EOL,
        TT.LY_HDR, TT.LY_TXT, TT.WS, TT.LY_TXT, TT.WS, TT.LY_TXT, TT.WS, TT.LY_TXT,
      ]);
    });

    it("tokenizes a tune with directive before header", () => {
      assertTokenSequence("%%scale 0.8\nX:1\nK:C\nA", [
        TT.STYLESHEET_DIRECTIVE, TT.IDENTIFIER, TT.NUMBER, TT.EOL,
        TT.INF_HDR, TT.INFO_STR, TT.EOL,
        TT.INF_HDR, TT.SPECIAL_LITERAL, TT.EOL,
        TT.NOTE_LETTER,
      ]);
    });
  });

  describe("TreeSitter cross-comparison (when available)", () => {
    /**
     * Assert that TypeScript and TreeSitter produce the same non-WS token
     * type sequence for the given input.
     */
    function assertCrossComparison(input: string, label: string): void {
      const tsTokens = tsTokenize(input);
      const terminals = getTreeSitterTerminals(input)!;
      const tsDescriptors = filterWS(tsToDescriptors(tsTokens));
      const treeDescriptors = filterWS(treeSitterToDescriptors(terminals));
      assertTokenTypesMatch(tsDescriptors, treeDescriptors, input, label);
    }

    it("cross-compares simple note sequence", function () {
      if (!isTreeSitterAvailable()) { this.skip(); return; }
      assertCrossComparison("X:1\nK:C\nA B C D", "Cross-comparison");
    });

    it("cross-compares lyric context-sensitivity", function () {
      if (!isTreeSitterAvailable()) { this.skip(); return; }
      assertCrossComparison("X:1\nK:C\nA-B\nw:syll-able", "Cross-comparison (lyrics)");
    });

    it("cross-compares directive tokenization", function () {
      if (!isTreeSitterAvailable()) { this.skip(); return; }
      assertCrossComparison("%%pagewidth 21cm\nX:1\nK:C\nA", "Cross-comparison (directive)");
    });

    it("cross-compares tuplet context-sensitivity", function () {
      if (!isTreeSitterAvailable()) { this.skip(); return; }
      assertCrossComparison("X:1\nK:C\n(3ABC", "Cross-comparison (tuplet)");
    });

    it("cross-compares inline field context-sensitivity", function () {
      if (!isTreeSitterAvailable()) { this.skip(); return; }
      assertCrossComparison("X:1\nK:C\nA [M:3/4] B", "Cross-comparison (inline field)");
    });
  });
});
