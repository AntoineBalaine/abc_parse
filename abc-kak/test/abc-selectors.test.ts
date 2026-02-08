import { expect } from 'chai';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { KakouneSession } from './helpers/kakoune-session';

describe('abc-kak selectors', function () {
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
    testFile = join(kak.testHome, 'test.abc');
  });

  afterEach(() => {
    kak.cleanup();
  });

  describe('environment setup', () => {
    it('loads kakrc at startup', () => {
      kak.start();
      kak.verifyKakrcLoaded();
    });

    it('sets filetype when opening .abc file', () => {
      writeFileSync(testFile, 'X:1\nT:Test\nK:C\nCDEF\n');
      kak.start(`edit ${testFile}`);
      kak.verifyKakrcLoaded();
      kak.verifyFiletype('abc');
    });

    it('configures lsp_servers for abc-lsp', () => {
      writeFileSync(testFile, 'X:1\nT:Test\nK:C\nCDEF\n');
      kak.start(`edit ${testFile}`);
      kak.verifyLspServersConfigured();
    });

    it('sets filetype when opening .abcx file', () => {
      const abcxFile = join(kak.testHome, 'test.abcx');
      writeFileSync(abcxFile, 'X:1\nT:Test\nK:C\nCDEF\n');
      kak.start(`edit ${abcxFile}`);
      kak.verifyFiletype('abcx');
    });
  });

  describe('basic navigation', () => {
    it('selects a single note', () => {
      writeFileSync(testFile, 'X:1\nT:Test\nK:C\nCDEFGABc\n');
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      const selection = kak.executeAndQuery('gg3j', '$kak_selection');
      expect(selection).to.equal('C');
    });

    it('can navigate to a specific position', () => {
      writeFileSync(testFile, 'X:1\nT:Test\nK:C\n[V:1] CDEFGABc\n');
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      const selection = kak.executeAndQuery('gg3j6l', '$kak_selection');
      expect(selection).to.equal('C');
    });
  });

  describe('selectors', () => {
    it('abc-select-notes returns valid selection descriptors', () => {
      writeFileSync(testFile, 'X:1\nT:Test\nK:C\nCDEF\n');
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      kak.executeKeys('%');  // Select all
      const result = kak.commandAndQuery('abc-select-notes', '$kak_selections_desc');

      expect(result).to.not.equal('1.1,1.1');
      expect(result).to.match(/^\d+\.\d+,\d+\.\d+/);
    });

    it('abc-select-voices returns valid selection descriptors', () => {
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

      kak.executeKeys('%');  // Select all
      const selectionsDesc = kak.commandAndQuery('abc-select-voices 1', '$kak_selections_desc');

      // Verify we got valid selection descriptors (not the default 1.1,1.1)
      expect(selectionsDesc).to.not.equal('1.1,1.1');
      // Verify format matches kakoune selection descriptor pattern
      expect(selectionsDesc).to.match(/^\d+\.\d+,\d+\.\d+/);
    });
  });

  describe('transforms', () => {
    it('abc-transpose modifies buffer content', () => {
      writeFileSync(testFile, 'X:1\nT:Test\nK:C\nCDEF\n');
      kak.start(`edit ${testFile}`);
      kak.verifyHookFlow();

      // Move to first note and verify
      kak.executeKeys('gg3j');
      const before = kak.getSelection();
      expect(before).to.equal('C');

      // Run transpose command (needs client context for selection)
      kak.sendKeys(': abc-transpose 12');

      // Small delay for transform to complete
      kak.sendKeys('');

      // Navigate back to same position and check
      kak.executeKeys('gg3j');
      const after = kak.getSelection();
      // C + 12 semitones = c (one octave up)
      expect(after).to.equal('c');
    });
  });

  describe('cleanup behavior', () => {
    it('cleanup is idempotent', () => {
      writeFileSync(testFile, 'X:1\nK:C\nCDEF\n');
      kak.start(`edit ${testFile}`);

      kak.cleanup();
      // Second call should not throw
      expect(() => kak.cleanup()).to.not.throw();
    });

    it('testHome is removed after cleanup', () => {
      const homeDir = kak.testHome;
      expect(existsSync(homeDir)).to.be.true;

      kak.start();
      kak.cleanup();

      expect(existsSync(homeDir)).to.be.false;
    });
  });
});
