import { ParserErrorType } from "../types/types";
import { Ctx, Token } from "./scan2";

export type AbcError = { message: string; token: Token; origin: ParserErrorType };

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

  private report = (message: string, token: Token, origin: ParserErrorType) => {
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

  Scanner2Error = (ctx: Ctx, messag: string) => {
    // this.report(messag, new Token(TT.AMPERSAND, "", null, -1, -1), ParserErrorType.BACKTICK);
  };

  private stringifyError({ message, token, origin }: AbcError) {
    const where = `at pos.${token.position} - '${token.lexeme}'`;
    let errMsg = `[line ${token.line}] Error ${where}: ${message}`;
    if (origin) {
      if (origin === ParserErrorType.TUNE_BODY) {
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
