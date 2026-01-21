// Type declarations for the Peggy-generated parser
export function parse(input: string, options?: { startRule?: string }): unknown;
export const StartRules: string[];
export class SyntaxError extends Error {
  message: string;
  expected?: Array<{ type: string; description: string }>;
  found?: string;
  location?: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
}
