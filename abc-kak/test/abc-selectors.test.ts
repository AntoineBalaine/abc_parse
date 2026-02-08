import { expect } from 'chai';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { KakouneSession } from './helpers/kakoune-session';

describe('abc-kak selectors', () => {
  let kak: KakouneSession;
  let testFile: string;

  beforeEach(() => {
    kak = new KakouneSession();
    testFile = `/tmp/test-${kak.session}.abc`;
    kak.start();
  });

  afterEach(() => {
    kak.cleanup();
    try {
      unlinkSync(testFile);
    } catch {
      // File may not exist
    }
  });

  describe('basic navigation (no LSP)', () => {
    it('selects a single note', () => {
      writeFileSync(testFile, `X:1\nT:Test\nK:C\nCDEFGABc\n`);
      kak.edit(testFile);
      const selection = kak.executeAndQuery('gg3j', '$kak_selection');
      expect(selection).to.equal('C');
    });

    it('can navigate to a specific position', () => {
      writeFileSync(testFile, `X:1\nT:Test\nK:C\n[V:1] CDEFGABc\n`);
      kak.edit(testFile);
      const selection = kak.executeAndQuery('gg3j6l', '$kak_selection');
      expect(selection).to.equal('C');
    });
  });

  describe('LSP integration', function () {
    this.timeout(15000);

    let lspAvailable = false;

    beforeEach(async function () {
      kak.loadKakLsp();
      kak.loadAbcPlugin();

      // Write a test file to trigger LSP initialization
      writeFileSync(testFile, `X:1\nT:Test\nK:C\nCDEF\n`);

      // Try to wait for the socket with a short timeout
      try {
        await kak.editAndWaitForLsp(testFile, 3000);
        lspAvailable = true;
      } catch {
        // LSP socket didn't become ready - kak-lsp may not be properly configured
        kak.edit(testFile);
        lspAvailable = false;
      }
    });

    it('abc plugin loads and sets filetype', () => {
      const filetype = kak.query('%opt{filetype}', testFile);
      expect(filetype.trim()).to.equal('abc');
    });

    it('selector returns valid selection descriptors', async function () {
      if (!lspAvailable) {
        this.skip();
        return;
      }

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
      kak.edit(testFile);

      // Select all content first
      kak.executeKeys('%');

      const selectionsDesc = kak.commandAndQuery('abc-select-voices 1', '$kak_selections_desc');

      // Verify we got valid selection descriptors (not the default 1.1,1.1)
      expect(selectionsDesc).to.not.equal('1.1,1.1');
      // Verify format matches kakoune selection descriptor pattern
      expect(selectionsDesc).to.match(/^\d+\.\d+,\d+\.\d+/);
    });

    it('transform modifies buffer content', async function () {
      if (!lspAvailable) {
        this.skip();
        return;
      }

      const input = `X:1
T:Test
K:C
CDEF
`;
      writeFileSync(testFile, input);
      kak.edit(testFile);

      // In kakoune, moving to a position already selects the character under cursor
      const initialSelection = kak.executeAndQuery('gg3j', '$kak_selection');
      expect(initialSelection).to.equal('C');

      // Run the transform command with the selection already set
      kak.send(`evaluate-commands -buffer ${testFile} %{
        execute-keys 'gg3j'
        abc-transpose 12
      }`);

      // Give time for transform to complete
      kak.send('nop');

      // Query the buffer content at the same position
      const newSelection = kak.executeAndQuery('gg3j', '$kak_selection');
      // C transposed by 12 semitones should become c (one octave up)
      expect(newSelection).to.equal('c');
    });
  });
});
