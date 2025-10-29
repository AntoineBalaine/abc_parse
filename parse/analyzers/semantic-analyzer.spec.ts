import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Directive } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";

describe("SemanticAnalyzer", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("Error Handling", () => {
    it("should handle unknown directive", () => {
      const directive = new Directive(
        10, // id
        new Token(TT.IDENTIFIER, "unknowndirective", 37), // key
        [] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);
      expect(result).to.be.null;
    });
  });

  describe("Utility Methods", () => {
    it("should clear semantic data", () => {
      const directive = new Directive(
        11, // id
        new Token(TT.IDENTIFIER, "titlefont", 39), // key
        [new Token(TT.IDENTIFIER, "Arial", 40)] // values
      );

      analyzer.visitDirectiveExpr(directive);
      expect(analyzer.data.size > 0).to.equal(true);

      analyzer.data.clear();
      expect(analyzer.data.size > 0).to.equal(false);
    });
  });
});
