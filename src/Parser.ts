import { createHistogram } from "perf_hooks"
import { parserError, tokenError } from "./error"
import {
  File_header,
  Info_line,
  Lyric_section,
  Pitch,
  Rhythm,
  Tune,
  Tune_header,
} from "./Expr"
import Token from "./token"
import { TokenType } from "./types"

export class Parser {
  private tokens: Array<Token>
  private current = 0
  constructor(tokens: Array<Token>) {
    this.tokens = tokens
  }

  parse() {
    try {
      return this.file_structure()
    } catch {
      return null
    }
  }

  private file_structure() {
    while (!this.isAtEnd()) {
      if ((this.current = 0 && this.peek().lexeme !== "X:")) this.file_header()
      else if (this.peek().lexeme === "X:") this.tune()
      this.tune()
    }
  }
  private file_header() {
    //collect a multiline string
    //until finding two line breaks in a row
    let header_text = ""
    while (!this.isAtEnd()) {
      if (
        this.peek().type === TokenType.EOL &&
        this.peekNext().type === TokenType.EOL
      ) {
        break
      } else {
        header_text += this.peek().lexeme
        this.advance()
      }
    }
    return new File_header(header_text)
  }
  private tune() {
    // parse a tune header
    // then try to parse a tune body
    // unless the header is followed by a line break
    const tune_header = this.tune_header()
    if (this.peek().type === TokenType.EOL) {
      return tune_header
    } else {
      const tune_body = this.tune_body()
      return new Tune(tune_header, tune_body)
    }
  }

  private tune_header() {
    const info_lines = []
    let currentTokens: Array<Token> = []
    while (!this.isAtEnd()) {
      if (
        this.peek().type === TokenType.EOL &&
        this.peekNext().type !== TokenType.LETTER_COLON
      ) {
        break
      } else {
        if (this.peek().type === TokenType.EOL) {
          const line = new Info_line(currentTokens)
          info_lines.push(line)
          currentTokens = []
        } else {
          currentTokens.push(this.peek())
        }
        this.advance()
      }
    }
    return new Tune_header(info_lines)
  }

  private info_line() {
    const info_line = []
    while (!this.isAtEnd()) {
      if (
        this.peek().type === TokenType.EOL &&
        !(this.peekNext().type === TokenType.PLUS_COLON)
      ) {
        break
      } else {
        if (this.peek().type === TokenType.EOL) {
          info_line.push(this.peek())
          this.advance()
        }
        info_line.push(this.peek())
        this.advance()
      }
    }
    return new Info_line(info_line)
  }

  private tune_body() {
    let elements: Array<Comment | Info_line | Music_code> = []
    while (!this.isAtEnd()) {
      //check for commentline
      // check for info line
      // check for music_code
      if (this.peek().type === TokenType.COMMENT) {
        elements.push(this.comment_line())
      } else if (this.peek().type === TokenType.LETTER_COLON) {
        elements.push(this.info_line())
      } else if (
        !(
          this.peek().type === TokenType.EOL &&
          this.peekNext().type === TokenType.EOL
        )
      ) {
        elements.push(this.music_content())
      } else if (this.peek().type === TokenType.EOL) {
        break
      }
    }
    return new Tune_body(elements)
  }
  private music_content() {
    const contents = []
    const curTokn = this.peek()
    while (!this.isAtEnd() && curTokn.type !== TokenType.EOL) {
      switch (curTokn.type) {
        case TokenType.WHITESPACE:
        case TokenType.ANTISLASH_EOL:
          this.advance()
          continue
        case TokenType.BARLINE:
        case TokenType.BAR_COLON:
        case TokenType.BAR_DBL:
        case TokenType.BAR_RIGHTBRKT:
        case TokenType.LEFTBRKT_BAR:
        case TokenType.STRING:
          contents.push(curTokn)
          this.advance()
          break
        case TokenType.DOT:
        // parse the note following the dot
        // and add the dot to the note
        case TokenType.EOL:
        // ??
        case TokenType.FLAT:
        case TokenType.FLAT_DBL:
        case TokenType.NATURAL:
        case TokenType.NOTE_LETTER:
        case TokenType.SHARP:
        case TokenType.SHARP_DBL:
          // parse a note
          contents.push(this.parse_note())
        case TokenType.LEFT_BRACE:
        // parse a grace group
        case TokenType.LEFTBRKT_NUMBER:
        // parse a nth repeat
        case TokenType.LEFTBRKT:
          if (this.peekNext().type === TokenType.LETTER_COLON) {
            // parse an inline field
          } else {
            // parse a chord
          }
        case TokenType.LEFTPAREN:
        // parse a beam group
        case TokenType.LEFTPAREN_NUMBER:
        // parse a tuplet
        // which is a leftparen_number followed by
        // a beam group
        case TokenType.SYMBOL:
        // return symbol token
        case TokenType.LETTER:
        // if letter is a rest
        // return note or multimeasure rest
        // else throw error
        default:
          throw this.error(curTokn, "Unexpected token")
      }
    }
  }
  private parse_note() {
    // pitch or rest, optionnally followed by a rhythm
    type noteType = {
      pitchOrRest: Pitch | Rest
      rhythm?: Rhythm
    }
    let note = <noteType>{}
    while (!this.isAtEnd()) {
      if (this.peek().type === TokenType.NOTE_LETTER) {
        note = { pitchOrRest: this.pitch() }
      } else if (this.isRest()) {
        note = { pitchOrRest: this.rest() }
      } else {
        throw this.error(this.peek(), "Unexpected token")
      }
    }
    if (!this.isAtEnd() && this.isRhythm()) {
      note.rhythm = this.rhythm()
    }
  }
  private rest() {
    throw new Error("Method not implemented.")
  }

  private rhythm() {
    // slash optionnally followed by a number
    if (this.peek().type === TokenType.SLASH) {
      if (this.peekNext().type === TokenType.NUMBER) {
        return new Rhythm(null, this.peek(), this.peekNext())
      } else {
        return new Rhythm(null, this.peek())
      }
      // number optionnally followed by a slash and a number
    } else if (this.peek().type === TokenType.NUMBER) {
      const firstNum = this.peek()
      this.advance()
      if (this.peek().type === TokenType.SLASH) {
        if (this.peekNext().type === TokenType.NUMBER) {
          return new Rhythm(null, this.peek(), this.peekNext())
        } else {
          return new Rhythm(null, this.peek())
        }
      } else return new Rhythm(this.peek())
      // broken rhythm
    } else if (
      this.peek().type === TokenType.GREATER ||
      this.peek().type === TokenType.LESS
    ) {
      return new Rhythm(null, this.peek())
    } else {
      throw this.error(this.peek(), "Unexpected token")
    }
  }
  private comment_line() {
    let comment = ""
    while (!this.isAtEnd()) {
      if (this.peek().type === TokenType.EOL) {
        break
      } else {
        comment += this.peek().lexeme
        this.advance()
      }
    }
    return new Comment(comment)
  }
  // TODO integrate in the file structure
  private lyric_section() {
    const lyric_section = []
    while (
      !this.isAtEnd() &&
      this.peek().type === TokenType.LETTER_COLON &&
      this.peekNext().lexeme === "W:"
    ) {
      lyric_section.push(this.info_line())
    }
    return new Lyric_section(lyric_section)
  }

  private pitch() {
    let alteration, noteLetter, octave
    if (
      this.match(
        TokenType.SHARP,
        TokenType.SHARP_DBL,
        TokenType.FLAT,
        TokenType.FLAT_DBL,
        TokenType.NATURAL
      )
    ) {
      //new Alteration
      alteration = this.previous()
    }
    if (this.match(TokenType.NOTE_LETTER)) {
      //new NoteLetter
      noteLetter = this.previous()
    } else {
      throw this.error(this.peek(), "Expected a note letter")
    }
    if (this.match(TokenType.COMMA, TokenType.APOSTROPHE)) {
      octave = this.previous()
    }
    return new Pitch({ alteration, noteLetter, octave })
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    throw this.error(this.peek(), message)
  }

  private error(token: Token, message: string): Error {
    parserError(token, message)
    return new Error()
  }

  /*   private synchronize() {
    this.advance()
    while (!this.isAtEnd()) {
      if (this.previous().type == TokenType.SEMICOLON) return
      switch (this.peek().type) {
        case TokenType.CLASS:
        case TokenType.FUN:
        case TokenType.VAR:
        case TokenType.FOR:
        case TokenType.IF:
        case TokenType.WHILE:
        case TokenType.PRINT:
        case TokenType.RETURN:
          return
      }
      this.advance()
    }
  } */
  private match(...types: Array<TokenType>): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance()
        return true
      }
    }
    return false
  }
  private check(type: TokenType) {
    if (this.isAtEnd()) return false
    return this.peek().type === type
  }
  private advance(): Token {
    if (!this.isAtEnd()) this.current++
    return this.previous()
  }
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF
  }
  private peek(): Token {
    return this.tokens[this.current]
  }
  private peekNext(): Token {
    return this.tokens[this.current + 1]
  }
  private previous(): Token {
    return this.tokens[this.current - 1]
  }

  private isRhythm = () => {
    const pkd = this.peek()
    return pkd.type === TokenType.SLASH || pkd.type === TokenType.NUMBER
  }

  private isRest = () => {
    const pkd = this.peek()
    return (
      pkd.type === TokenType.NOTE_LETTER &&
      (pkd.lexeme === "z" ||
        pkd.lexeme === "Z" ||
        pkd.lexeme === "x" ||
        pkd.lexeme === "X")
    )
  }
}
