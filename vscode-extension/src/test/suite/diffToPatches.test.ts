import * as assert from "assert";
import { diffChars, generatePatches, Change, Position } from "../../abct/diffToPatches";

suite("diffToPatches Tests", () => {
  suite("diffChars", () => {
    test("should return empty array for identical strings", () => {
      const result = diffChars("hello world", "hello world");
      assert.deepStrictEqual(result, []);
    });

    test("should return empty array for empty identical strings", () => {
      const result = diffChars("", "");
      assert.deepStrictEqual(result, []);
    });

    test("should handle single character insert", () => {
      const result = diffChars("hllo", "hello");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].type, "insert");
      assert.strictEqual(result[0].newContent, "e");
    });

    test("should handle single character delete", () => {
      const result = diffChars("hello", "hllo");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].type, "delete");
      assert.strictEqual(result[0].newContent, "");
    });

    test("should handle word replacement", () => {
      const result = diffChars("hello world", "hello there");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].type, "replace");
      assert.strictEqual(result[0].newContent, "there");
    });

    test("should handle empty original string (all insert)", () => {
      const result = diffChars("", "hello");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].type, "insert");
      assert.strictEqual(result[0].newContent, "hello");
      assert.deepStrictEqual(result[0].originalStart, { line: 1, column: 1 });
    });

    test("should handle empty modified string (all delete)", () => {
      const result = diffChars("hello", "");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].type, "delete");
      assert.strictEqual(result[0].newContent, "");
      assert.deepStrictEqual(result[0].originalStart, { line: 1, column: 1 });
    });

    test("should handle change at very beginning of file", () => {
      const result = diffChars("abc", "xbc");
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].originalStart, { line: 1, column: 1 });
    });

    test("should handle change at very end of file", () => {
      const result = diffChars("abc", "abx");
      assert.strictEqual(result.length, 1);
      // Last character 'c' is at column 3
      assert.deepStrictEqual(result[0].originalStart, { line: 1, column: 3 });
    });

    test("should handle multi-line changes correctly", () => {
      const original = "line1\nline2\nline3";
      const modified = "line1\nmodified\nline3";
      const result = diffChars(original, modified);
      assert.strictEqual(result.length, 1);
      // "line2" starts at line 2, column 1
      assert.strictEqual(result[0].originalStart.line, 2);
    });

    test("should track line numbers across newlines", () => {
      const original = "first\nsecond\nthird";
      const modified = "first\nsecond\nchanged";
      const result = diffChars(original, modified);
      // Change on line 3
      assert.strictEqual(result[0].originalStart.line, 3);
    });

    test("should handle complete replacement", () => {
      const result = diffChars("old content", "new text");
      assert.ok(result.length > 0);
      // Should have changes that account for all differences
    });

    test("should handle unicode characters", () => {
      const result = diffChars("hello", "héllo");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].newContent, "é");
    });

    test("should handle emoji characters", () => {
      const result = diffChars("hello world", "hello 🎵 world");
      assert.ok(result.length > 0);
      // Should have an insert containing the emoji
      const hasEmoji = result.some((c) => c.newContent.includes("🎵"));
      assert.ok(hasEmoji);
    });

    test("should handle inserting a newline", () => {
      const result = diffChars("line1line2", "line1\nline2");
      assert.ok(result.length > 0);
      const hasNewline = result.some((c) => c.newContent.includes("\n"));
      assert.ok(hasNewline);
    });

    test("should handle deleting a newline", () => {
      const result = diffChars("line1\nline2", "line1line2");
      assert.ok(result.length > 0);
      assert.strictEqual(result[0].type, "delete");
    });

    test("should handle multiple separate changes", () => {
      const result = diffChars("aXbYc", "aAbBc");
      // Should have 2 changes: X->A and Y->B
      assert.strictEqual(result.length, 2);
    });
  });

  suite("generatePatches", () => {
    test("should generate single-line patch", () => {
      const changes: Change[] = [
        {
          type: "replace",
          originalStart: { line: 5, column: 10 },
          originalEnd: { line: 5, column: 15 },
          newContent: "newtext",
        },
      ];
      const patches = generatePatches(changes, "myVar");
      assert.strictEqual(patches.length, 1);
      assert.ok(patches[0].includes("myVar"));
      assert.ok(patches[0].includes(":5:10-15"));
      assert.ok(patches[0].includes("newtext"));
    });

    test("should generate multi-line patch", () => {
      const changes: Change[] = [
        {
          type: "replace",
          originalStart: { line: 2, column: 5 },
          originalEnd: { line: 4, column: 10 },
          newContent: "replacement",
        },
      ];
      const patches = generatePatches(changes, "expr");
      assert.strictEqual(patches.length, 1);
      assert.ok(patches[0].includes(":2:5-4:10"));
    });

    test("should generate delete patch with empty content", () => {
      const changes: Change[] = [
        {
          type: "delete",
          originalStart: { line: 3, column: 1 },
          originalEnd: { line: 3, column: 5 },
          newContent: "",
        },
      ];
      const patches = generatePatches(changes, "src");
      assert.strictEqual(patches.length, 1);
      assert.ok(patches[0].includes("|="));
      // The content between fences should be empty
      assert.ok(patches[0].includes("```abc\n\n```"));
    });

    test("should generate insert patch", () => {
      const changes: Change[] = [
        {
          type: "insert",
          originalStart: { line: 2, column: 8 },
          originalEnd: { line: 2, column: 8 },
          newContent: "inserted",
        },
      ];
      const patches = generatePatches(changes, "x");
      assert.strictEqual(patches.length, 1);
      assert.ok(patches[0].includes(":2:8"));
      assert.ok(patches[0].includes("inserted"));
    });

    test("should generate multiple patches in descending order", () => {
      const changes: Change[] = [
        {
          type: "replace",
          originalStart: { line: 2, column: 1 },
          originalEnd: { line: 2, column: 5 },
          newContent: "first",
        },
        {
          type: "replace",
          originalStart: { line: 5, column: 1 },
          originalEnd: { line: 5, column: 5 },
          newContent: "second",
        },
      ];
      const patches = generatePatches(changes, "v");
      assert.strictEqual(patches.length, 2);
      // First patch should be for line 5 (later position comes first)
      assert.ok(patches[0].includes(":5:"));
      assert.ok(patches[1].includes(":2:"));
    });

    test("should escape triple backticks in content", () => {
      const changes: Change[] = [
        {
          type: "insert",
          originalStart: { line: 1, column: 1 },
          originalEnd: { line: 1, column: 1 },
          newContent: "```code```",
        },
      ];
      const patches = generatePatches(changes, "src");
      assert.strictEqual(patches.length, 1);
      // Should escape the backticks
      assert.ok(patches[0].includes("\\`\\`\\`"));
    });

    test("should use correct ABC fence syntax", () => {
      const changes: Change[] = [
        {
          type: "replace",
          originalStart: { line: 1, column: 1 },
          originalEnd: { line: 1, column: 3 },
          newContent: "CDE",
        },
      ];
      const patches = generatePatches(changes, "tune");
      assert.strictEqual(patches.length, 1);
      assert.ok(patches[0].includes("```abc"));
      assert.ok(patches[0].includes("```"));
    });
  });

  suite("integration: diffChars + generatePatches", () => {
    test("should produce patches for simple replacement", () => {
      const original = "X:1\nK:C\nCDEF|";
      const modified = "X:1\nK:C\nGABC|";
      const changes = diffChars(original, modified);
      const patches = generatePatches(changes, "tune");
      assert.ok(patches.length > 0);
      // All patches should reference "tune"
      patches.forEach((p) => assert.ok(p.startsWith("tune")));
    });

    test("should produce no patches when content unchanged", () => {
      const content = "X:1\nK:C\nCDEF|";
      const changes = diffChars(content, content);
      const patches = generatePatches(changes, "tune");
      assert.strictEqual(patches.length, 0);
    });

    test("should handle real ABC content modifications", () => {
      const original = "X:1\nT:Test\nK:C\n|:CDEF|GABC:|";
      const modified = "X:1\nT:Test Song\nK:C\n|:CDEG|GABC:|";
      const changes = diffChars(original, modified);
      const patches = generatePatches(changes, "song");
      assert.ok(patches.length > 0);
    });
  });
});
