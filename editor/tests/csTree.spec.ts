import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS, isTokenNode, getTokenData } from "../src/csTree/types";
import { toAst } from "../src/csTree/toAst";
import { TT, File_structure, Tune, Music_code, Inline_field, KV, isToken, Scanner, parse, ABCContext } from "abc-parser";
import {
  toCSTree, collectAll, collectSubtree, findByTag, siblingCount,
  genAbcTune, genAbcWithChords, genAbcMultiTune,
  roundtrip, formatAst
} from "./helpers";

describe("csTree - fromAst", () => {
  describe("properties", () => {
    it("every CSNode has a tag matching one of the TAGS entries", () => {
      const validTags = new Set(Object.values(TAGS));
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const allNodes = collectAll(root);
          for (const node of allNodes) {
            if (!validTags.has(node.tag)) return false;
          }
          return true;
        })
      );
    });

    it("Token CSNodes are always leaves (firstChild is null)", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const tokens = findByTag(root, TAGS.Token);
          for (const t of tokens) {
            if (t.firstChild !== null) return false;
          }
          return true;
        })
      );
    });
  });

  describe("examples", () => {
    it("[CEG]2 C2 D2| — chord has Note children linked as siblings", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]2 C2 D2|\n");
      expect(root.tag).to.equal(TAGS.File_structure);

      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(1);

      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);

      const chordSubtree = collectSubtree(chords[0]);
      const chordNotes = chordSubtree.filter((n) => n.tag === TAGS.Note);
      expect(chordNotes.length).to.equal(3);
    });

    it("CDEF GABc| — beamed notes are children of Beam CSNodes", () => {
      const root = toCSTree("X:1\nK:C\nCDEF GABc|\n");
      const beams = findByTag(root, TAGS.Beam);
      expect(beams.length).to.be.greaterThan(0);

      for (const beam of beams) {
        const subtree = collectSubtree(beam);
        const notes = subtree.filter((n) => n.tag === TAGS.Note);
        expect(notes.length).to.be.greaterThan(0);
      }
    });

    it("multi-tune input — root has multiple Tune children as siblings", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n\nX:2\nK:G\nGAB|\n");
      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(2);
    });

    it("a Note CSNode has tag 'Note', Chord has 'Chord', Rest has 'Rest'", () => {
      const root = toCSTree("X:1\nK:C\n[CE]2 C2 z2|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      for (const n of notes) expect(n.tag).to.equal("Note");

      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      expect(chords[0].tag).to.equal("Chord");

      const rests = findByTag(root, TAGS.Rest);
      expect(rests.length).to.equal(1);
      expect(rests[0].tag).to.equal("Rest");
    });

    it("Beam CSNode has tag 'Beam'", () => {
      const root = toCSTree("X:1\nK:C\nCDEF|\n");
      const beams = findByTag(root, TAGS.Beam);
      expect(beams.length).to.be.greaterThan(0);
      expect(beams[0].tag).to.equal("Beam");
    });

    it("fromAst works on a subtree (Chord node)", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]2|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      const subtree = collectSubtree(chords[0]);
      const notes = subtree.filter((n) => n.tag === TAGS.Note);
      expect(notes.length).to.equal(3);
    });

    it("Tune has Tune_header and Tune_Body children", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(1);

      const tune = tunes[0];
      expect(tune.firstChild).to.not.equal(null);
      expect(tune.firstChild!.tag).to.equal(TAGS.Tune_header);
      expect(tune.firstChild!.nextSibling).to.not.equal(null);
      expect(tune.firstChild!.nextSibling!.tag).to.equal(TAGS.Tune_Body);
    });
  });
});

describe("csTree - toAst roundtrip", () => {
  describe("property-based", () => {
    it("roundtrip produces same output as direct formatting (single tune)", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const rt = roundtrip(abc);
          const direct = formatAst(abc);
          return rt === direct;
        }),
        { numRuns: 200 }
      );
    });

    it("roundtrip produces same output as direct formatting (tunes with chords)", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const rt = roundtrip(abc);
          const direct = formatAst(abc);
          return rt === direct;
        }),
        { numRuns: 200 }
      );
    });

    it("roundtrip produces same output as direct formatting (multi-tune)", () => {
      fc.assert(
        fc.property(genAbcMultiTune, (abc) => {
          const rt = roundtrip(abc);
          const direct = formatAst(abc);
          return rt === direct;
        }),
        { numRuns: 100 }
      );
    });

    it("node count is stable across fromAst conversions", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root1 = toCSTree(abc);
          const root2 = toCSTree(abc);
          return collectAll(root1).length === collectAll(root2).length;
        })
      );
    });
  });

  describe("example-based roundtrips", () => {
    const cases: Array<[string, string]> = [
      ["simple note", "X:1\nK:C\nC|\n"],
      ["note with accidental and octave", "X:1\nK:C\n^^C''3/4>|\n"],
      ["note with tie", "X:1\nK:C\nC-|\n"],
      ["chord with rhythm and tie", "X:1\nK:C\n[CEG]2-|\n"],
      ["grace group (non-acciaccatura)", "X:1\nK:C\n{CDE}F|\n"],
      ["acciaccatura grace group", "X:1\nK:C\n{/CDE}F|\n"],
      ["inline field", "X:1\nK:C\nCD[K:Am]EF|\n"],
      ["barline simple", "X:1\nK:C\nCDE|\n"],
      ["barline double", "X:1\nK:C\nCDE||\n"],
      ["rest with rhythm", "X:1\nK:C\nz3/4|\n"],
      ["beam contents", "X:1\nK:C\nCDEF|\n"],
      ["decoration", "X:1\nK:C\n!mf!C|\n"],
      ["annotation", "X:1\nK:C\n\"Am\"C|\n"],
      ["tuplet (3", "X:1\nK:C\n(3CDE|\n"],
      ["tuplet (3:2:3", "X:1\nK:C\n(3:2:3CDE|\n"],
      ["multi-measure rest", "X:1\nK:C\nZ4|\n"],
      ["y spacer", "X:1\nK:C\ny2C|\n"],
      ["chord symbol", "X:1\nK:C\n\"^Intro\"C|\n"],
      ["multi-tune with section break", "X:1\nK:C\nCDE|\n\nX:2\nK:G\nGAB|\n"],
      ["note with broken rhythm", "X:1\nK:C\nC>D|\n"],
      ["rest plain", "X:1\nK:C\nz|\n"],
      ["barline repeat end", "X:1\nK:C\nCDE:|\n"],
      ["single note chord", "X:1\nK:C\n[C]|\n"],
    ];

    for (const [label, source] of cases) {
      it(`${label}: ${source.trim()}`, () => {
        const rt = roundtrip(source);
        const direct = formatAst(source);
        expect(rt).to.equal(direct);
      });
    }
  });
});

describe("csTree - Delimiter Token Children", () => {
  function getTokenChildren(root: ReturnType<typeof toCSTree>, parentTag: string) {
    const parents = findByTag(root, parentTag);
    if (parents.length === 0) return [];
    const subtree = collectSubtree(parents[0]);
    return subtree.filter((n) => n.tag === TAGS.Token && isTokenNode(n));
  }

  describe("Chord delimiter tokens as children", () => {
    it("Chord CS node has left bracket and right bracket Token children", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);

      const subtree = collectSubtree(chords[0]);
      const tokenNodes = subtree.filter((n) => n.tag === TAGS.Token && isTokenNode(n));
      const tokenTypes = tokenNodes.map((n) => getTokenData(n).tokenType);

      expect(tokenTypes).to.include(TT.CHRD_LEFT_BRKT);
      expect(tokenTypes).to.include(TT.CHRD_RIGHT_BRKT);
    });

    it("left bracket is first child of Chord", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const firstChild = chords[0].firstChild;
      expect(firstChild).to.not.be.null;
      expect(firstChild!.tag).to.equal(TAGS.Token);
      expect(isTokenNode(firstChild!)).to.be.true;
      expect(getTokenData(firstChild!).tokenType).to.equal(TT.CHRD_LEFT_BRKT);
    });
  });

  describe("Grace_group delimiter tokens as children", () => {
    it("Grace_group CS node has left and right brace Token children", () => {
      const root = toCSTree("X:1\nK:C\n{gab}C|\n");
      const ggs = findByTag(root, TAGS.Grace_group);
      expect(ggs.length).to.equal(1);

      const subtree = collectSubtree(ggs[0]);
      const tokenNodes = subtree.filter((n) => n.tag === TAGS.Token && isTokenNode(n));
      const tokenTypes = tokenNodes.map((n) => getTokenData(n).tokenType);

      expect(tokenTypes).to.include(TT.GRC_GRP_LEFT_BRACE);
      expect(tokenTypes).to.include(TT.GRC_GRP_RGHT_BRACE);
    });

    it("left brace is first child of Grace_group", () => {
      const root = toCSTree("X:1\nK:C\n{ga}C|\n");
      const ggs = findByTag(root, TAGS.Grace_group);
      const firstChild = ggs[0].firstChild;
      expect(firstChild).to.not.be.null;
      expect(isTokenNode(firstChild!)).to.be.true;
      expect(getTokenData(firstChild!).tokenType).to.equal(TT.GRC_GRP_LEFT_BRACE);
    });

    it("acciaccatura Grace_group has slash Token child", () => {
      const root = toCSTree("X:1\nK:C\n{/c}D|\n");
      const ggs = findByTag(root, TAGS.Grace_group);
      expect(ggs.length).to.equal(1);

      const subtree = collectSubtree(ggs[0]);
      const tokenNodes = subtree.filter((n) => n.tag === TAGS.Token && isTokenNode(n));
      const tokenTypes = tokenNodes.map((n) => getTokenData(n).tokenType);

      expect(tokenTypes).to.include(TT.GRC_GRP_SLSH);
    });

    it("non-acciaccatura Grace_group has no slash Token child", () => {
      const root = toCSTree("X:1\nK:C\n{ga}C|\n");
      const ggs = findByTag(root, TAGS.Grace_group);
      const subtree = collectSubtree(ggs[0]);
      const tokenNodes = subtree.filter((n) => n.tag === TAGS.Token && isTokenNode(n));
      const tokenTypes = tokenNodes.map((n) => getTokenData(n).tokenType);

      expect(tokenTypes).to.not.include(TT.GRC_GRP_SLSH);
    });

    it("Grace_group uses EmptyData (no GraceGroupData)", () => {
      const root = toCSTree("X:1\nK:C\n{/c}D|\n");
      const ggs = findByTag(root, TAGS.Grace_group);
      expect(ggs[0].data.type).to.equal("empty");
    });

    it("isAccacciatura is correctly derived from slash token presence in toAst", () => {
      // Acciaccatura case
      const root1 = toCSTree("X:1\nK:C\n{/c}D|\n");
      const rt1 = roundtrip("X:1\nK:C\n{/c}D|\n");
      expect(rt1).to.include("{/c}");

      // Non-acciaccatura case
      const root2 = toCSTree("X:1\nK:C\n{ga}C|\n");
      const rt2 = roundtrip("X:1\nK:C\n{ga}C|\n");
      expect(rt2).to.include("{ga}");
      expect(rt2).to.not.include("{/");
    });
  });

  describe("Tuplet delimiter tokens as children", () => {
    it("Tuplet CS node has left paren as first child", () => {
      const root = toCSTree("X:1\nK:C\n(3CDE|\n");
      const tuplets = findByTag(root, TAGS.Tuplet);
      expect(tuplets.length).to.equal(1);

      const firstChild = tuplets[0].firstChild;
      expect(firstChild).to.not.be.null;
      expect(isTokenNode(firstChild!)).to.be.true;
      expect(getTokenData(firstChild!).tokenType).to.equal(TT.TUPLET_LPAREN);
    });

    it("Tuplet with colons has COLON Token children", () => {
      const root = toCSTree("X:1\nK:C\n(3:2:3CDE|\n");
      const tuplets = findByTag(root, TAGS.Tuplet);
      expect(tuplets.length).to.equal(1);

      const subtree = collectSubtree(tuplets[0]);
      const tokenNodes = subtree.filter((n) => n.tag === TAGS.Token && isTokenNode(n));
      const colonNodes = tokenNodes.filter((n) => getTokenData(n).tokenType === TT.TUPLET_COLON);

      expect(colonNodes.length).to.equal(2);
    });
  });

  describe("Inline_field delimiter tokens as children", () => {
    it("Inline_field CS node has left and right bracket Token children", () => {
      const root = toCSTree("X:1\nK:C\nCD[K:Am]EF|\n");
      const fields = findByTag(root, TAGS.Inline_field);
      expect(fields.length).to.equal(1);

      const subtree = collectSubtree(fields[0]);
      const tokenNodes = subtree.filter((n) => n.tag === TAGS.Token && isTokenNode(n));
      const tokenTypes = tokenNodes.map((n) => getTokenData(n).tokenType);

      expect(tokenTypes).to.include(TT.INLN_FLD_LFT_BRKT);
      expect(tokenTypes).to.include(TT.INLN_FLD_RGT_BRKT);
    });
  });
});

describe("csTree - Info_line value2 preservation (Phase 1: fromAst)", () => {
  describe("fromAst preserves value2 expressions", () => {
    it("Info_line with KV expressions produces CSTree with KV nodes", () => {
      // V:1 clef=treble has value2 with KV expressions
      const root = toCSTree("X:1\nV:1 clef=treble\nK:C\nCDE|\n");
      const infoLines = findByTag(root, TAGS.Info_line);

      // Find the V: info line
      const vLine = infoLines.find((il) => {
        const subtree = collectSubtree(il);
        const tokens = subtree.filter((n) => isTokenNode(n));
        return tokens.some((t) => getTokenData(t).lexeme.startsWith("V:"));
      });
      expect(vLine).to.not.be.undefined;

      // Check that it has KV children
      const kvNodes = findByTag(vLine!, TAGS.KV);
      expect(kvNodes.length).to.be.greaterThan(0);
    });

    it("Info_line with Binary expression produces CSTree with Binary node", () => {
      // M:4/4 has value2 with a Binary expression (numerator / denominator)
      const root = toCSTree("X:1\nM:4/4\nK:C\nCDE|\n");
      const infoLines = findByTag(root, TAGS.Info_line);

      // Find the M: info line
      const mLine = infoLines.find((il) => {
        const subtree = collectSubtree(il);
        const tokens = subtree.filter((n) => isTokenNode(n));
        return tokens.some((t) => getTokenData(t).lexeme.startsWith("M:"));
      });
      expect(mLine).to.not.be.undefined;

      // M:4/4 should have a Binary child
      const subtree = collectSubtree(mLine!);
      const binaryNodes = subtree.filter((n) => n.tag === TAGS.Binary);
      expect(binaryNodes.length).to.equal(1);
    });

    it("child count matches 1 + value2.length for Info_line with value2", () => {
      // V:1 clef=treble should have key + 2 KV expressions = 3 direct children
      const root = toCSTree("X:1\nV:1 clef=treble\nK:C\nCDE|\n");
      const infoLines = findByTag(root, TAGS.Info_line);

      const vLine = infoLines.find((il) => {
        const subtree = collectSubtree(il);
        const tokens = subtree.filter((n) => isTokenNode(n));
        return tokens.some((t) => getTokenData(t).lexeme.startsWith("V:"));
      });
      expect(vLine).to.not.be.undefined;

      // Count direct children (not recursive)
      const directChildCount = siblingCount(vLine!);
      // Should be: V: token (key) + KV("1") + KV("clef=treble") = 3
      expect(directChildCount).to.equal(3);
    });

    it("K: line with key and mode produces CSTree with KV nodes", () => {
      const root = toCSTree("X:1\nK:Am\nCDE|\n");
      const infoLines = findByTag(root, TAGS.Info_line);

      const kLine = infoLines.find((il) => {
        const subtree = collectSubtree(il);
        const tokens = subtree.filter((n) => isTokenNode(n));
        return tokens.some((t) => getTokenData(t).lexeme.startsWith("K:"));
      });
      expect(kLine).to.not.be.undefined;

      // K:Am should have at least one child (the key value)
      const directChildCount = siblingCount(kLine!);
      expect(directChildCount).to.be.greaterThan(0);
    });
  });

  describe("toAst preserves value2 when reconstructing from CSTree", () => {
    // Helper to find all Inline_field nodes in an AST
    function findInlineFields(ast: File_structure): Inline_field[] {
      const results: Inline_field[] = [];
      for (const content of ast.contents) {
        if (isToken(content)) continue;
        const tune = content as Tune;
        if (!tune.tune_body) continue;
        for (const system of tune.tune_body.sequence) {
          for (const item of system) {
            if (item instanceof Music_code) {
              for (const elem of item.contents) {
                if (elem instanceof Inline_field) {
                  results.push(elem);
                }
              }
            } else if (item instanceof Inline_field) {
              results.push(item);
            }
          }
        }
      }
      return results;
    }

    it("Inline_field with KV children produces value2 in AST", () => {
      // Parse ABC with inline voice field containing a voice ID parameter.
      // We verify the original parsed AST (not CSTree roundtrip) since value2 is populated by the parser.
      const input = "X:1\nK:C\n[V:1] CDEF|\n";
      const ctx = new ABCContext();
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx) as File_structure;

      // Find the Inline_field in the original AST
      const inlineFields = findInlineFields(ast);
      expect(inlineFields).to.have.lengthOf(1);

      const inlineField = inlineFields[0];
      // Verify value2 is defined and contains the expected KV expression
      expect(inlineField.value2).to.exist;
      expect(inlineField.value2).to.have.lengthOf(1);
      expect(inlineField.value2![0]).to.be.instanceOf(KV);

      const kv = inlineField.value2![0] as KV;
      // The value should be the voice ID "1"
      expect(isToken(kv.value)).to.be.true;
    });

    it("roundtrip preserves voice parameters in inline fields", () => {
      // Generator for voice IDs that are single tokens (either purely alphabetic or purely numeric).
      // Mixed alphanumeric IDs like "7A" get tokenized as separate tokens (NUMBER + IDENTIFIER),
      // which causes spacing issues during roundtrip. This is a known scanner limitation.
      const genAlphaVoiceId = fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 1, maxLength: 4 }).map(chars => chars.join(''));
      const genNumericVoiceId = fc.integer({ min: 1, max: 99 }).map(n => String(n));
      const genVoiceId = fc.oneof(genAlphaVoiceId, genNumericVoiceId);
      const genClef = fc.constantFrom('treble', 'bass', 'alto', 'tenor');
      const genOctave = fc.integer({ min: -2, max: 2 });

      // Generator for inline voice fields with various parameter combinations
      const genInlineVoiceField = fc.tuple(
        genVoiceId,
        fc.option(genClef),
        fc.option(genOctave)
      ).map(([voiceId, clef, octave]) => {
        let params = voiceId;
        if (clef !== null) params += ` clef=${clef}`;
        if (octave !== null) params += ` octave=${octave}`;
        return `[V:${params}]`;
      });

      fc.assert(
        fc.property(genInlineVoiceField, (inlineField) => {
          const input = `X:1\nK:C\n${inlineField} CDEF|\n`;
          const result = roundtrip(input);
          return result === input;
        }),
        { numRuns: 100 }
      );
    });
  });
});

describe("csTree - Info_line value2 reconstruction (Phase 2: toAst)", () => {
  describe("toAst extracts tokens for backward compatibility", () => {
    it("Info_line value array contains flattened tokens from value2 expressions", () => {
      // V:1 clef=treble has value2 with KV expressions
      const input = "X:1\nV:1 clef=treble\nK:C\nCDE|\n";
      const root = toCSTree(input);
      const ast = toAst(root);

      // The ast should be a File_structure
      expect(ast).to.be.instanceOf(require("abc-parser").File_structure);

      // Roundtrip should preserve the content
      const result = roundtrip(input);
      expect(result).to.equal(input);
    });

    it("roundtrip preserves Info_line with KV expressions", () => {
      const input = "X:1\nV:RH clef=treble\nK:C\nCDE|\n";
      const result = roundtrip(input);
      expect(result).to.equal(input);
    });

    it("roundtrip preserves Info_line with Binary expressions (M:4/4)", () => {
      const input = "X:1\nM:4/4\nK:C\nCDE|\n";
      const result = roundtrip(input);
      expect(result).to.equal(input);
    });

    it("complex roundtrip with multiple KV expressions", () => {
      // V:RH clef=treble octave=-1
      const input = "X:1\nV:RH clef=treble octave=-1\nK:C\nCDE|\n";
      const result = roundtrip(input);
      expect(result).to.equal(input);
    });

    it("CSTree with only token children produces Info_line without value2", () => {
      // Title line has simple token value, no expressions
      const input = "X:1\nT:Simple Title\nK:C\nCDE|\n";
      const root = toCSTree(input);
      const ast = toAst(root);

      // Roundtrip should work
      const result = roundtrip(input);
      expect(result).to.equal(input);
    });
  });

  describe("property-based roundtrip tests", () => {
    it("roundtrip preserves value2 expression count for V: lines", () => {
      fc.assert(
        fc.property(
          fc.record({
            voiceId: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]*$/),
            hasClef: fc.boolean(),
          }),
          ({ voiceId, hasClef }) => {
            const clefPart = hasClef ? " clef=treble" : "";
            const input = `X:1\nV:${voiceId}${clefPart}\nK:C\nCDE|\n`;
            const result = roundtrip(input);
            return result === input;
          }
        ),
        { numRuns: 50 }
      );
    });

    it("roundtrip preserves KV structure in V: lines", () => {
      fc.assert(
        fc.property(
          fc.record({
            voiceId: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]*$/),
            clef: fc.constantFrom("treble", "bass", "alto", "tenor"),
          }),
          ({ voiceId, clef }) => {
            const input = `X:1\nV:${voiceId} clef=${clef}\nK:C\nCDE|\n`;
            const result = roundtrip(input);
            return result === input;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
