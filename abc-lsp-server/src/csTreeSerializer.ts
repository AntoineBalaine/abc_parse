/**
 * CSTree serialization module.
 *
 * Converts a CSTree back to ABC text using the AST formatter.
 */

import { AbcFormatter, ABCContext, Expr, Token } from "abc-parser";
import { CSNode, toAst } from "editor";

/**
 * Serializes a CSTree to ABC text.
 * Converts the CSTree to AST, then uses AbcFormatter to stringify.
 */
export function serializeCSTree(root: CSNode, ctx: ABCContext): string {
  const ast = toAst(root);
  const formatter = new AbcFormatter(ctx);
  return formatter.stringify(ast as Expr | Token);
}
