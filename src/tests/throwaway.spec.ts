import { assert } from "chai";

describe("throwaway", () => {
  // Define the components
  const tuneHeaderStart = /X:\d+/;

  // The simplified pattern with the 's' flag for . to match newlines
  const pTuneStart = new RegExp(`^(?:(?!\n[ \t]*\n).)*${tuneHeaderStart.source}`, "s");

  it("should match tune header with or without preceding text", () => {
    const validCases = ["X:1", "some text\nX:1", "line1\nline2\nX:1", "%comment\nT:title\nX:1"];

    validCases.forEach((test) => {
      // Add debug logging
      console.log("Testing:", JSON.stringify(test));
      console.log("Pattern:", pTuneStart.source);
      console.log("Match result:", pTuneStart.test(test));
      assert.match(test, pTuneStart, `Failed to match: ${JSON.stringify(test)}`);
    });
  });

  // ...existing code...
});
