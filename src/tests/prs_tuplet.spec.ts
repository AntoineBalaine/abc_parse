import { assert } from "chai";
import { parseTuplet } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Tuplet } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseTuplet", () => {
  it("should parse a simple tuplet", () => {
    const tokens = [createToken(TT.TUPLET_LPAREN, "("), createToken(TT.TUPLET_P, "3")];
    const ctx = createParseCtx(tokens);

    const result = parseTuplet(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Tuplet);
    assert.equal(result?.p.lexeme, "3");
    assert.isUndefined(result?.q);
    assert.isUndefined(result?.r);
  });

  it("should return null for non-tuplet tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseTuplet(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

