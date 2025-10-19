import { assert } from "chai";
import { parseSymbol } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { createToken, createParseCtx } from "./prs_music_code.spec";
import { Symbol } from "../types/Expr2";

describe("parseSymbol", () => {
  it("should parse a symbol", () => {
    const tokens = [createToken(TT.SYMBOL, "!fff!")];
    const ctx = createParseCtx(tokens);

    const result = parseSymbol(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Symbol);
    assert.equal(result?.symbol.lexeme, "!fff!");
  });

  it("should return null for non-symbol tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseSymbol(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

