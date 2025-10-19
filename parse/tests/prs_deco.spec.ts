import { assert } from "chai";
import { parseDecoration } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Decoration } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseDecoration", () => {
  it("should parse a decoration", () => {
    const tokens = [createToken(TT.DECORATION, ".")];
    const ctx = createParseCtx(tokens);

    const result = parseDecoration(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Decoration);
    assert.equal(result?.decoration.lexeme, ".");
  });

  it("should return null for non-decoration tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseDecoration(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

