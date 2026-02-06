import { expect } from 'chai';
import { writeFileSync, unlinkSync } from 'fs';
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

  it('selects a single note', () => {
    writeFileSync(
      testFile,
      `X:1
T:Test
K:C
CDEFGABc
`
    );

    kak.edit(testFile);
    const selection = kak.executeAndQuery('gg3j', '$kak_selection');
    expect(selection).to.equal('C');
  });

  it('can navigate to a specific position', () => {
    writeFileSync(
      testFile,
      `X:1
T:Test
K:C
[V:1] CDEFGABc
`
    );

    kak.edit(testFile);
    const selection = kak.executeAndQuery('gg3j6l', '$kak_selection');
    expect(selection).to.equal('C');
  });
});
