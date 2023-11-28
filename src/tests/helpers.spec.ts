import chai from "chai";
import { convertVoiceInfoLinesToInlineInfos, splitSystemLines } from '../Visitors/Formatter_helpers';
import { System } from "../types";
import { buildParse } from "./RhythmTransform.spec";
const expect = chai.expect;

export type SystemLineTest = {
  title: string;
  test: (...args: any[]) => void;
  input: string;
  expected?: string;
};

const SystemLineTests: SystemLineTest[] = [
  {
    title: "should split a single system",
    test: (systems: Array<System>) => {
      const splitLines = splitSystemLines(systems[0]);
      expect(splitLines).to.not.be.undefined;
      expect(splitLines).to.be.lengthOf(1);
    },
    input: `ab\ncd`,
  },
  {
    title: "should split a multi-voice system with multiple lines",
    test: (systems: Array<System>) => {
      const splitLines = splitSystemLines(systems[0]);
      expect(splitLines).to.not.be.undefined;
      expect(splitLines).to.be.lengthOf(2);
    },
    input: `V:1\nV:2\n[V:1]ab\n[V:2]cd\n`,
  },
  {
    title: "should split a multi-voice system that contains comments",
    test: (systems: Array<System>) => {
      const splitLines = splitSystemLines(systems[0]);
      expect(splitLines).to.not.be.undefined;
      expect(splitLines).to.be.lengthOf(3);
    },
    input: `V:1\nV:2\n[V:1]ab\n%surprise!\n[V:2]cd\n`,
  }
];

const voiceInfoLineConversionTests: SystemLineTest[] = [
  {
    title: "should convert a voice info line to inline info",
    test: (systems: Array<System>) => {
      const firstSystem = convertVoiceInfoLinesToInlineInfos(systems[0]);
      const splitLines = splitSystemLines(firstSystem);
      expect(splitLines).to.not.be.undefined;
      expect(splitLines).to.be.lengthOf(2);
    },
    input: `V:1\nV:2\n[V:1]ab\nV:2\ncd\n`,
  },
];

describe("Voice-System helpers", () => {
  describe("split system lines", () => {
    SystemLineTests.forEach(({ title, test, input, expected }) => {
      it(title, RunVoiceSystemsTest(input, test));
    });
  });
  describe("convert voice info line to inline info", () => {

    voiceInfoLineConversionTests.forEach(({ title, test, input, expected }) => {
      it(title, RunVoiceSystemsTest(input, test));
    });
  });


});

export function RunVoiceSystemsTest(input: string, test: (...args: any[]) => void, expected: string = ""): Mocha.Func | undefined {
  return () => {
    const parse = buildParse(input);
    const systems = parse.tune[0].tune_body?.sequence;
    expect(systems).to.not.be.undefined;
    if (!systems) { return; }
    test(systems, expected);
  };
}

