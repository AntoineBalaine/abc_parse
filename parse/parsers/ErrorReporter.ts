import { ParserErrorType } from "../types/types";
import { Ctx, Token } from "./scan2";
import { Expr } from "../types/Expr2";
import { isToken } from "../helpers";
import { RangeVisitor } from "../Visitors/RangeVisitor";

export type AbcError = { message: string; token: Token | Expr; origin: ParserErrorType };

/**
 * Handles warnings and errors from the scanner and parser.
 * Scanner throws `AbcErrorReporter.ScannerErrors` and parser throws `AbcErrorReporter.parserError`.
 *
 * exposed methods are:
 * ```
 * hasErrors()
 * resetErrors()
 * getErrors()
 * hasWarnings()
 * resetWarnings()
 * getWarnings()
 * ```
 * This is meant to be used by diagnostics in the context of an LSP.
 */
export class AbcErrorReporter {
  private errors: AbcError[];
  private warnings: AbcError[];

  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  private report = (message: string, token: Token | Expr, origin: ParserErrorType) => {
    const err: AbcError = { message, token, origin };
    this.errors.push(err);
    return this.stringifyError(err);
  };

  hasErrors = () => this.errors.length > 0;
  resetErrors = () => (this.errors = []);
  /**
   * Return an array of errors thrown by the parser or the scanner
   */
  getErrors = () => this.errors;
  hasWarnings = () => this.warnings.length > 0;
  resetWarnings = () => (this.warnings = []);
  /**
   * Return an array of warnings thrown by the parser.
   * WIP - not many warnings are implemented atm.
   */
  getWarnings = () => this.warnings;

  ScannerError = (message: string, token: Token) => {
    return this.report(message, token, ParserErrorType.SCANNER);
  };

  parserError = (token: Token, message: string, origin: ParserErrorType) => this.report(message, token, origin);

  analyzerError = (message: string, expr: Expr) => {
    return this.report(message, expr, ParserErrorType.ANALYZER);
  };

  interpreterError = (message: string, expr: Expr) => {
    return this.report(message, expr, ParserErrorType.INTERPRETER);
  };

  Scanner2Error = (ctx: Ctx, messag: string) => {
    // this.report(messag, new Token(TT.AMPERSAND, "", null, -1, -1), ParserErrorType.BACKTICK);
  };

  private stringifyError({ message, token, origin }: AbcError) {
    let where = "";
    let line: number | string = "?";

    if (token) {
      if (isToken(token)) {
        // It's a Token
        where = `at pos.${token.position} - '${token.lexeme}'`;
        line = token.line;
      } else {
        // It's an Expr - use RangeVisitor to get position
        const rangeVisitor = new RangeVisitor();
        const range = token.accept(rangeVisitor);
        where = `at expression id ${token.id}`;
        line = range.start.line;
      }
    }

    let errMsg = `[line ${line}] Error ${where}: ${message}`;
    if (origin) {
      if (origin === ParserErrorType.ANALYZER) {
        errMsg = `Semantic Analysis Error:\n ${errMsg}\n`;
      } else if (origin === ParserErrorType.TUNE_BODY) {
        errMsg = `Tune Body Error:\n ${errMsg}\n`;
      } else if (origin === ParserErrorType.TUNE_HEADER) {
        errMsg = `Tune Header Error:\n ${errMsg}\n`;
      } else if (origin === ParserErrorType.FILE_HEADER) {
        errMsg = `File Header Error:\n ${errMsg}\n`;
      } else {
        errMsg = `File Structure error:\n ${errMsg}\n`;
      }
    }
    return errMsg;
  }
}
