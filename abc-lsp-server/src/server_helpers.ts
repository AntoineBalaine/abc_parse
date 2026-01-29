import { AbcError, RangeVisitor, TT } from "abc-parser";
import { Diagnostic, PublishDiagnosticsParams } from "vscode-languageserver";

/**
 * convert errors from an {@link AbcErrorReporter} to the server's {@link Diagnostic}s
 */
export function mapAbcErrorsToDiagnostics(abcErrors: Array<AbcError>, rangeVisitor: RangeVisitor): Array<Diagnostic> {
  return abcErrors.map((error): Diagnostic => {
    return {
      severity: 1,
      range: error.token.accept(rangeVisitor),
      message: error.message,
      source: "abc",
    };
  });
}

/**
 * convert warnings from an {@link AbcErrorReporter} to the server's {@link Diagnostic}s
 */
export function mapAbcWarningsToDiagnostics(abcwarnings: Array<AbcError>, rangeVisitor: RangeVisitor): Array<Diagnostic> {
  return abcwarnings.map((warning): Diagnostic => {
    return {
      severity: 2,
      range: warning.token.accept(rangeVisitor),
      message: warning.message,
      source: "abc",
    };
  });
}

export function mapTTtoStandardScope(type: number): number {
  switch (type) {
    case TT.ACCIDENTAL:
    case TT.SY_TXT:
      return standardTokenScopes.decorator;
    case TT.AMPERSAND:
    case TT.ANNOTATION:
      return standardTokenScopes.comment;
    case TT.BARLINE:
      return standardTokenScopes.string;
    case TT.BCKTCK_SPC:
    case TT.SY_STAR:
      return standardTokenScopes.comment;
    case TT.CHRD_LEFT_BRKT:
    case TT.CHRD_RIGHT_BRKT:
      return standardTokenScopes.string;
    case TT.COMMENT:
      return standardTokenScopes.comment;
    case TT.DECORATION:
      return standardTokenScopes.decorator;
    case TT.ESCAPED_CHAR:
      return standardTokenScopes.comment;
    case TT.GRC_GRP_LEFT_BRACE:
    case TT.GRC_GRP_RGHT_BRACE:
    case TT.GRC_GRP_SLSH:
      return standardTokenScopes.string;
    case TT.INFO_STR:
      return standardTokenScopes.comment;
    case TT.STYLESHEET_DIRECTIVE:
    case TT.INF_HDR:
    case TT.SY_HDR:
      return standardTokenScopes.keyword;
    case TT.FREE_TXT:
      return standardTokenScopes.string;
    case TT.INLN_FLD_LFT_BRKT:
    case TT.INLN_FLD_RGT_BRKT:
    case TT.NOTE_LETTER:
      return standardTokenScopes.variable;
    case TT.IDENTIFIER:
    case TT.OCTAVE:
    case TT.REST:
      return standardTokenScopes.variable;
    case TT.NUMBER:
    case TT.RHY_BRKN:
    case TT.RHY_DENOM:
    case TT.RHY_NUMER:
    case TT.RHY_SEP:
      return standardTokenScopes.number; // rhythm
    case TT.SLUR:
      return standardTokenScopes.comment;
    case TT.SYMBOL:
      return standardTokenScopes.regexp;
    case TT.TIE:
    case TT.TUPLET_COLON:
    case TT.TUPLET_LPAREN:
    case TT.TUPLET_P:
    case TT.TUPLET_Q:
    case TT.TUPLET_R:
      return standardTokenScopes.string;
    case TT.VOICE:
    case TT.VOICE_OVRLAY:
      return standardTokenScopes.string;
    case TT.Y_SPC:
      return standardTokenScopes.variable;
    case TT.REPEAT_NUMBER:
      return standardTokenScopes.number; // rhythm
    case TT.REPEAT_COMMA:
    case TT.REPEAT_DASH:
    case TT.REPEAT_X:
      return standardTokenScopes.comment;
    case TT.CHORD_SYMBOL:
    case TT.KEY_SIGNATURE:
      return standardTokenScopes.type;
    case TT.MINUS:
    case TT.PLUS:
      return standardTokenScopes.string;
    default:
      return -1;
  }
}

export type LspEventListener = (type: "diagnostics", params: PublishDiagnosticsParams) => void;

/**
 * These are the standard scope names that are used for syntax highlighting.
 */
export enum standardTokenScopes {
  class,
  comment,
  decorator,
  enum,
  enumMember,
  event,
  function,
  interface,
  keyword,
  label,
  macro,
  method,
  namespace,
  number,
  operator,
  parameter,
  property,
  regexp,
  string,
  struct,
  type,
  typeParameter,
  variable,
}

/*
 *
USED scopes: 
comment
decorator;
keyword;
number;
regexp;
string;
variable
*/
