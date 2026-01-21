import * as assert from "assert";
import { setLspClient, evaluateAbctForPreview } from "../../renderer/AbcRenderer";

// Mock LanguageClient type for testing
interface MockClient {
  sendRequest: <T>(method: string, params: unknown) => Promise<T>;
}

// Helper to create a mock client
function createMockClient(
  responses: Map<string, unknown>
): MockClient {
  return {
    sendRequest: async <T>(method: string, _params: unknown): Promise<T> => {
      if (responses.has(method)) {
        return responses.get(method) as T;
      }
      throw new Error(`Unexpected request: ${method}`);
    },
  };
}

suite("AbcRenderer Tests", () => {
  suite("evaluateAbctForPreview", () => {
    teardown(() => {
      // Reset client after each test
      setLspClient(undefined);
    });

    test("should return empty string when no client is available", async () => {
      setLspClient(undefined);
      const result = await evaluateAbctForPreview("file:///test.abct");
      assert.strictEqual(result, "");
    });

    test("should return full output when evaluation has no errors", async () => {
      const mockClient = createMockClient(
        new Map([
          [
            "abct.evaluate",
            {
              abc: "X:1\nT:Test\nK:C\nCDEF|",
              diagnostics: [],
            },
          ],
        ])
      );
      setLspClient(mockClient as unknown as Parameters<typeof setLspClient>[0]);

      const result = await evaluateAbctForPreview("file:///test.abct");
      assert.strictEqual(result, "X:1\nT:Test\nK:C\nCDEF|");
    });

    test("should return full output when there are only warnings (no errors)", async () => {
      const mockClient = createMockClient(
        new Map([
          [
            "abct.evaluate",
            {
              abc: "X:1\nT:Test\nK:C\nCDEF|",
              diagnostics: [
                {
                  severity: 2, // Warning
                  range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
                  message: "This is a warning",
                },
              ],
            },
          ],
        ])
      );
      setLspClient(mockClient as unknown as Parameters<typeof setLspClient>[0]);

      const result = await evaluateAbctForPreview("file:///test.abct");
      assert.strictEqual(result, "X:1\nT:Test\nK:C\nCDEF|");
    });

    test("should call evaluateToLine when error occurs on non-first line", async () => {
      let evaluateToLineCalled = false;
      let evaluateToLineParams: { uri: string; line: number } | undefined;

      const mockClient = {
        sendRequest: async <T>(method: string, params: unknown): Promise<T> => {
          if (method === "abct.evaluate") {
            return {
              abc: "",
              diagnostics: [
                {
                  severity: 1, // Error
                  range: { start: { line: 3, character: 0 }, end: { line: 3, character: 5 } },
                  message: "Syntax error",
                },
              ],
            } as T;
          }
          if (method === "abct.evaluateToLine") {
            evaluateToLineCalled = true;
            evaluateToLineParams = params as { uri: string; line: number };
            return {
              abc: "X:1\nT:Partial\nK:C\n",
              diagnostics: [],
            } as T;
          }
          throw new Error(`Unexpected request: ${method}`);
        },
      };
      setLspClient(mockClient as unknown as Parameters<typeof setLspClient>[0]);

      const result = await evaluateAbctForPreview("file:///test.abct");

      assert.strictEqual(evaluateToLineCalled, true, "evaluateToLine should be called");
      assert.strictEqual(evaluateToLineParams?.line, 3, "should pass error line (0-based line 3 as 1-based)");
      assert.strictEqual(result, "X:1\nT:Partial\nK:C\n");
    });

    test("should return empty string when error is on first line (line 0)", async () => {
      const mockClient = createMockClient(
        new Map([
          [
            "abct.evaluate",
            {
              abc: "",
              diagnostics: [
                {
                  severity: 1, // Error
                  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                  message: "Syntax error on first line",
                },
              ],
            },
          ],
        ])
      );
      setLspClient(mockClient as unknown as Parameters<typeof setLspClient>[0]);

      const result = await evaluateAbctForPreview("file:///test.abct");
      assert.strictEqual(result, "");
    });

    test("should return empty string when LSP request fails", async () => {
      const mockClient = {
        sendRequest: async <T>(_method: string, _params: unknown): Promise<T> => {
          throw new Error("LSP connection failed");
        },
      };
      setLspClient(mockClient as unknown as Parameters<typeof setLspClient>[0]);

      const result = await evaluateAbctForPreview("file:///test.abct");
      assert.strictEqual(result, "");
    });

    test("should return empty string when evaluateToLine fails", async () => {
      const mockClient = {
        sendRequest: async <T>(method: string, _params: unknown): Promise<T> => {
          if (method === "abct.evaluate") {
            return {
              abc: "",
              diagnostics: [
                {
                  severity: 1, // Error
                  range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
                  message: "Syntax error",
                },
              ],
            } as T;
          }
          if (method === "abct.evaluateToLine") {
            throw new Error("Partial evaluation failed");
          }
          throw new Error(`Unexpected request: ${method}`);
        },
      };
      setLspClient(mockClient as unknown as Parameters<typeof setLspClient>[0]);

      const result = await evaluateAbctForPreview("file:///test.abct");
      assert.strictEqual(result, "");
    });
  });
});
