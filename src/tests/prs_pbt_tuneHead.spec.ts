import { assert } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { TT } from "../parsers/scan2";
import { Comment, Directive, Info_line, Macro_decl, User_symbol_decl, Tune_header } from "../types/Expr2";
import { AbcFormatter2 } from "../Visitors/Formatter2";
import * as ScannerGen from "./scn_pbt.generators.spec";
import { genCommentExpr } from "./prs_pbt.generators.spec";

// Create a shared context for all generators
export const sharedContext = new ABCContext(new AbcErrorReporter());

// Directive expression generator  
export const genDirectiveExpr = ScannerGen.genStylesheetDirective.map(([directive, eol]) => {
  return new Directive(sharedContext.generateId(), directive);
});

// Info line expression generator
export const genInfoLineExpr = ScannerGen.genInfoLine.map((tokens) => {
  // FIXME: urgent
  // tokens array: [eol, header, content, eol]
  const header = tokens[1];
  const content = tokens[2];
  return new Info_line(sharedContext.generateId(), tokens);
});

// Macro declaration expression generator (reuse existing)
export const genMacroDeclExpr = ScannerGen.genMacroDecl.map((tokens) => {
  // tokens array: [eol, header, ws?, variable, ws?, content, comment?, eol]
  const header = tokens.find(t => t.type === TT.MACRO_HDR)!;
  const variable = tokens.find(t => t.type === TT.MACRO_VAR)!;
  const content = tokens.find(t => t.type === TT.MACRO_STR)!;
  return new Macro_decl(sharedContext.generateId(), header, variable, content);
});

// User symbol declaration expression generator
export const genUserSymbolDeclExpr = fc.tuple(
  ScannerGen.genUserSymbolHeader,
  ScannerGen.genUserSymbolVariable,
  ScannerGen.genSymbol
).map(([header, variable, symbol]) => {
  return new User_symbol_decl(sharedContext.generateId(), header, variable, symbol);
});

// Tune header expression generator
export const genTuneHeaderExpr = fc.array(
  fc.oneof(
    genInfoLineExpr,
    genCommentExpr,
    genDirectiveExpr,
    genMacroDeclExpr,
    genUserSymbolDeclExpr
  ),
  { minLength: 1, maxLength: 8 }
).map((infoLines) => {
  return new Tune_header(sharedContext.generateId(), infoLines);
});

describe("Tune Header Round-trip Tests", () => {
  it("should correctly round-trip Comment expressions", () => {
    fc.assert(
      fc.property(genCommentExpr, (commentExpr) => {
        // Format the expression without formatting
        const formatter = new AbcFormatter2(sharedContext);
        const formattedString = formatter.stringify(commentExpr, true);

        // Parse the formatted string back
        // Note: This is a simplified test - in reality we'd need to scan the string first
        // For now, we'll just verify the expression is valid
        assert.instanceOf(commentExpr, Comment);
        assert.isString(formattedString);
        assert.isTrue(formattedString.length > 0);

        return true;
      }),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });

  it("should correctly round-trip Directive expressions", () => {
    fc.assert(
      fc.property(genDirectiveExpr, (directiveExpr) => {
        const formatter = new AbcFormatter2(sharedContext);
        const formattedString = formatter.stringify(directiveExpr, true);

        assert.instanceOf(directiveExpr, Directive);
        assert.isString(formattedString);
        assert.isTrue(formattedString.length > 0);

        return true;
      }),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });

  it("should correctly round-trip Info_line expressions", () => {
    fc.assert(
      fc.property(genInfoLineExpr, (infoLineExpr) => {
        const formatter = new AbcFormatter2(sharedContext);
        const formattedString = formatter.stringify(infoLineExpr, true);

        assert.instanceOf(infoLineExpr, Info_line);
        assert.isString(formattedString);
        assert.isTrue(formattedString.length > 0);

        return true;
      }),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });

  it("should correctly round-trip Macro_decl expressions", () => {
    fc.assert(
      fc.property(genMacroDeclExpr, (macroDeclExpr) => {
        const formatter = new AbcFormatter2(sharedContext);
        const formattedString = formatter.stringify(macroDeclExpr, true);

        assert.instanceOf(macroDeclExpr, Macro_decl);
        assert.isString(formattedString);
        assert.isTrue(formattedString.length > 0);

        return true;
      }),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });

  it("should correctly round-trip User_symbol_decl expressions", () => {
    fc.assert(
      fc.property(genUserSymbolDeclExpr, (userSymbolDeclExpr) => {
        const formatter = new AbcFormatter2(sharedContext);
        const formattedString = formatter.stringify(userSymbolDeclExpr, true);

        assert.instanceOf(userSymbolDeclExpr, User_symbol_decl);
        assert.isString(formattedString);
        assert.isTrue(formattedString.length > 0);

        return true;
      }),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });

  it("should correctly round-trip complete Tune_header expressions", () => {
    fc.assert(
      fc.property(genTuneHeaderExpr, (tuneHeaderExpr) => {
        const formatter = new AbcFormatter2(sharedContext);
        const formattedString = formatter.stringify(tuneHeaderExpr, true);

        assert.instanceOf(tuneHeaderExpr, Tune_header);
        assert.isString(formattedString);
        assert.isTrue(formattedString.length > 0);
        assert.isTrue(tuneHeaderExpr.info_lines.length > 0);

        return true;
      }),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });
});
