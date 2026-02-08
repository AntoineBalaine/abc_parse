import { expect } from "chai";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import { KakouneSession } from "./helpers/kakoune-session";

describe("abc-kak selectors", function () {
  // These tests require tmux, kakoune, and kak-lsp
  this.timeout(30000);

  before(function () {
    try {
      KakouneSession.checkPrerequisites();
    } catch (e) {
      // Skip all tests if prerequisites are not met (e.g., in CI without tmux/kak)
      console.log(`Skipping abc-kak tests: ${(e as Error).message}`);
      this.skip();
    }
  });

  let kak: KakouneSession;
  let testFile: string;

  beforeEach(() => {
    kak = new KakouneSession();
    testFile = join(kak.testHome, "test.abc");
  });

  afterEach(() => {
    kak.cleanup();
  });

  describe("environment setup", () => {
    it("loads kakrc at startup", () => {
      kak.start();
      kak.verifyKakrcLoaded();
    });

    it("sets filetype when opening .abc file", () => {
      writeFileSync(testFile, "X:1\nT:Test\nK:C\nCDEF\n");
      kak.start(`edit ${testFile}`);
      kak.verifyKakrcLoaded();
      kak.verifyFiletype("abc");
    });

    it("configures lsp_servers for abc-lsp", () => {
      writeFileSync(testFile, "X:1\nT:Test\nK:C\nCDEF\n");
      kak.start(`edit ${testFile}`);
      kak.verifyLspServersConfigured();
    });

    it("sets filetype when opening .abcx file", () => {
      const abcxFile = join(kak.testHome, "test.abcx");
      writeFileSync(abcxFile, "X:1\nT:Test\nK:C\nCDEF\n");
      kak.start(`edit ${abcxFile}`);
      kak.verifyFiletype("abcx");
    });
  });

  describe("basic navigation", () => {
    it("selects a single note", () => {
      writeFileSync(testFile, "X:1\nT:Test\nK:C\nCDEFGABc\n");
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      const selection = kak.executeAndQuery("gg3j", "$kak_selection");
      expect(selection).to.equal("C");
    });

    it("can navigate to a specific position", () => {
      writeFileSync(testFile, "X:1\nT:Test\nK:C\n[V:1] CDEFGABc\n");
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      const selection = kak.executeAndQuery("gg3j6l", "$kak_selection");
      expect(selection).to.equal("C");
    });
  });

  describe("selectors", () => {
    it("abc-select-notes returns valid selection descriptors", () => {
      writeFileSync(testFile, "X:1\nT:Test\nK:C\nCDEF\n");
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      kak.executeKeys("%"); // Select all
      const result = kak.commandAndQuery("abc-select-notes", "$kak_selections_desc");

      expect(result).to.not.equal("1.1,1.1");
      expect(result).to.match(/^\d+\.\d+,\d+\.\d+/);
    });

    it("abc-select-voices returns valid selection descriptors", () => {
      const input = `X:1
T:Test
M:4/4
L:1/4
V:1 name=A clef=treble
V:2 name=B clef=bass
K:C
[V:1] CDEF | GABc
[V:2] FGAB | cdef
`;
      writeFileSync(testFile, input);
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      kak.executeKeys("%"); // Select all
      const selectionsDesc = kak.commandAndQuery("abc-select-voices 1", "$kak_selections_desc");

      // Verify we got valid selection descriptors (not the default 1.1,1.1)
      expect(selectionsDesc).to.not.equal("1.1,1.1");
      // Verify format matches kakoune selection descriptor pattern
      expect(selectionsDesc).to.match(/^\d+\.\d+,\d+\.\d+/);
    });

    it("abc-select-measures returns valid selection descriptors for multi-line content", () => {
      // Content with measures that don't end with barlines at line end.
      // The second line's measures should NOT merge with the first line.
      const input = `X:1
K:C
C D | E F
G A | B c |
`;
      writeFileSync(testFile, input);
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      kak.executeKeys("%"); // Select all
      const result = kak.commandAndQuery("abc-select-measures", "$kak_selections_desc");

      // Should have 4 selections (4 measures)
      const selections = result.trim().split(" ");
      expect(selections.length).to.equal(4);
      // Each selection should be on a single line (no cross-line ranges)
      for (const sel of selections) {
        const [start, end] = sel.split(",");
        const startLine = parseInt(start.split(".")[0]);
        const endLine = parseInt(end.split(".")[0]);
        expect(startLine).to.equal(endLine);
      }
    });

    it("abc-select-voices selects entire voice content, not just the marker", () => {
      // This test verifies the fix for bug 3: voices selector should select
      // the entire voice content, not just the voice marker
      const input = `X:1
K:C
[V:1]CDEF|[V:2]GABC|
`;
      writeFileSync(testFile, input);
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      kak.executeKeys("%"); // Select all
      kak.commandAndQuery("abc-select-voices 1", "$kak_selections_desc");

      // Get the actual selected text
      const selection = kak.query("%val{selection}");

      // The selection should include the voice content, not just [V:1]
      // Expected: [V:1]CDEF| (the entire voice 1 section)
      expect(selection).to.include("CDEF");
      expect(selection).to.include("[V:1]");
      // Should NOT include voice 2 content
      expect(selection).to.not.include("GABC");
    });
  });

  describe("transforms", () => {
    it("abc-transpose modifies buffer content", () => {
      writeFileSync(testFile, "X:1\nT:Test\nK:C\nCDEF\n");
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      // Move to first note and verify
      kak.executeKeys("gg3j");
      const before = kak.getSelection();
      expect(before).to.equal("C");

      // Run transpose command (needs client context for selection)
      kak.sendKeys(": abc-transpose 12");

      // Small delay for transform to complete
      kak.sendKeys("");

      // Navigate back to same position and check
      kak.executeKeys("gg3j");
      const after = kak.getSelection();
      // C + 12 semitones = c (one octave up)
      expect(after).to.equal("c");
    });

    it("abc-legato extends note through following rests", () => {
      writeFileSync(testFile, "X:1\nT:Test\nK:C\nC z z z|\n");
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      // Select entire document - legato will find notes and rests within
      kak.executeKeys("%");

      // Run legato command
      kak.sendKeys(": abc-legato");

      // Delay for transform to complete
      kak.sendKeys("");
      kak.sendKeys("");

      // Select all content to verify the transformation
      kak.executeKeys("%");
      const after = kak.getSelection();
      // C z z z should become C4 (note extended through all rests, whitespace preserved)
      expect(after).to.equal("X:1\nT:Test\nK:C\nC4   |\n");
    });
  });

  describe("cleanup behavior", () => {
    it("cleanup is idempotent", () => {
      writeFileSync(testFile, "X:1\nK:C\nCDEF\n");
      kak.start(`edit ${testFile}`);

      kak.cleanup();
      // Second call should not throw
      expect(() => kak.cleanup()).to.not.throw();
    });

    it("testHome is removed after cleanup", () => {
      const homeDir = kak.testHome;
      expect(existsSync(homeDir)).to.be.true;

      kak.start();
      kak.cleanup();

      expect(existsSync(homeDir)).to.be.false;
    });
  });
});
