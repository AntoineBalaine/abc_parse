import { assert } from "chai";
import { parseAnnotation } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Annotation } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseAnnotation", () => {
  it("should parse an annotation", () => {
    const tokens = [createToken(TT.ANNOTATION, '"C"')];
    const ctx = createParseCtx(tokens);

    const result = parseAnnotation(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Annotation);
    assert.equal(result?.text.lexeme, '"C"');
  });

  it("should return null for non-annotation tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseAnnotation(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

