import assert from "assert";
import chai from "chai";
import { AbcFormatter } from "../Visitors/Formatter";
import { System } from "../types/types";
import { buildParse, removeTuneHeader } from "./RhythmTransform.spec";
import { RunVoiceSystemsTest, SystemLineTest } from "./helpers.spec";
import { ABCContext } from "../parsers/Context";

const expect = chai.expect;

// describe.skip("Format Systems", function () {
//   const SystemLineTests: SystemLineTest[] = [
//     {
//       title: "format a single system",
//       test: (systems: Array<System>, expected) => {
//         const ctx = new ABCContext();
//         const formatter = new AbcFormatter(ctx);
//         const fmt = formatter.formatSystem(systems[0]);
//         expect(fmt).to.not.be.undefined;
//         assert.equal(fmt, expected);
//       },
//       input: `V:1
// V:2
// [V:1]abc|ab
// [V:2]cd|dc
// `,
//       expected: `[V:1] abc | ab
// [V:2] cd  | dc`,
//     },
//     {
//       title: "format multiple systems",
//       test: (systems: Array<System>, expected) => {
//         const ctx = new ABCContext();
//         const formatter = new AbcFormatter(ctx);
//         const fmt = systems
//           .map((system) => {
//             return formatter.formatSystem(system);
//           })
//           .join("");
//         assert.equal(fmt, expected);
//       },
//       input: `V:1\nV:2\n[V:1]abc|ab\n[V:2]cd|dc\n[V:1]ab|ab\n[V:2]cde|dc\n`,
//       expected: `[V:1] abc | ab\n[V:2] cd  | dc\n[V:1] ab  | ab\n[V:2] cde | dc\n`,
//     },
//     {
//       title: "format multiple systems with comment lines interspersed",
//       test: (systems: Array<System>, expected) => {
//         const ctx = new ABCContext();
//         const formatter = new AbcFormatter(ctx);
//         const fmt = systems
//           .map((system) => {
//             return formatter.formatSystem(system);
//           })
//           .join("");
//         assert.equal(fmt, expected);
//       },
//       input: `V:1\nV:2\n[V:1]abc|ab\n%surprise!\n[V:2]cde|dc
// [V:1]ab|ab\n%surprise!\n[V:2]cde|dc\n`,
//       expected: `[V:1] abc | ab\n%surprise!\n[V:2] cde | dc
// [V:1] ab  | ab\n%surprise!\n[V:2] cde | dc\n`,
//     },
//     {
//       title: "format multiple systems with comment lines interspersed",
//       test: (systems: Array<System>, expected) => {
//         const ctx = new ABCContext();
//         const formatter = new AbcFormatter(ctx);
//         const fmt = systems
//           .map((system) => {
//             return formatter.formatSystem(system);
//           })
//           .join("");
//         assert.equal(fmt, expected);
//       },
//       input: `V:3\nV:4\n[V:3] B,2 C2  | D C B, A,    | B, C2 B,   | B,2 A,2  | HD4   |
// [V:4] G,2 A,2 | B, A, G,^F, | G, A, B, G, | E, C, F,2 | HB,,4 |`,
//       expected: `[V:3] B,2 C2  | D C B, A,   | B, C2 B,    | B,2 A,2   | HD4   |
// [V:4] G,2 A,2 | B, A, G,^F, | G, A, B, G, | E, C, F,2 | HB,,4 |`,
//     },
//   ];
//   SystemLineTests.forEach(({ title, test, input, expected }) => {
//     it(title, RunVoiceSystemsTest(input, test, expected));
//   });
// });

describe.skip("Format Info Lines in Tune Header", function () {
  const SystemLineTests: SystemLineTest[] = [
    {
      title: "format a tune header containing info lines only",
      test: (input, expected) => {
        const ctx = new ABCContext();
        const parse = buildParse(input, ctx);
        const tune_header = parse.tune[0].tune_header;
        const formatter = new AbcFormatter(ctx);
        const fmt = formatter.visitTuneHeaderExpr(tune_header);
        expect(fmt).to.not.be.undefined;
        assert.equal(fmt, expected);
      },
      input: `M:4/4\nL:1/8\nK:C\n`,
      expected: `X:1\nM:4/4\nL:1/8\nK:C\n`,
    },
    {
      title: "format a tune header containing comments",
      test: (input, expected) => {
        const ctx = new ABCContext();
        const parse = buildParse(input, ctx);
        const tune_header = parse.tune[0].tune_header;
        const formatter = new AbcFormatter(ctx);
        const fmt = formatter.visitTuneHeaderExpr(tune_header);
        expect(fmt).to.not.be.undefined;
        assert.equal(fmt, expected);
      },
      input: `M:4/4\nL:1/8\n%surprise\nK:C\n`,
      expected: `X:1\nM:4/4\nL:1/8\n%surprise\nK:C\n`,
    },
  ];

  SystemLineTests.forEach(({ title, test, input, expected }) => {
    it(title, () => {
      test(input, expected);
    });
  });
});

describe.skip("Format Info Lines in Tune Body", function () {
  const SystemLineTests: SystemLineTest[] = [
    {
      title: "format a tune header containing info lines only",
      test: (input, expected) => {
        const ctx = new ABCContext();
        const parse = buildParse(input, ctx);
        const tune_body = parse.tune[0].tune_body;
        expect(tune_body).to.not.be.undefined;
        if (!tune_body) {
          return;
        }
        const formatter = new AbcFormatter(ctx);
        const fmt = formatter.visitTuneBodyExpr(tune_body);
        expect(fmt).to.not.be.undefined;
        assert.equal(fmt, expected);
      },
      input: `abc\nM:4/4\nL:1/8\nK:C\n`,
      expected: `abc\nM:4/4\nL:1/8\nK:C\n`,
    },
  ];
  SystemLineTests.forEach(({ title, test, input, expected }) => {
    it(title, () => {
      test(input, expected);
    });
  });
});

describe.skip("Formatter", function () {
  /*   describe.skip("extracts voices names", function () {
      const voicesNames = ["T1", "T2", "B1", "B2"];
      it("extracts multiple voices", function () {
        if (!!voicesNames && voicesNames.length > 0) {
          assert.deepEqual(
            findVoicesHandles(headerAndBody.headerText).map((i) => i?.toString()),
            voicesNames
          );
        }
      });
    }); */

  describe.skip("formats text", function () {
    const input = "[V:T1] (B2c2 d2g2)   | f6e2   |   (d2c2 d2)e2 | d4 c2z2 |";
    const expected_no_format = (" " + input).slice(1);
    const expected_fmt = "[V:T1] (B2c2 d2g2) | f6e2 | (d2c2 d2)e2 | d4 c2z2 |";

    it("can visit the tree without modifying source", function () {
      const ctx = new ABCContext();
      const fmt = new AbcFormatter(ctx).stringify(buildParse(input, ctx));
      assert.equal(removeTuneHeader(fmt).trim(), expected_no_format);
    });
    it("removes useless double spaces", function () {
      const ctx = new ABCContext();
      const fmt = new AbcFormatter(ctx).format(buildParse(input, ctx));
      assert.equal(removeTuneHeader(fmt).trim(), expected_fmt);
    });

    /*     it("aligns barlines in score system", function () {
          const unformattedLine = `[V:T1]  (B2c2 d2g2)  | f6e2      | (d2c2 d2)e2 | d4 c2z2 |
    [V:T2](G2A2 B2e2)  | d6c2  | (B2A2 B2)c2| B4 A2z2|`;
          const formattedLine = `[V:T1] (B2c2 d2g2) | f6e2 | (d2c2 d2)e2 | d4 c2z2 |
    [V:T2] (G2A2 B2e2) | d6c2 | (B2A2 B2)c2 | B4 A2z2 |`;

          assert.equal(
            formatLineSystem(0, unformattedLine.length + 1, unformattedLine),
            formattedLine
          );
        }); */

    /*     it("inserts spaces around bar lines", function () {
          const unformatted = "[V:T1](B2c2 d2g2)|f6e2|(d2c2 d2)e2|d4 c2z2|";
          const formatted = "[V:T1] (B2c2 d2g2) | f6e2 | (d2c2 d2)e2 | d4 c2z2 |";
          assert.equal(
            formatLineSystem(0, unformatted.length + 1, unformatted),
            formatted
          );
        }); */

    /*     describe.skip("aligns starts of notes in system", function () {
          it("starts music at the same index for every line in system", function () {
            const unformatted = `
    [V: str] abcd |
    [V: wd] abcd |
    [V:3] abcd |
    w: abcd |`;

            const formatted = `
    [V: str] abcd |
    [V: wd]  abcd |
    [V:3]    abcd |
    w:       abcd |`;
            assert.equal(startAllNotesAtSameIndexInLine(unformatted), formatted);
          });
          it("inserts spaces between nomenclature tag and start of music", function () {
            const unformatted = `[V:T1](B2c2 d2g2)  |f6e2`;
            const formatted = `[V:T1] (B2c2 d2g2)  |f6e2`;
            assert.equal(startAllNotesAtSameIndexInLine(unformatted), formatted);
          });
        }); */
  });
  describe.skip("format rhythms", () => {
    const sample = [
      ["a/2", "a/"],
      ["a//", "a/4"],
      ["z/2", "z/"],
      ["z//", "z/4"],
    ];
    sample.forEach(([input, expected]) => {
      it(`should format ${input} into ${expected}`, () => {
        const ctx = new ABCContext();
        const fmt = new AbcFormatter(ctx).format(buildParse(input, ctx));
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });

  /*   describe.skip("formats a whole score", function () {
    it("splices chunks of score correctly", function () {
      assert.equal("Hallo", spliceText("hello", 0, 2, "Ha"));
    });
    it("formats the whole score", function () {
      assert.equal(formatScore(multiVoice_Tune), multiVoice_Tune_formatted);
    });
  }); */
  describe.skip("format lyrics", function () {
    /*     describe.skip("using helper functions", function () {
          it("finds ends of chords in string", function () {
            assert.equal(findEndOfChord("[^C=B_E]", { pos: 0 }), 8);
            assert.equal(findEndOfChord("[^C,=B_E]2", { pos: 0 }), 10);
            assert.equal(findEndOfChord("[^C=b''_E]/4", { pos: 0 }), 12);
            assert.equal(findEndOfChord("[^C=B_E]/4", { pos: 0 }), 10);
          });
          it("finds ends of notes in string", function () {
            assert.equal(findEndOfNote("^C///=B", { pos: 0 }), 5);
            assert.equal(findEndOfNote("^c''=B", { pos: 0 }), 4);
            assert.equal(findEndOfNote("^C,,=B", { pos: 0 }), 4);
            assert.equal(findEndOfNote("^C,,/2=B", { pos: 0 }), 6);
            assert.equal(findEndOfNote("^c''///=B", { pos: 0 }), 7);
          });
          it("finds first preceding music line index", function () {
            const text1 = `
    [V:1] abcd |
    w: a lyric line
    [V:2] abcd |
    w: a second lyric line`;
            const text2 = `
    [V:1] abcd |
    K:C a nomenclature line
    w: a lyricline`;
            const text3 = `
    [V:1] abcd |
    w: a lyricline
    w: a second lyricline`;
            assert.equal(
              findFirstPrecedingMusicLineIndex(
                text1.split("\n").filter((n) => n),
                3
              ),
              2
            );
            assert.equal(
              findFirstPrecedingMusicLineIndex(
                text2.split("\n").filter((n) => n),
                2
              ),
              0
            );
            assert.equal(
              findFirstPrecedingMusicLineIndex(
                text3.split("\n").filter((n) => n),
                2
              ),
              -1
            );
          });
          it("finds subdivisions in a note group", function () {
            const grp1 = `_a_bc_d!fermata!_A2`;
            const grp1Divisé = [`_a_bc_d!fermata!`, `_A2`];
            const grp2 = `_a_bc_d!fermata!_A2abc"annotation"abdec`;
            const grp2Divisé = [`_a_bc_d!fermata!`, `_A2abc"annotation"`, `abdec`];
            const grp3 = `_a_bc_d!fermata!_A2abc"annotation"abdec[K:C]^C,,adec`;
            const grp3Divisé = [
              `_a_bc_d!fermata!`,
              `_A2abc"annotation"`,
              `abdec[K:C]`,
              `^C,,adec`,
            ];
            assert.deepEqual(findSubdivisionsInNoteGroup(grp1, ""), {
              subdivisionsInNoteGroup: grp1Divisé,
            });
            assert.deepEqual(findSubdivisionsInNoteGroup(grp2, ""), {
              subdivisionsInNoteGroup: grp2Divisé,
            });
            assert.deepEqual(findSubdivisionsInNoteGroup(grp3, ""), {
              subdivisionsInNoteGroup: grp3Divisé,
            });
          });
          it("counts notes in group of notes", function () {
            assert.equal(countNotesInSubGroup("CCGG"), 4);
            assert.equal(countNotesInSubGroup("^C/C_G//=G/2"), 4);
            assert.equal(countNotesInSubGroup("CC!fermata!"), 2);
            assert.equal(countNotesInSubGroup("^C//_B2!fermata!"), 2);
            assert.equal(countNotesInSubGroup('^C//_B2"this is an annotation"'), 2);
          });
          it("formats Note Groups with Corresponding Lyrics", function () {
            assert.deepEqual(
              formatNoteGroupsAndCorrespondingLyrics(
                `CCGG`,
                `À vous di rai je ma man`.split(" ")
              ).__return,
              {
                noteGroup: "CCGG         ",
                lyricGroup: "À vous di rai",
              }
            );
            assert.deepEqual(
              formatNoteGroupsAndCorrespondingLyrics(
                `CC!fermata!GG`,
                `À vous di rai je ma man`.split(" ")
              ).__return,
              {
                noteGroup: "CC!fermata!GG    ",
                lyricGroup: "À vous     di rai",
              }
            );
          });
        }); */
    /*     describe.skip("usign alignLyrics function", function () {
      const unformatted1 = `
[V:T1] CC GG AA G2 | FF EE DD C2 |
w: À vous di rai je ma man | Ce qui cau se mon tour ment | `;
      const formatted1 = `
[V:T1] CC     GG     AA    G2  | FF     EE     DD       C2   |
w:     À vous di rai je ma man | Ce qui cau se mon tour ment | `;

      it("formats single lign of music", function () {
        assert.equal(alignLyrics(unformatted1), formatted1);
      });

      const unformatted2 = `
[V:T1] CC G"annotation here, just for fun"G AA G2 | FF EE DD C2 |
w: À vous di rai je ma man | Ce qui cau se mon tour ment | `;
      const formatted2 = `
[V:T1] CC     G"annotation here, just for fun"G     A!fermata!A G2  | FF     EE     DD       C2   |
w:     À vous di rai                                je ma       man | Ce qui cau se mon tour ment | `;
      it("formats line of music with annotations and symbols", function () {
        assert.equal(alignLyrics(unformatted2), formatted2);
      });
    }); */
  });
});

describe.skip("Formatter: Stringify", () => {
  describe.skip("stringify grace groups", () => {
    const sample = [
      ["{b}c", "{b}c"],
      ["{/b}c", "{/b}c"],
    ];
    sample.forEach(([input, expected]) => {
      it(`should stringify ${input} into ${expected}`, () => {
        const ctx = new ABCContext();
        const fmt = new AbcFormatter(ctx).stringify(buildParse(input, ctx));
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });
  describe.skip("stringify notes with ties", () => {
    const sample = [["a-", "a-"]];
    sample.forEach(([input, expected]) => {
      it(`should stringify ${input} into ${expected}`, () => {
        const ctx = new ABCContext();
        const fmt = new AbcFormatter(ctx).stringify(buildParse(input, ctx));
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });
});

describe.skip("Formatter: Whitespace handling", () => {
  const errorSamples = [
    {
      title: "removes trailing whitespaces",
      input: "ab | \\   ",
      expected: "ab | \\",
    },
    { title: "handles slurs correctly", input: "a| (d4 e2)|", expected: "a | (d4 e2) |" },
  ];

  describe.skip("using format()", () => {
    errorSamples.forEach(({ title, input, expected }) => {
      it(title, () => {
        const ctx = new ABCContext();
        const formatter = new AbcFormatter(ctx);
        const parse = buildParse(input, ctx);
        const result = formatter.format(parse);
        assert.equal(removeTuneHeader(result).trim(), expected);
      });
    });
  });
});
describe.skip("Formatter: Error Preservation", () => {
  const errorSamples = [
    {
      title: "preserves invalid decoration",
      input: "~23 abc",
      expected: "~23 abc",
    },
    {
      title: "preserves invalid escaped character",
      input: "abc \\e def",
      expected: "abc \\e def",
    },
    {
      title: "preserves invalid chord syntax",
      input: "abc [CE def",
      expected: "abc [CE def",
    },
    {
      title: "preserves error tokens while formatting valid parts",
      input: "abc ~23 | def",
      expected: "abc ~23 | def",
    },

    {
      title: "removes trailing whitespaces",
      input: "ab | \\   ",
      expected: "ab | \\",
    },
    { title: "error at end of input", input: "abcî", expected: "abc î" },
  ];

  // Test both stringify and format methods
  describe.skip("using stringify()", () => {
    errorSamples.forEach(({ title, input, expected }) => {
      it(title, () => {
        const ctx = new ABCContext();
        const formatter = new AbcFormatter(ctx);
        const parse = buildParse(input, ctx);
        const result = formatter.stringify(parse);
        assert.equal(removeTuneHeader(result).trim(), expected);
      });
    });
  });

  describe.skip("using format()", () => {
    errorSamples.forEach(({ title, input, expected }) => {
      it(title, () => {
        const ctx = new ABCContext();
        const formatter = new AbcFormatter(ctx);
        const parse = buildParse(input, ctx);
        const result = formatter.format(parse);
        assert.equal(removeTuneHeader(result).trim(), expected);
      });
    });
  });

  // Test that errors are preserved even in complex contexts
  it("preserves errors in multi-voice context", () => {
    const input = `[V:1]abc ~23 |\n[V:2]def \\e |\n`;
    const expected = `[V:1] abc ~23 |\n[V:2] def \\e |`;

    const ctx = new ABCContext();
    const formatter = new AbcFormatter(ctx);
    const parse = buildParse(input, ctx);
    const result = formatter.format(parse);
    assert.equal(removeTuneHeader(result).trim(), expected);
  });

  // Test that error nodes don't break formatting of surrounding valid code
  it("maintains formatting of valid code around errors", () => {
    const input = "abc  ~23  def  |  ghi";
    const expected = "abc ~23 def | g hi"; // Assume that errors are separated from the rest

    const ctx = new ABCContext();
    const formatter = new AbcFormatter(ctx);
    const parse = buildParse(input, ctx);
    const result = formatter.format(parse);
    assert.equal(removeTuneHeader(result).trim(), expected);
  });
});
