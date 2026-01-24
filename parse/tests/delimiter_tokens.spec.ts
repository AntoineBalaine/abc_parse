import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import {
  ParseCtx,
  parseChord,
  parseGraceGroup,
  parseTuplet,
  parseInlineField,
  prsMacroDecl,
  prsUserSymbolDecl,
  parseTune,
} from "../parsers/parse2";
import { Token, TT, Scanner } from "../parsers/scan2";
import {
  Chord,
  Grace_group,
  Tuplet,
  Inline_field,
  Macro_decl,
  User_symbol_decl,
  Note,
  Pitch,
} from "../types/Expr2";
import { AbcFormatter } from "../Visitors/Formatter2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("Delimiter Token Preservation - Parser", () => {
  describe("Chord delimiter tokens", () => {
    it("stores leftBracket and rightBracket tokens", () => {
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "G"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseChord(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.isDefined(result!.leftBracket);
      assert.isDefined(result!.rightBracket);
      assert.equal(result!.leftBracket!.lexeme, "[");
      assert.equal(result!.rightBracket!.lexeme, "]");
      assert.equal(result!.leftBracket!.type, TT.CHRD_LEFT_BRKT);
      assert.equal(result!.rightBracket!.type, TT.CHRD_RIGHT_BRKT);
    });

    it("stores leftBracket without rightBracket when bracket is missing", () => {
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.EOF, ""),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseChord(ctx);

      // Parser should still produce a Chord even without closing bracket
      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.isDefined(result!.leftBracket);
      assert.equal(result!.leftBracket!.lexeme, "[");
      assert.isUndefined(result!.rightBracket);
    });
  });

  describe("Grace_group delimiter tokens", () => {
    it("stores leftBrace and rightBrace tokens", () => {
      const tokens = [
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.NOTE_LETTER, "g"),
        createToken(TT.NOTE_LETTER, "a"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseGraceGroup(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Grace_group);
      assert.isDefined(result!.leftBrace);
      assert.isDefined(result!.rightBrace);
      assert.equal(result!.leftBrace!.lexeme, "{");
      assert.equal(result!.rightBrace!.lexeme, "}");
      assert.equal(result!.leftBrace!.type, TT.GRC_GRP_LEFT_BRACE);
      assert.equal(result!.rightBrace!.type, TT.GRC_GRP_RGHT_BRACE);
    });

    it("stores acciaccaturaSlash token when present", () => {
      const tokens = [
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.GRC_GRP_SLSH, "/"),
        createToken(TT.NOTE_LETTER, "c"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseGraceGroup(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Grace_group);
      assert.isDefined(result!.acciaccaturaSlash);
      assert.equal(result!.acciaccaturaSlash!.lexeme, "/");
      assert.equal(result!.acciaccaturaSlash!.type, TT.GRC_GRP_SLSH);
      assert.isTrue(result!.isAccacciatura);
    });

    it("does not store acciaccaturaSlash for regular grace groups", () => {
      const tokens = [
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.NOTE_LETTER, "g"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseGraceGroup(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Grace_group);
      assert.isUndefined(result!.acciaccaturaSlash);
      assert.isFalse(result!.isAccacciatura);
    });
  });

  describe("Tuplet delimiter tokens", () => {
    it("stores leftParen token", () => {
      const tokens = [
        createToken(TT.TUPLET_LPAREN, "("),
        createToken(TT.TUPLET_P, "3"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseTuplet(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tuplet);
      assert.isDefined(result!.leftParen);
      assert.equal(result!.leftParen!.lexeme, "(");
      assert.equal(result!.leftParen!.type, TT.TUPLET_LPAREN);
    });

    it("stores firstColon when q is present", () => {
      const tokens = [
        createToken(TT.TUPLET_LPAREN, "("),
        createToken(TT.TUPLET_P, "3"),
        createToken(TT.TUPLET_COLON, ":"),
        createToken(TT.TUPLET_Q, "2"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseTuplet(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tuplet);
      assert.isDefined(result!.firstColon);
      assert.equal(result!.firstColon!.lexeme, ":");
      assert.equal(result!.firstColon!.type, TT.TUPLET_COLON);
      assert.isDefined(result!.q);
      assert.equal(result!.q!.lexeme, "2");
    });

    it("stores both colons when p:q:r is present", () => {
      const tokens = [
        createToken(TT.TUPLET_LPAREN, "("),
        createToken(TT.TUPLET_P, "3"),
        createToken(TT.TUPLET_COLON, ":"),
        createToken(TT.TUPLET_Q, "2"),
        createToken(TT.TUPLET_COLON, ":"),
        createToken(TT.TUPLET_R, "3"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseTuplet(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tuplet);
      assert.isDefined(result!.firstColon);
      assert.isDefined(result!.secondColon);
      assert.equal(result!.firstColon!.lexeme, ":");
      assert.equal(result!.secondColon!.lexeme, ":");
      assert.isDefined(result!.r);
      assert.equal(result!.r!.lexeme, "3");
    });

    it("stores firstColon even when q is empty (p::r format)", () => {
      const tokens = [
        createToken(TT.TUPLET_LPAREN, "("),
        createToken(TT.TUPLET_P, "3"),
        createToken(TT.TUPLET_COLON, ":"),
        createToken(TT.TUPLET_COLON, ":"),
        createToken(TT.TUPLET_R, "6"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseTuplet(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tuplet);
      assert.isDefined(result!.firstColon);
      assert.isDefined(result!.secondColon);
      assert.isUndefined(result!.q);
      assert.isDefined(result!.r);
      assert.equal(result!.r!.lexeme, "6");
    });
  });

  describe("Inline_field delimiter tokens", () => {
    it("stores leftBracket and rightBracket tokens", () => {
      const tokens = [
        createToken(TT.INLN_FLD_LFT_BRKT, "["),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.INLN_FLD_RGT_BRKT, "]"),
      ];
      const ctx = createParseCtx(tokens);
      const result = parseInlineField(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Inline_field);
      assert.isDefined(result!.leftBracket);
      assert.isDefined(result!.rightBracket);
      assert.equal(result!.leftBracket!.lexeme, "[");
      assert.equal(result!.rightBracket!.lexeme, "]");
      assert.equal(result!.leftBracket!.type, TT.INLN_FLD_LFT_BRKT);
      assert.equal(result!.rightBracket!.type, TT.INLN_FLD_RGT_BRKT);
    });
  });

  describe("Macro_decl delimiter tokens", () => {
    it("stores equals token", () => {
      const tokens = [
        createToken(TT.MACRO_HDR, "m:"),
        createToken(TT.MACRO_VAR, "var"),
        createToken(TT.EQL, "="),
        createToken(TT.MACRO_STR, "content"),
      ];
      const ctx = createParseCtx(tokens);
      const result = prsMacroDecl(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Macro_decl);
      assert.isDefined(result!.equals);
      assert.equal(result!.equals!.lexeme, "=");
      assert.equal(result!.equals!.type, TT.EQL);
    });
  });

  describe("User_symbol_decl delimiter tokens", () => {
    it("stores equals token", () => {
      const tokens = [
        createToken(TT.USER_SY_HDR, "U:"),
        createToken(TT.USER_SY, "T"),
        createToken(TT.EQL, "="),
        createToken(TT.SYMBOL, "!trill!"),
      ];
      const ctx = createParseCtx(tokens);
      const result = prsUserSymbolDecl(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, User_symbol_decl);
      assert.isDefined(result!.equals);
      assert.equal(result!.equals!.lexeme, "=");
      assert.equal(result!.equals!.type, TT.EQL);
    });
  });
});

describe("Delimiter Token Preservation - Formatter", () => {
  describe("stored-token path (tokens present)", () => {
    it("formats chord using stored bracket tokens", () => {
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
      ];
      const ctx = createParseCtx(tokens);
      const chord = parseChord(ctx)!;
      const formatter = new AbcFormatter(new ABCContext());
      const result = formatter.stringify(chord);

      assert.include(result, "[");
      assert.include(result, "]");
    });

    it("formats grace group using stored brace tokens", () => {
      const tokens = [
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.NOTE_LETTER, "g"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
      ];
      const ctx = createParseCtx(tokens);
      const gg = parseGraceGroup(ctx)!;
      const formatter = new AbcFormatter(new ABCContext());
      const result = formatter.stringify(gg);

      assert.equal(result, "{g}");
    });

    it("formats acciaccatura grace group with slash token", () => {
      const tokens = [
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.GRC_GRP_SLSH, "/"),
        createToken(TT.NOTE_LETTER, "c"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
      ];
      const ctx = createParseCtx(tokens);
      const gg = parseGraceGroup(ctx)!;
      const formatter = new AbcFormatter(new ABCContext());
      const result = formatter.stringify(gg);

      assert.equal(result, "{/c}");
    });

    it("formats tuplet using stored paren and colon tokens", () => {
      const tokens = [
        createToken(TT.TUPLET_LPAREN, "("),
        createToken(TT.TUPLET_P, "3"),
        createToken(TT.TUPLET_COLON, ":"),
        createToken(TT.TUPLET_Q, "2"),
        createToken(TT.TUPLET_COLON, ":"),
        createToken(TT.TUPLET_R, "3"),
      ];
      const ctx = createParseCtx(tokens);
      const tuplet = parseTuplet(ctx)!;
      const formatter = new AbcFormatter(new ABCContext());
      const result = formatter.stringify(tuplet);

      assert.equal(result, "(3:2:3");
    });

    it("formats inline field using stored bracket tokens", () => {
      const tokens = [
        createToken(TT.INLN_FLD_LFT_BRKT, "["),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.INLN_FLD_RGT_BRKT, "]"),
      ];
      const ctx = createParseCtx(tokens);
      const field = parseInlineField(ctx)!;
      const formatter = new AbcFormatter(new ABCContext());
      const result = formatter.stringify(field);

      assert.equal(result, "[K:C]");
    });

    it("formats macro declaration using stored equals token", () => {
      const tokens = [
        createToken(TT.MACRO_HDR, "m:"),
        createToken(TT.MACRO_VAR, "var"),
        createToken(TT.EQL, "="),
        createToken(TT.MACRO_STR, "content"),
      ];
      const ctx = createParseCtx(tokens);
      const macro = prsMacroDecl(ctx)!;
      const formatter = new AbcFormatter(new ABCContext());
      const result = formatter.stringify(macro);

      assert.equal(result, "m:var=content");
    });

    it("formats user symbol declaration using stored equals token", () => {
      const tokens = [
        createToken(TT.USER_SY_HDR, "U:"),
        createToken(TT.USER_SY, "T"),
        createToken(TT.EQL, "="),
        createToken(TT.SYMBOL, "!trill!"),
      ];
      const ctx = createParseCtx(tokens);
      const decl = prsUserSymbolDecl(ctx)!;
      const formatter = new AbcFormatter(new ABCContext());
      const result = formatter.stringify(decl);

      assert.equal(result, "U:T=!trill!");
    });
  });

  describe("fallback path (tokens undefined)", () => {
    it("formats chord with fallback brackets when delimiter fields are undefined", () => {
      const ctx = new ABCContext();
      const noteToken = createToken(TT.NOTE_LETTER, "C");
      const pitch = new Pitch(ctx.generateId(), { noteLetter: noteToken });
      const note = new Note(ctx.generateId(), pitch);
      const chord = new Chord(ctx.generateId(), [note]);
      const formatter = new AbcFormatter(ctx);
      const result = formatter.stringify(chord);

      assert.include(result, "[");
      assert.include(result, "]");
    });

    it("formats grace group with fallback braces when delimiter fields are undefined", () => {
      const ctx = new ABCContext();
      const noteToken = createToken(TT.NOTE_LETTER, "g");
      const pitch = new Pitch(ctx.generateId(), { noteLetter: noteToken });
      const note = new Note(ctx.generateId(), pitch);
      const gg = new Grace_group(ctx.generateId(), [note], false);
      const formatter = new AbcFormatter(ctx);
      const result = formatter.stringify(gg);

      assert.include(result, "{");
      assert.include(result, "}");
      assert.notInclude(result, "/");
    });

    it("formats acciaccatura grace group with fallback slash when delimiter fields are undefined", () => {
      const ctx = new ABCContext();
      const noteToken = createToken(TT.NOTE_LETTER, "c");
      const pitch = new Pitch(ctx.generateId(), { noteLetter: noteToken });
      const note = new Note(ctx.generateId(), pitch);
      const gg = new Grace_group(ctx.generateId(), [note], true);
      const formatter = new AbcFormatter(ctx);
      const result = formatter.stringify(gg);

      assert.include(result, "{");
      assert.include(result, "/");
      assert.include(result, "}");
    });

    it("formats tuplet with fallback paren and colons when delimiter fields are undefined", () => {
      const ctx = new ABCContext();
      const p = createToken(TT.TUPLET_P, "3");
      const q = createToken(TT.TUPLET_Q, "2");
      const tuplet = new Tuplet(ctx.generateId(), p, q);
      const formatter = new AbcFormatter(ctx);
      const result = formatter.stringify(tuplet);

      assert.equal(result, "(3:2");
    });

    it("formats tuplet p:q:r with fallback colons when delimiter fields are undefined", () => {
      const ctx = new ABCContext();
      const p = createToken(TT.TUPLET_P, "3");
      const q = createToken(TT.TUPLET_Q, "2");
      const r = createToken(TT.TUPLET_R, "3");
      const tuplet = new Tuplet(ctx.generateId(), p, q, r);
      const formatter = new AbcFormatter(ctx);
      const result = formatter.stringify(tuplet);

      assert.equal(result, "(3:2:3");
    });
  });
});

describe("Delimiter Token Preservation - Full Pipeline Round-trip", () => {
  function parseAndFormat(input: string): string {
    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const ast = parseTune(parseCtx);
    if (!ast) throw new Error("Failed to parse");
    const formatter = new AbcFormatter(ctx);
    return formatter.stringify(ast);
  }

  it("chord [CEG] round-trips correctly", () => {
    const result = parseAndFormat("X:1\n[CEG]|\n");
    assert.include(result, "[CEG]");
  });

  it("grace group {gab} round-trips correctly", () => {
    const result = parseAndFormat("X:1\n{gab}C|\n");
    assert.include(result, "{gab}");
  });

  it("acciaccatura {/c} round-trips correctly", () => {
    const result = parseAndFormat("X:1\n{/c}D|\n");
    assert.include(result, "{/c}");
  });

  it("tuplet (3 round-trips correctly", () => {
    const result = parseAndFormat("X:1\n(3CDE|\n");
    assert.include(result, "(3");
  });

  it("tuplet (3:2:3 round-trips correctly", () => {
    const result = parseAndFormat("X:1\n(3:2:3CDE|\n");
    assert.include(result, "(3:2:3");
  });

  it("inline field [K:C] round-trips correctly", () => {
    const result = parseAndFormat("X:1\nCD[K:C]EF|\n");
    assert.include(result, "[K:C]");
  });

  it("macro declaration m:var=content round-trips correctly", () => {
    const result = parseAndFormat("X:1\nm:var=content\nCDE|\n");
    assert.include(result, "m:var=content");
  });

  it("user symbol declaration U:T=!trill! round-trips correctly", () => {
    const result = parseAndFormat("X:1\nU:T=!trill!\nCDE|\n");
    assert.include(result, "U:T=!trill!");
  });
});
