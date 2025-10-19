import { assert } from "chai";
import { parseYSpacer } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { YSPACER, Rhythm } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseYSpacer", () => {
  it("should parse a simple Y spacer", () => {
    const tokens = [createToken(TT.Y_SPC, "y")];
    const ctx = createParseCtx(tokens);

    const result = parseYSpacer(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, YSPACER);
    assert.equal(result?.ySpacer.lexeme, "y");
    assert.isUndefined(result?.rhythm);
  });

  it("should parse a Y spacer with rhythm", () => {
    const tokens = [createToken(TT.Y_SPC, "y"), createToken(TT.RHY_NUMER, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseYSpacer(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, YSPACER);
    assert.equal(result?.ySpacer.lexeme, "y");
    assert.instanceOf(result?.rhythm, Rhythm);
    assert.equal(result?.rhythm?.numerator?.lexeme, "2");
  });

  it("should return null for non-Y-spacer tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseYSpacer(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

