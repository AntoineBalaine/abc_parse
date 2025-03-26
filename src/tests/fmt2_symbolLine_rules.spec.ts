import { assert } from "chai";
import { isToken } from "../helpers2";
import { ABCContext } from "../parsers/Context";
import { Ctx, Token, TT } from "../parsers/scan2";
import { BarLine, Expr, System, Tune } from "../types/Expr2";
import { resolveRules } from "../Visitors/fmt2/fmt_rules_assignment";

describe("Symbol Line Rules (fmt2)", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  // Helper function to create a token
  function createToken(type: TT): Token {
    let lexeme: string;

    if (type === TT.SY_HDR) lexeme = "s:";
    else if (type === TT.SY_TXT) lexeme = "text";
    else if (type === TT.SY_STAR) lexeme = "*";
    else throw Error("Invalid token type");

    const tokenCtx = new Ctx(lexeme, ctx);
    tokenCtx.current = tokenCtx.source.length;
    return new Token(type, tokenCtx, ctx.generateId());
  }

  // Helper function to create a barline
  function createBarline(): BarLine {
    return new BarLine(ctx.generateId(), []);
  }

  // Helper function to extract token types for easier assertion
  function extractTokenTypes(system: System): Array<TT | Expr> {
    return system.map((node): TT | Expr => {
      if (isToken(node)) {
        return node.type;
      }
      return node;
    });
  }

  // Helper function to assert token sequence with proper type handling
  function assertTokenSequence(actual: Array<TT | Expr>, expected: Array<TT | Expr>) {
    assert.equal(actual.length, expected.length, "Arrays should have the same length");

    for (let i = 0; i < actual.length; i++) {
      const expectedItem = expected[i];
      const actualItem = actual[i];

      if (typeof expectedItem === "number") {
        // It's a token type
        assert.equal(actualItem, expectedItem, `Item at index ${i} should be token type ${expectedItem}`);
      } else if (expectedItem instanceof BarLine) {
        // It's a barline
        assert.isTrue(actualItem instanceof BarLine, `Item at index ${i} should be a BarLine`);
      }
    }
  }

  it("inserts space after symbol header", () => {
    // Create a system with a symbol header followed by text
    const system: System = [createToken(TT.SY_HDR), createToken(TT.SY_TXT)];

    // Create a tune with the system
    const tune: Tune = {
      tune_header: { voices: ["1"] },
      tune_body: { sequence: [system] },
    } as Tune as Tune;

    // Apply rules
    const processedTune = resolveRules(tune, ctx);
    const processedSystem = processedTune.tune_body!.sequence[0];

    // Extract token types for easier assertion
    const tokenTypes = extractTokenTypes(processedSystem);

    // Verify space is inserted after symbol header
    assertTokenSequence(tokenTypes, [TT.SY_HDR, TT.WS, TT.SY_TXT]);
  });

  it("doesn't insert spaces between SY_TXT tokens", () => {
    // Create a system with a symbol header followed by multiple text tokens
    const system: System = [createToken(TT.SY_HDR), createToken(TT.SY_TXT), createToken(TT.SY_TXT)];

    // Create a tune with the system
    const tune: Tune = {
      tune_header: { voices: ["1"] },
      tune_body: { sequence: [system] },
    } as Tune as Tune;

    // Apply rules
    const processedTune = resolveRules(tune, ctx);
    const processedSystem = processedTune.tune_body!.sequence[0];

    // Extract token types for easier assertion
    const tokenTypes = extractTokenTypes(processedSystem);

    // Verify no space is inserted between text tokens
    assertTokenSequence(tokenTypes, [TT.SY_HDR, TT.WS, TT.SY_TXT, TT.SY_TXT]);
  });

  it("doesn't insert spaces between SY_STAR tokens", () => {
    // Create a system with a symbol header followed by multiple star tokens
    const system: System = [createToken(TT.SY_HDR), createToken(TT.SY_STAR), createToken(TT.SY_STAR)];

    // Create a tune with the system
    const tune: Tune = {
      tune_header: { voices: ["1"] },
      tune_body: { sequence: [system] },
    } as Tune as Tune;

    // Apply rules
    const processedTune = resolveRules(tune, ctx);
    const processedSystem = processedTune.tune_body!.sequence[0];

    // Extract token types for easier assertion
    const tokenTypes = extractTokenTypes(processedSystem);

    // Verify no space is inserted between star tokens
    assertTokenSequence(tokenTypes, [TT.SY_HDR, TT.WS, TT.SY_STAR, TT.SY_STAR]);
  });

  it("inserts spaces around barlines in symbol lines", () => {
    // Create a system with a symbol header, text, barline, and more text
    const system: System = [createToken(TT.SY_HDR), createToken(TT.SY_TXT), createBarline(), createToken(TT.SY_TXT)];

    // Create a tune with the system
    const tune: Tune = {
      tune_header: { voices: ["1"] },
      tune_body: { sequence: [system] },
    } as Tune as Tune;

    // Apply rules
    const processedTune = resolveRules(tune, ctx);
    const processedSystem = processedTune.tune_body!.sequence[0];

    // Extract token types for easier assertion
    const tokenTypes = extractTokenTypes(processedSystem);

    // Verify spaces are inserted around barline
    assertTokenSequence(tokenTypes, [TT.SY_HDR, TT.WS, TT.SY_TXT, TT.WS, createBarline(), TT.WS, TT.SY_TXT]);
  });

  it("correctly applies spacing rules to mixed symbol line tokens", () => {
    // Create a system with mixed token types
    const system: System = [
      createToken(TT.SY_HDR),
      createToken(TT.SY_TXT),
      createToken(TT.SY_STAR),
      createBarline(),
      createToken(TT.SY_STAR),
      createToken(TT.SY_TXT),
    ];

    // Create a tune with the system
    const tune: Tune = {
      tune_header: { voices: ["1"] },
      tune_body: { sequence: [system] },
    } as Tune;

    // Apply rules
    const processedTune = resolveRules(tune, ctx);
    const processedSystem = processedTune.tune_body!.sequence[0];

    // Extract token types for easier assertion
    const tokenTypes = extractTokenTypes(processedSystem);

    // Verify correct spacing rules are applied
    assertTokenSequence(tokenTypes, [TT.SY_HDR, TT.WS, TT.SY_TXT, TT.SY_STAR, TT.WS, createBarline(), TT.WS, TT.SY_STAR, TT.SY_TXT]);
  });

  it("produces correctly formatted complete symbol line", () => {
    // Create a system with multiple barlines
    const system: System = [
      createToken(TT.SY_HDR),
      createToken(TT.SY_TXT),
      createToken(TT.SY_STAR),
      createBarline(),
      createToken(TT.SY_STAR),
      createToken(TT.SY_TXT),
      createBarline(),
      createToken(TT.SY_TXT),
    ];

    // Create a tune with the system
    const tune: Tune = {
      tune_header: { voices: ["1"] },
      tune_body: { sequence: [system] },
    } as Tune;

    // Apply rules
    const processedTune = resolveRules(tune, ctx);
    const processedSystem = processedTune.tune_body!.sequence[0];

    // Extract token types for easier assertion
    const tokenTypes = extractTokenTypes(processedSystem);

    // Verify correct spacing for complete symbol line
    assertTokenSequence(tokenTypes, [
      TT.SY_HDR,
      TT.WS,
      TT.SY_TXT,
      TT.SY_STAR,
      TT.WS,
      createBarline(),
      TT.WS,
      TT.SY_STAR,
      TT.SY_TXT,
      TT.WS,
      createBarline(),
      TT.WS,
      TT.SY_TXT,
    ]);
  });
});
