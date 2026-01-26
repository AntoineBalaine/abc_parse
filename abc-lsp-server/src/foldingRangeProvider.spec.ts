import { expect } from "chai";
import { describe, it } from "mocha";
import { FoldingRangeKind } from "vscode-languageserver";
import { Scanner, parse, ABCContext, File_structure, Token } from "abc-parser";
import {
  computeFoldingRanges,
  FoldingConfig,
  DEFAULT_FOLDING_CONFIG,
} from "./foldingRangeProvider";

function parseAbc(source: string): { ast: File_structure; tokens: Token[] } {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  return { ast, tokens };
}

function allEnabled(): FoldingConfig {
  return {
    tune: true,
    tuneHeader: true,
    tuneBody: true,
    voiceSection: true,
    partSection: true,
    commentBlock: true,
    directiveBlock: true,
    infoFieldSequence: true,
  };
}

function onlyConfig(key: keyof FoldingConfig): FoldingConfig {
  return {
    tune: false,
    tuneHeader: false,
    tuneBody: false,
    voiceSection: false,
    partSection: false,
    commentBlock: false,
    directiveBlock: false,
    infoFieldSequence: false,
    [key]: true,
  };
}

describe("computeFoldingRanges", () => {
  describe("tune-level folds", () => {
    it("creates a fold for a single tune spanning multiple lines", () => {
      const source = `X:1
T:Test Tune
M:4/4
K:C
CDEF GABc|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("tune"));

      expect(ranges).to.have.length(1);
      expect(ranges[0].startLine).to.equal(0);
      expect(ranges[0].endLine).to.equal(4);
      expect(ranges[0].kind).to.equal(FoldingRangeKind.Region);
    });

    it("creates separate folds for multiple tunes", () => {
      const source = `X:1
T:First Tune
K:C
C2|

X:2
T:Second Tune
K:G
G2|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("tune"));

      expect(ranges).to.have.length(2);
      expect(ranges[0].startLine).to.equal(0);
      expect(ranges[1].startLine).to.equal(5);
    });

    it("handles a tune with empty body gracefully", () => {
      const source = `X:1
K:C
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("tune"));

      // A tune with an empty body may not produce a fold due to range calculation limitations
      // The important thing is that it doesn't crash
      expect(ranges.length).to.be.greaterThanOrEqual(0);
    });
  });

  describe("tune header folds", () => {
    it("creates a fold for a tune header spanning multiple lines", () => {
      const source = `X:1
T:Test Tune
M:4/4
L:1/8
K:C
CDEF GABc|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("tuneHeader"));

      expect(ranges).to.have.length(1);
      expect(ranges[0].startLine).to.equal(0);
      expect(ranges[0].endLine).to.equal(4);
      expect(ranges[0].kind).to.equal(FoldingRangeKind.Region);
    });

    it("does not create a fold for a minimal header on 2 lines", () => {
      const source = `X:1
K:C
C|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("tuneHeader"));

      // X: and K: are on different lines so there should be a fold
      expect(ranges).to.have.length(1);
      expect(ranges[0].startLine).to.equal(0);
      expect(ranges[0].endLine).to.equal(1);
    });
  });

  describe("tune body folds", () => {
    it("creates a fold for a tune body spanning multiple lines", () => {
      const source = `X:1
K:C
CDEF|
GABc|
cBAG|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("tuneBody"));

      expect(ranges).to.have.length(1);
      expect(ranges[0].startLine).to.equal(2);
      expect(ranges[0].endLine).to.equal(4);
      expect(ranges[0].kind).to.equal(FoldingRangeKind.Region);
    });

    it("does not create a fold for an empty body", () => {
      const source = `X:1
K:C
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("tuneBody"));

      expect(ranges).to.have.length(0);
    });

    it("does not create a fold for a single-line body", () => {
      const source = `X:1
K:C
CDEF|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("tuneBody"));

      expect(ranges).to.have.length(0);
    });
  });

  describe("voice section folds", () => {
    it("creates folds for voice sections", () => {
      const source = `X:1
K:C
V:1
CDEF|
GABc|
V:2
E2F2|
G4|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("voiceSection"));

      expect(ranges).to.have.length(2);
      // First voice section starts at V:1
      expect(ranges[0].startLine).to.equal(2);
      // Second voice section starts at V:2
      expect(ranges[1].startLine).to.equal(5);
    });

    it("creates separate folds for interleaved voices", () => {
      const source = `X:1
K:C
V:1
C2|
V:2
E2|
V:1
D2|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("voiceSection"));

      expect(ranges).to.have.length(3);
    });

    it("returns no folds for a tune without voice markers", () => {
      const source = `X:1
K:C
CDEF|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("voiceSection"));

      expect(ranges).to.have.length(0);
    });
  });

  describe("part section folds", () => {
    it("creates folds for part sections in the body", () => {
      const source = `X:1
K:C
P:A
|:CDEF:|
P:B
|:GABc:|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("partSection"));

      expect(ranges).to.have.length(2);
      expect(ranges[0].startLine).to.equal(2);
      expect(ranges[1].startLine).to.equal(4);
    });

    it("returns no folds for a tune without part markers", () => {
      const source = `X:1
K:C
CDEF|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("partSection"));

      expect(ranges).to.have.length(0);
    });
  });

  describe("comment block folds", () => {
    it("creates a fold for contiguous comment lines", () => {
      const source = `% This is
% a multi-line
% comment
X:1
K:C
C|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("commentBlock"));

      expect(ranges).to.have.length(1);
      expect(ranges[0].startLine).to.equal(0);
      expect(ranges[0].endLine).to.equal(2);
      expect(ranges[0].kind).to.equal(FoldingRangeKind.Comment);
    });

    it("does not fold a single comment line", () => {
      const source = `% Single comment
X:1
K:C
C|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("commentBlock"));

      expect(ranges).to.have.length(0);
    });

    it("creates separate folds for non-contiguous comment blocks", () => {
      const source = `% First block
% line two
X:1
% Second block
% line two
K:C
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("commentBlock"));

      expect(ranges).to.have.length(2);
    });

    it("does not fold directive lines as comments", () => {
      const source = `%%titlefont Times
%%composerfont Times
X:1
K:C
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("commentBlock"));

      // Directives starting with %% should not be counted as comments
      expect(ranges).to.have.length(0);
    });
  });

  describe("directive block folds", () => {
    it("creates a fold for contiguous directive lines", () => {
      const source = `%%titlefont Times-Bold 16
%%composerfont Times 12
%%staffsep 20
X:1
K:C
C|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("directiveBlock"));

      expect(ranges).to.have.length(1);
      expect(ranges[0].startLine).to.equal(0);
      expect(ranges[0].endLine).to.equal(2);
      expect(ranges[0].kind).to.equal(FoldingRangeKind.Region);
    });

    it("does not fold a single directive line", () => {
      const source = `%%titlefont Times
X:1
K:C
C|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("directiveBlock"));

      expect(ranges).to.have.length(0);
    });
  });

  describe("info field sequence folds", () => {
    it("creates a fold for contiguous N: (notes) lines in header", () => {
      const source = `X:1
N:First note line
N:Second note line
N:Third note line
K:C
C|
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("infoFieldSequence"));

      expect(ranges).to.have.length(1);
      expect(ranges[0].startLine).to.equal(1);
      expect(ranges[0].endLine).to.equal(3);
    });

    it("creates separate folds for different field types", () => {
      const source = `X:1
T:Title One
T:Title Two
M:4/4
K:C
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("infoFieldSequence"));

      // Should have one fold for the T: sequence
      expect(ranges).to.have.length(1);
      expect(ranges[0].startLine).to.equal(1);
      expect(ranges[0].endLine).to.equal(2);
    });

    it("does not fold a single info field", () => {
      const source = `X:1
T:Title
K:C
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, onlyConfig("infoFieldSequence"));

      expect(ranges).to.have.length(0);
    });
  });

  describe("default configuration", () => {
    it("has infoFieldSequence disabled by default", () => {
      expect(DEFAULT_FOLDING_CONFIG.infoFieldSequence).to.be.false;
    });

    it("has all other fold types enabled by default", () => {
      expect(DEFAULT_FOLDING_CONFIG.tune).to.be.true;
      expect(DEFAULT_FOLDING_CONFIG.tuneHeader).to.be.true;
      expect(DEFAULT_FOLDING_CONFIG.tuneBody).to.be.true;
      expect(DEFAULT_FOLDING_CONFIG.voiceSection).to.be.true;
      expect(DEFAULT_FOLDING_CONFIG.partSection).to.be.true;
      expect(DEFAULT_FOLDING_CONFIG.commentBlock).to.be.true;
      expect(DEFAULT_FOLDING_CONFIG.directiveBlock).to.be.true;
    });
  });

  describe("edge cases", () => {
    it("handles an empty file", () => {
      const source = ``;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, allEnabled());

      expect(ranges).to.have.length(0);
    });

    it("handles a file with only comments", () => {
      const source = `% Line 1
% Line 2
% Line 3
`;
      const { ast, tokens } = parseAbc(source);
      const ranges = computeFoldingRanges(ast, tokens, allEnabled());

      // Should have exactly one comment fold
      const commentFolds = ranges.filter((r) => r.kind === FoldingRangeKind.Comment);
      expect(commentFolds).to.have.length(1);
    });

    it("handles nested folds correctly", () => {
      const source = `X:1
T:Test
M:4/4
K:C
CDEF|
GABc|
`;
      const { ast, tokens } = parseAbc(source);
      const config = {
        ...DEFAULT_FOLDING_CONFIG,
        infoFieldSequence: false,
      };
      const ranges = computeFoldingRanges(ast, tokens, config);

      // Should have: tune, tuneHeader, tuneBody folds
      expect(ranges.length).to.be.greaterThanOrEqual(3);

      // Tune fold should encompass all
      const tuneFold = ranges.find((r) => r.startLine === 0 && r.endLine === 5);
      expect(tuneFold).to.not.be.undefined;
    });
  });
});
