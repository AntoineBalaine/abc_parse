import { Token } from "./token";
import { ParserErrorType, TokenType } from "./types";

type ErrorStorageEntry = { line: number, where: string, message: string, origin?: { type: ParserErrorType } };
let errStorage: ErrorStorageEntry[] = [];

export const hasErrors = () => errStorage.length > 0;
export const resetError = () => (errStorage = []);
export const getErrors = () => errStorage;


export const error = (line: number, message: string) => {
  return report(line, "", message);
};

const report = (line: number, where: string, message: string, origin?: { type: ParserErrorType }) => {
  errStorage.push({ line, where, message, origin });
  const errMsg = stringifyError(line, where, message, origin);
  return errMsg;
};

export function stringifyError(line: number, where: string, message: string, origin?: { type: ParserErrorType }) {
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

export const tokenError = (token: Token, message: string) => {
  if (token.type === TokenType.EOF) {
    return report(token.line, " at end", message);
  } else {
    return report(token.line, " at '" + token.lexeme + "'", message);
  }
};
export const parserError = (token: Token, message: string, origin: ParserErrorType) => {
  return report(token.line, `at pos.${token.position} - '${token.lexeme}'`, message, { type: origin });
};
