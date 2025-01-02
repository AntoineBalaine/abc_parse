import { ABCContext } from "../parsers/Context";
import { TokenType } from "./types";

/**
 * Token is the base element output by the scanner.
 * It represents one or multiple characters in a score
 * using {@link TokenType} as reference for what it represents.
 * */
export class Token {
  public type: TokenType;
  public lexeme: string;
  public literal: any | null;
  public line: number;
  public position: number;
  public id: number;
  public toString = () => {
    return this.type + " " + this.lexeme + " " + this.literal;
  };
  constructor(type: TokenType, lexeme: string, literal: any | null, line: number, position: number, ctx: ABCContext) {
    this.type = type;
    this.lexeme = lexeme;
    this.literal = literal;
    this.line = line;
    this.position = position;
    this.id = ctx.generateId();
  }
}
