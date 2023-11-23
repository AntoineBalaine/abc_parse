import { Token } from "./token";
import { ParserErrorType, TokenType } from "./types";

type ErrorStorageEntry = { line: number, where: string, message: string, origin?: { type: ParserErrorType } };

export class AbcErrorReporter {
  private errors: ErrorStorageEntry[];

  constructor() {
    this.errors = [];
  }

  private report = (line: number, where: string, message: string, origin?: { type: ParserErrorType }) => {
    this.errors.push({ line, where, message, origin });
    const errMsg = this.stringifyError(line, where, message, origin);
    return errMsg;
  };

  hasErrors = () => this.errors.length > 0;
  resetErrors = () => (this.errors = []);
  getErrors = () => this.errors;


  ScannerError = (line: number, message: string) => {
    return this.report(line, "", message);
  };


  stringifyError(line: number, where: string, message: string, origin?: { type: ParserErrorType }) {
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
      return this.report(token.line, " at end", message);
    } else {
      return this.report(token.line, " at '" + token.lexeme + "'", message);
    }
  };

  parserError = (token: Token, message: string, origin: ParserErrorType) => {
    return this.report(token.line, `at pos.${token.position} - '${token.lexeme}'`, message, { type: origin });
  };

}