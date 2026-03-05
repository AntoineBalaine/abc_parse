import { execSync } from "child_process";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { expect } from "chai";
import { KakouneSession } from "./helpers/kakoune-session";

describe("abc-export-midi", function () {
  this.timeout(30000);

  before(function () {
    try {
      KakouneSession.checkPrerequisites();
    } catch (e) {
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

  it("exports a valid MIDI file to disk", () => {
    writeFileSync(testFile, "X:1\nT:Test\nK:C\nCDEF|\n");
    kak.start(`edit ${testFile}`);
    kak.verifyHookFlow();

    const outputPath = join(kak.testHome, "output.mid");

    // Run the export command with an explicit output path
    kak.sendKeys(`: abc-export-midi ${outputPath}`);

    // Wait for the LSP round-trip and file write to complete
    execSync("sleep 1", { cwd: kak.testHome, env: kak.testEnv });

    // Verify the MIDI file was created
    expect(existsSync(outputPath)).to.be.true;

    // Verify the file starts with the MIDI magic bytes "MThd"
    const bytes = readFileSync(outputPath);
    expect(bytes[0]).to.equal(0x4d); // M
    expect(bytes[1]).to.equal(0x54); // T
    expect(bytes[2]).to.equal(0x68); // h
    expect(bytes[3]).to.equal(0x64); // d
  });

  it("shows an error for .abcx files", () => {
    const abcxFile = join(kak.testHome, "test.abcx");
    writeFileSync(abcxFile, "X:1\nT:Test\nK:C\nC Am | F G |\n");
    kak.start(`edit ${abcxFile}`);
    kak.verifyHookFlow();

    const outputPath = join(kak.testHome, "output.mid");

    kak.sendKeys(`: abc-export-midi ${outputPath}`);
    execSync("sleep 1", { cwd: kak.testHome, env: kak.testEnv });

    // The MIDI file should NOT have been created because .abcx is rejected
    expect(existsSync(outputPath)).to.be.false;
  });
});
