import { Token } from "../types/token";
import { ParserErrorType, TokenType } from "../types/types";

export type AbcError = { line: number, where: string, message: string, token: Token, origin?: { type: ParserErrorType } };

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

  private report = (line: number, where: string, message: string, token: Token, origin?: { type: ParserErrorType }) => {
    this.errors.push({ line, where, message, token, origin });
    const errMsg = this.stringifyError(line, where, message, origin);
    return errMsg;
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


  ScannerError = (line: number, message: string, token: Token) => {
    return this.report(line, "", message, token);
  };


  private stringifyError(line: number, where: string, message: string, origin?: { type: ParserErrorType }) {
    let errMsg = `[line ${line}] Error ${where}: ${message}`;
    if (origin) {
      if (origin.type === ParserErrorType.TUNE_BODY) {
        errMsg = (`Tune Body Error:\n ${errMsg}\n`);
      } else if (origin.type === ParserErrorType.TUNE_HEADER) {
        errMsg = (`Tune Header Error:\n ${errMsg}\n`);
      } else if (origin.type === ParserErrorType.FILE_HEADER) {
        errMsg = (`File Header Error:\n ${errMsg}\n`);
      }
      else {
        errMsg = (`File Structure error:\n ${errMsg}\n`);
      }
    }
    return errMsg;
  }

  tokenError = (token: Token, message: string) => {
    if (token.type === TokenType.EOF) {
      return this.report(token.line, " at end", message, token);
    } else {
      return this.report(token.line, " at '" + token.lexeme + "'", message, token);
    }
  };

  parserError = (token: Token, message: string, origin: ParserErrorType) => {
    return this.report(token.line, `at pos.${token.position} - '${token.lexeme}'`, message, token, { type: origin });
  };

  parserWarning = (token: Token, message: string, origin: ParserErrorType) => {
    this.warnings.push({ line: token.line, where: `at pos.${token.position} - '${token.lexeme}'`, message, token, origin: { type: origin } });
  };
}
