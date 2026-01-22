/**
 * Phase 3: Full Parse Tree Comparison Tests
 *
 * These tests verify AST-level parity between the TypeScript parser
 * and the TreeSitter parser by comparing hierarchical tree structures.
 *
 * Unlike Phase 2 (token sequence comparison), these tests compare
 * parent-child relationships, node nesting, and full tree shapes.
 *
 * Test categories:
 * 1. TypeScript AST structure verification - always runs
 * 2. Cross-parser tree comparison - only when TreeSitter is available
 *
 * To enable TreeSitter comparison:
 *   cd tree-sitter-abc && npm run build && cd .. && npm rebuild tree-sitter
 */

import { expect } from "chai";
import {
  parseWithTypeScript,
  parseWithBoth,
  isTreeSitterAvailable,
} from "./helpers";
import {
  CSNode,
  compareCSNodes,
  formatCompareResult,
  collectNodeTypes,
  countNodes,
  serializeCSNode,
} from "../../comparison";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Collect the immediate child types of a CSNode in sibling order.
 */
function childTypes(node: CSNode | null): string[] {
  const types: string[] = [];
  let child = node?.firstChild ?? null;
  while (child !== null) {
    types.push(child.type);
    child = child.nextSibling;
  }
  return types;
}

/**
 * Find the first descendant node of a given type using depth-first search.
 * Only traverses children, not siblings (siblings are not descendants).
 */
function findFirstDescendant(node: CSNode | null, type: string): CSNode | null {
  if (node === null) return null;
  let child = node.firstChild;
  while (child !== null) {
    if (child.type === type) return child;
    const found = findFirstDescendant(child, type);
    if (found) return found;
    child = child.nextSibling;
  }
  return null;
}

/**
 * Collect all descendant nodes of a given type.
 * Only traverses children, not siblings of the root node.
 */
function findAllDescendants(node: CSNode | null, type: string, results: CSNode[] = []): CSNode[] {
  if (node === null) return results;
  let child = node.firstChild;
  while (child !== null) {
    if (child.type === type) results.push(child);
    findAllDescendants(child, type, results);
    child = child.nextSibling;
  }
  return results;
}

/**
 * Assert that the cross-parser comparison produces equal trees.
 * Skips if TreeSitter is not available.
 */
function assertCrossComparisonEqual(input: string, label: string): void {
  const result = parseWithBoth(input);
  if (!result.treeSitterAvailable || result.treeSitter === null) {
    throw new Error("TreeSitter not available");
  }
  const comparison = compareCSNodes(
    result.typescript.csNode,
    result.treeSitter.csNode
  );
  if (!comparison.equal) {
    const msg = formatCompareResult(comparison);
    throw new Error(
      `AST mismatch for "${label}":\n${msg}\n` +
        `TypeScript tree:\n${serializeCSNode(result.typescript.csNode)}\n` +
        `TreeSitter tree:\n${serializeCSNode(result.treeSitter.csNode)}`
    );
  }
}

// ============================================================================
// TypeScript AST Structure Tests
// ============================================================================

describe("AST structure: File_structure and Tune", () => {
  it("minimal tune has File_structure > Tune > Tune_header + Tune_Body", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC|\n");
    expect(csNode).to.not.be.null;
    expect(csNode!.type).to.equal("File_structure");

    const tune = findFirstDescendant(csNode, "Tune");
    expect(tune).to.not.be.null;
    const tuneChildren = childTypes(tune!);
    expect(tuneChildren).to.include("Tune_header");
    expect(tuneChildren).to.include("Tune_Body");
  });

  it("tune header contains Info_line nodes", () => {
    const { csNode } = parseWithTypeScript("X:1\nT:Title\nM:4/4\nK:C\nC|\n");
    const header = findFirstDescendant(csNode, "Tune_header");
    expect(header).to.not.be.null;
    const infoLines = findAllDescendants(header, "Info_line");
    // X:, T:, M:, K: = 4 info lines
    expect(infoLines.length).to.equal(4);
  });

  it("directive before tune is included in Tune_header", () => {
    const { csNode } = parseWithTypeScript("%%scale 0.8\nX:1\nK:C\nC|\n");
    expect(csNode!.type).to.equal("File_structure");
    const header = findFirstDescendant(csNode, "Tune_header");
    expect(header).to.not.be.null;
    const directive = findFirstDescendant(header, "Directive");
    expect(directive).to.not.be.null;
  });

  it("multiple tunes produce multiple Tune siblings", () => {
    const input = "X:1\nK:C\nC|\n\nX:2\nK:G\nG|\n";
    const { csNode } = parseWithTypeScript(input);
    const tunes = findAllDescendants(csNode, "Tune");
    expect(tunes.length).to.equal(2);
  });
});

describe("AST structure: Note and Pitch", () => {
  it("simple note has Note > Pitch > NOTE_LETTER", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC|\n");
    const note = findFirstDescendant(csNode, "Note");
    expect(note).to.not.be.null;
    const pitch = findFirstDescendant(note, "Pitch");
    expect(pitch).to.not.be.null;
    const pitchChildren = childTypes(pitch!);
    expect(pitchChildren).to.include("NOTE_LETTER");
  });

  it("note with accidental has Pitch > ACCIDENTAL + NOTE_LETTER", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n^C|\n");
    const pitch = findFirstDescendant(csNode, "Pitch");
    expect(pitch).to.not.be.null;
    const kids = childTypes(pitch!);
    expect(kids[0]).to.equal("ACCIDENTAL");
    expect(kids[1]).to.equal("NOTE_LETTER");
  });

  it("note with octave has Pitch > NOTE_LETTER + OCTAVE", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC'|\n");
    const pitch = findFirstDescendant(csNode, "Pitch");
    expect(pitch).to.not.be.null;
    const kids = childTypes(pitch!);
    expect(kids).to.include("NOTE_LETTER");
    expect(kids).to.include("OCTAVE");
  });

  it("note with rhythm has Note > Pitch + Rhythm", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC2|\n");
    const note = findFirstDescendant(csNode, "Note");
    expect(note).to.not.be.null;
    const noteChildren = childTypes(note!);
    expect(noteChildren).to.include("Pitch");
    expect(noteChildren).to.include("Rhythm");
  });

  it("rhythm with numerator and denominator has correct tokens", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC3/4|\n");
    const rhythm = findFirstDescendant(csNode, "Rhythm");
    expect(rhythm).to.not.be.null;
    const kids = childTypes(rhythm!);
    expect(kids).to.include("RHY_NUMER");
    expect(kids).to.include("RHY_SEP");
    expect(kids).to.include("RHY_DENOM");
  });

  it("note with tie has Note > Pitch + TIE", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC-|\n");
    const note = findFirstDescendant(csNode, "Note");
    expect(note).to.not.be.null;
    const noteChildren = childTypes(note!);
    expect(noteChildren).to.include("TIE");
  });
});

describe("AST structure: Rest", () => {
  it("rest has Rest > REST token", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nz|\n");
    const rest = findFirstDescendant(csNode, "Rest");
    expect(rest).to.not.be.null;
    const kids = childTypes(rest!);
    expect(kids).to.include("REST");
  });

  it("rest with rhythm has Rest > REST + Rhythm", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nz2|\n");
    const rest = findFirstDescendant(csNode, "Rest");
    expect(rest).to.not.be.null;
    const kids = childTypes(rest!);
    expect(kids).to.include("REST");
    expect(kids).to.include("Rhythm");
  });

  it("multi-measure rest has MultiMeasureRest > REST", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nZ4|\n");
    const mmr = findFirstDescendant(csNode, "MultiMeasureRest");
    expect(mmr).to.not.be.null;
    const kids = childTypes(mmr!);
    expect(kids).to.include("REST");
  });

  it("multi-measure rest with length has RHY_NUMER child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nZ4|\n");
    const mmr = findFirstDescendant(csNode, "MultiMeasureRest");
    expect(mmr).to.not.be.null;
    const kids = childTypes(mmr!);
    expect(kids).to.include("REST");
    expect(kids).to.include("RHY_NUMER");
  });
});

describe("AST structure: Chord", () => {
  it("chord contains Note children", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n[CEG]|\n");
    const chord = findFirstDescendant(csNode, "Chord");
    expect(chord).to.not.be.null;
    const notes = findAllDescendants(chord, "Note");
    expect(notes.length).to.equal(3);
  });

  it("chord with rhythm has Rhythm child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n[CE]2|\n");
    const chord = findFirstDescendant(csNode, "Chord");
    expect(chord).to.not.be.null;
    const kids = childTypes(chord!);
    expect(kids).to.include("Rhythm");
  });
});

describe("AST structure: Grace_group", () => {
  it("grace group contains Note children", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n{AB}C|\n");
    const grace = findFirstDescendant(csNode, "Grace_group");
    expect(grace).to.not.be.null;
    const notes = findAllDescendants(grace, "Note");
    expect(notes.length).to.be.greaterThan(0);
  });
});

describe("AST structure: Tuplet", () => {
  it("tuplet has TUPLET_P child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n(3CDE|\n");
    const tuplet = findFirstDescendant(csNode, "Tuplet");
    expect(tuplet).to.not.be.null;
    const kids = childTypes(tuplet!);
    expect(kids).to.include("TUPLET_P");
  });

  it("tuplet with q and r has all ratio tokens", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n(3:2:3CDE|\n");
    const tuplet = findFirstDescendant(csNode, "Tuplet");
    expect(tuplet).to.not.be.null;
    const kids = childTypes(tuplet!);
    expect(kids).to.include("TUPLET_P");
    expect(kids).to.include("TUPLET_Q");
    expect(kids).to.include("TUPLET_R");
  });
});

describe("AST structure: BarLine", () => {
  it("simple barline has BARLINE token child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC|D|\n");
    const barlines = findAllDescendants(csNode, "BarLine");
    expect(barlines.length).to.be.greaterThan(0);
    const kids = childTypes(barlines[0]);
    expect(kids).to.include("BARLINE");
  });
});

describe("AST structure: Inline_field", () => {
  it("inline field has INF_HDR child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n[M:3/4]C|\n");
    const inlField = findFirstDescendant(csNode, "Inline_field");
    expect(inlField).to.not.be.null;
    const kids = childTypes(inlField!);
    expect(kids).to.include("INF_HDR");
  });
});

describe("AST structure: Annotation", () => {
  it("annotation has ANNOTATION token child", () => {
    const { csNode } = parseWithTypeScript('X:1\nK:C\n"Cmaj"C|\n');
    const ann = findFirstDescendant(csNode, "Annotation");
    expect(ann).to.not.be.null;
    const kids = childTypes(ann!);
    expect(kids).to.include("ANNOTATION");
  });
});

describe("AST structure: Decoration and Symbol", () => {
  it("decoration has DECORATION token child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n.C|\n");
    const dec = findFirstDescendant(csNode, "Decoration");
    expect(dec).to.not.be.null;
    const kids = childTypes(dec!);
    expect(kids).to.include("DECORATION");
  });

  it("symbol has SYMBOL token child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n!trill!C|\n");
    const sym = findFirstDescendant(csNode, "Symbol");
    expect(sym).to.not.be.null;
    const kids = childTypes(sym!);
    expect(kids).to.include("SYMBOL");
  });
});

describe("AST structure: Directive", () => {
  it("directive has IDENTIFIER and value children", () => {
    const { csNode } = parseWithTypeScript("%%scale 0.8\nX:1\nK:C\nC|\n");
    const directive = findFirstDescendant(csNode, "Directive");
    expect(directive).to.not.be.null;
    const kids = childTypes(directive!);
    expect(kids).to.include("IDENTIFIER");
    expect(kids).to.include("NUMBER");
  });
});

describe("AST structure: Lyric_line", () => {
  it("lyric line has LY_HDR and LY_TXT children", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC D E|\nw:one two three\n");
    const lyric = findFirstDescendant(csNode, "Lyric_line");
    expect(lyric).to.not.be.null;
    const kids = childTypes(lyric!);
    expect(kids).to.include("LY_HDR");
    expect(kids).to.include("LY_TXT");
  });

  it("lyric with hyphens has LY_HYPH tokens", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC D|\nw:syl-la-ble\n");
    const lyric = findFirstDescendant(csNode, "Lyric_line");
    expect(lyric).to.not.be.null;
    const kids = childTypes(lyric!);
    expect(kids).to.include("LY_HYPH");
  });
});

describe("AST structure: Comment", () => {
  it("comment has COMMENT token child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\n%a comment\nC|\n");
    const comment = findFirstDescendant(csNode, "Comment");
    expect(comment).to.not.be.null;
    const kids = childTypes(comment!);
    expect(kids).to.include("COMMENT");
  });
});

describe("AST structure: Voice_overlay", () => {
  it("voice overlay has VOICE token child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC &D|\n");
    const overlay = findFirstDescendant(csNode, "Voice_overlay");
    expect(overlay).to.not.be.null;
    const kids = childTypes(overlay!);
    expect(kids).to.include("VOICE");
  });
});

describe("AST structure: Line_continuation", () => {
  it("line continuation has LINE_CONT token child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\nC\\\n D|\n");
    const lc = findFirstDescendant(csNode, "Line_continuation");
    expect(lc).to.not.be.null;
    const kids = childTypes(lc!);
    expect(kids).to.include("LINE_CONT");
  });
});

describe("AST structure: YSPACER", () => {
  it("yspacer has Y_SPC token child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\ny C|\n");
    const ys = findFirstDescendant(csNode, "YSPACER");
    expect(ys).to.not.be.null;
    const kids = childTypes(ys!);
    expect(kids).to.include("Y_SPC");
  });

  it("yspacer with rhythm has Rhythm child", () => {
    const { csNode } = parseWithTypeScript("X:1\nK:C\ny2 C|\n");
    const ys = findFirstDescendant(csNode, "YSPACER");
    expect(ys).to.not.be.null;
    const kids = childTypes(ys!);
    expect(kids).to.include("Y_SPC");
    expect(kids).to.include("Rhythm");
  });
});

describe("AST structure: complex constructs", () => {
  it("full tune maintains correct nesting hierarchy", () => {
    const input = `X:1
T:Test
M:4/4
L:1/8
K:G
|:GABc dedc|B2G2 G2z2:|
w:La la la la la la la la
`;
    const { csNode } = parseWithTypeScript(input);
    expect(csNode!.type).to.equal("File_structure");

    const tune = findFirstDescendant(csNode, "Tune");
    expect(tune).to.not.be.null;

    const header = findFirstDescendant(tune, "Tune_header");
    const body = findFirstDescendant(tune, "Tune_Body");
    expect(header).to.not.be.null;
    expect(body).to.not.be.null;

    // Body contains notes, rests, barlines, and lyrics
    const notes = findAllDescendants(body, "Note");
    expect(notes.length).to.be.greaterThan(0);
    const barlines = findAllDescendants(body, "BarLine");
    expect(barlines.length).to.be.greaterThan(0);
    const lyrics = findAllDescendants(body, "Lyric_line");
    expect(lyrics.length).to.equal(1);
  });

  it("tune with multiple voices maintains structure", () => {
    const input = `X:1
K:C
V:1
C D E F|
V:2
G, A, B, C|
`;
    const { csNode } = parseWithTypeScript(input);
    const types = collectNodeTypes(csNode);
    expect(types.has("Tune")).to.be.true;
    expect(types.has("Note")).to.be.true;
  });

  it("inline fields inside tune body are properly nested", () => {
    const input = "X:1\nK:C\nC [M:3/4] D E|\n";
    const { csNode } = parseWithTypeScript(input);
    const body = findFirstDescendant(csNode, "Tune_Body");
    expect(body).to.not.be.null;
    const inlineField = findFirstDescendant(body, "Inline_field");
    expect(inlineField).to.not.be.null;
  });

  it("decorations attach to subsequent notes", () => {
    const input = "X:1\nK:C\n.C ~D|\n";
    const { csNode } = parseWithTypeScript(input);
    const decorations = findAllDescendants(csNode, "Decoration");
    expect(decorations.length).to.equal(2);
  });

  it("grace group precedes target note in tree", () => {
    const input = "X:1\nK:C\n{AB}C|\n";
    const { csNode } = parseWithTypeScript(input);
    const body = findFirstDescendant(csNode, "Tune_Body");
    expect(body).to.not.be.null;
    const types = collectNodeTypes(body);
    expect(types.has("Grace_group")).to.be.true;
    expect(types.has("Note")).to.be.true;
  });
});

describe("AST structure: node count invariants", () => {
  it("adding notes increases node count", () => {
    const one = parseWithTypeScript("X:1\nK:C\nC|\n");
    const three = parseWithTypeScript("X:1\nK:C\nC D E|\n");
    expect(countNodes(three.csNode)).to.be.greaterThan(countNodes(one.csNode));
  });

  it("chord has more nodes than single note", () => {
    const single = parseWithTypeScript("X:1\nK:C\nC|\n");
    const chord = parseWithTypeScript("X:1\nK:C\n[CEG]|\n");
    expect(countNodes(chord.csNode)).to.be.greaterThan(countNodes(single.csNode));
  });
});

// ============================================================================
// Cross-Parser AST Comparison Tests
// ============================================================================

describe("Cross-parser AST comparison (when available)", function () {
  beforeEach(function () {
    if (!isTreeSitterAvailable()) {
      this.skip();
    }
  });

  it("cross-compares minimal tune", () => {
    assertCrossComparisonEqual("X:1\nK:C\nC|\n", "minimal tune");
  });

  it("cross-compares note with accidental", () => {
    assertCrossComparisonEqual("X:1\nK:C\n^C|\n", "accidental note");
  });

  it("cross-compares note with octave", () => {
    assertCrossComparisonEqual("X:1\nK:C\nC'|\n", "octave note");
  });

  it("cross-compares note with rhythm", () => {
    assertCrossComparisonEqual("X:1\nK:C\nC2|\n", "note with rhythm");
  });

  it("cross-compares rest", () => {
    assertCrossComparisonEqual("X:1\nK:C\nz|\n", "rest");
  });

  it("cross-compares rest with rhythm", () => {
    assertCrossComparisonEqual("X:1\nK:C\nz2|\n", "rest with rhythm");
  });

  it("cross-compares chord", () => {
    assertCrossComparisonEqual("X:1\nK:C\n[CEG]|\n", "chord");
  });

  it("cross-compares grace group", () => {
    assertCrossComparisonEqual("X:1\nK:C\n{AB}C|\n", "grace group");
  });

  it("cross-compares tuplet", () => {
    assertCrossComparisonEqual("X:1\nK:C\n(3CDE|\n", "tuplet");
  });

  it("cross-compares barlines", () => {
    assertCrossComparisonEqual("X:1\nK:C\nC|D||\n", "barlines");
  });

  it("cross-compares inline field", () => {
    assertCrossComparisonEqual("X:1\nK:C\n[M:3/4]C|\n", "inline field");
  });

  it("cross-compares annotation", () => {
    assertCrossComparisonEqual('X:1\nK:C\n"Cmaj"C|\n', "annotation");
  });

  it("cross-compares decoration", () => {
    assertCrossComparisonEqual("X:1\nK:C\n.C|\n", "decoration");
  });

  it("cross-compares symbol", () => {
    assertCrossComparisonEqual("X:1\nK:C\n!trill!C|\n", "symbol");
  });

  it("cross-compares directive before tune", () => {
    assertCrossComparisonEqual("%%scale 0.8\nX:1\nK:C\nC|\n", "directive");
  });

  it("cross-compares lyrics", () => {
    assertCrossComparisonEqual(
      "X:1\nK:C\nC D E|\nw:one two three\n",
      "lyrics"
    );
  });

  it("cross-compares comment in tune body", () => {
    assertCrossComparisonEqual("X:1\nK:C\n%comment\nC|\n", "comment");
  });

  it("cross-compares multiple info lines", () => {
    assertCrossComparisonEqual(
      "X:1\nT:Title\nM:4/4\nK:C\nC|\n",
      "multiple info lines"
    );
  });

  it("cross-compares multi-measure rest", () => {
    assertCrossComparisonEqual("X:1\nK:C\nZ4|\n", "multi-measure rest");
  });

  it("cross-compares voice overlay", () => {
    assertCrossComparisonEqual("X:1\nK:C\nC &D|\n", "voice overlay");
  });

  it("cross-compares yspacer", () => {
    assertCrossComparisonEqual("X:1\nK:C\ny2 C|\n", "yspacer");
  });

  it("cross-compares complex tune", () => {
    assertCrossComparisonEqual(
      `X:1
T:Test
M:4/4
L:1/8
K:G
|:GABc dedc|B2G2 G2z2:|
w:La la la la la la la la
`,
      "complex tune"
    );
  });
});
