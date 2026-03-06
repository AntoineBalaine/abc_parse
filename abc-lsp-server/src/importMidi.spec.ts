import { expect } from "chai";
import { Scanner, parse, ABCContext, abc2midi, File_structure } from "abc-parser";
import { midi2abc } from "abc-midi";
import { validateImportMidiParams } from "./socketHandler";

// =============================================================================
// Helpers
// =============================================================================

function abcToMidiBase64(abc: string): string {
  const ctx = new ABCContext();
  const tokens = Scanner(abc, ctx);
  const ast: File_structure = parse(tokens, ctx);
  const midiBytes = abc2midi(ast, ctx);
  return Buffer.from(midiBytes).toString("base64");
}

// =============================================================================
// AbcLspServer.importMidi (tested via the core midi2abc function with base64)
// =============================================================================

describe("importMidi", () => {
  it("converts valid base64-encoded MIDI to ABC with X: and K:", () => {
    const abc = "X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nCDEF|GABc|\n";
    const midiBase64 = abcToMidiBase64(abc);
    const bytes = Buffer.from(midiBase64, "base64");
    const result = midi2abc(new Uint8Array(bytes));
    expect(result).to.include("X:");
    expect(result).to.include("K:");
  });

  it("throws on base64 that decodes to invalid MIDI bytes", () => {
    const invalidMidi = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString("base64");
    const bytes = Buffer.from(invalidMidi, "base64");
    expect(() => midi2abc(new Uint8Array(bytes))).to.throw();
  });
});

// =============================================================================
// validateImportMidiParams
// =============================================================================

describe("validateImportMidiParams", () => {
  it("accepts valid params with midi only", () => {
    const result = validateImportMidiParams({ midi: "AAAA" } as any);
    expect(result.midi).to.equal("AAAA");
    expect(result.title).to.be.undefined;
    expect(result.composer).to.be.undefined;
  });

  it("accepts valid params with midi, title, and composer", () => {
    const result = validateImportMidiParams({
      midi: "AAAA",
      title: "My Title",
      composer: "My Composer",
    } as any);
    expect(result.midi).to.equal("AAAA");
    expect(result.title).to.equal("My Title");
    expect(result.composer).to.equal("My Composer");
  });

  it("throws on missing params", () => {
    try {
      validateImportMidiParams(undefined);
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).to.exist;
      expect(err.message).to.include("Missing params");
    }
  });

  it("throws on missing midi parameter", () => {
    try {
      validateImportMidiParams({} as any);
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).to.exist;
      expect(err.message).to.include("midi");
    }
  });

  it("throws on empty midi parameter", () => {
    try {
      validateImportMidiParams({ midi: "" } as any);
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("midi");
    }
  });

  it("throws on non-string title", () => {
    try {
      validateImportMidiParams({ midi: "AAAA", title: 42 } as any);
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("title");
    }
  });

  it("throws on non-string composer", () => {
    try {
      validateImportMidiParams({ midi: "AAAA", composer: 42 } as any);
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("composer");
    }
  });
});
