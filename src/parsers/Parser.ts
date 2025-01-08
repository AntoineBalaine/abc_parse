import {
  beamEnd,
  foundBeam,
  foundMusic,
  hasRestAttributes,
  isChord,
  isDecorationToken,
  isInvalidBacktick,
  isMultiMesureRestToken,
  isNote,
  isNoteToken,
  isRestToken,
  isRhythmToken,
} from "../helpers";
import {
  Annotation,
  BarLine,
  Beam,
  Beam_contents,
  Chord,
  Comment,
  Decoration,
  File_header,
  File_structure,
  Grace_group,
  Info_line,
  Inline_field,
  Lyric_section,
  MultiMeasureRest,
  Music_code,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tune,
  Tune_Body,
  Tune_header,
  Tuplet,
  Voice_overlay,
  YSPACER,
  tune_body_code,
  ErrorExpr,
} from "../types/Expr";
import { Token } from "../types/token";
import { ParserErrorType, TokenType } from "../types/types";
import { TokensVisitor } from "../Visitors/SemanticTokens";
import { ABCContext } from "./Context";
import { AbcErrorReporter } from "./ErrorReporter";
import { VoiceParser } from "./Voices";

/**
 * Takes an array of tokens from the `Scanner`,
 * and parses the result into a syntax tree
 * when you call `parse()`.
 *
 * eg:
 * ```typescript
 * const tokens = new Scanner(source).scanTokens();
 * const parser = new Parser(tokens, source);
 * const ast = parser.parse();
 * ```
 *
 * By default, the data type of the AST will be {@link File_structure},
 * since `parse()` always starts at the top of the file.
 * This assumes that the file structure is always the same:
 * ```
 * File structure
 *  File_Header (optional)
 *  Tunes (one or many)
 *    Tune_Header
 *      Info_lines (at least one: `X:<tune_number>`)
 *    TuneBody (optional)
 *      Some music markdown
 * ```
 * The {@link File_structure} is the root node of the syntax tree,
 * and every node of the tree is either an {@link Expr} or a {@link Token}.
 * Every {@link Expr} exposes an `accept` method,
 * which allows for visiting every node of the tree using the {@link Visitor} pattern.
 *
 * The parser optionnally takes an {@link AbcErrorReporter},
 * in the case you'd like to use the same error reporter for the Scanner and the Parser.
 * ```typescript
 * const ctx.errorReporter = new AbcErrorReporter();
 * const tokens = new Scanner(source, ctx.errorReporter).scanTokens();
 * const parser = new Parser(tokens, source, ctx.errorReporter).scanTokens();
 * const ast = parser.parse();
 * const errors = ctx.errorReporter.getErrors();
 * ```
 *
 * Otherwise, you can just retrieve the parsers's errors directly:
 * ```typescript
 * const ctx.errorReporter = new AbcErrorReporter();
 * const tokens = new Scanner(source, ctx.errorReporter).scanTokens();
 * const parser = new Parser(tokens, source, ctx.errorReporter).scanTokens();
 * const ast = parser.parse();
 * if (parser.hasErrors()) {
 *  const errors = parser.getErrors();
 * }
 * ```
 *
 */
export class Parser {
  private tokens: Array<Token>;
  private err_tokens: Array<Token> = [];
  private current = 0;
  private AST: File_structure | null = null;
  private ctx: ABCContext;
  constructor(tokens: Array<Token>, ctx: ABCContext) {
    this.tokens = tokens;
    this.ctx = ctx;
  }
  hasErrors = () => this.ctx.errorReporter.hasErrors();
  resetErrors = () => this.ctx.errorReporter.resetErrors();
  getErrors = () => this.ctx.errorReporter.getErrors();

  /**
   * Parse the contents of the source file, and return an AST.
   *
   * The parser will return `null` in case of uncaught errors
   * (though hopefully most of them will get caught.)
   *
   * Parsing starts at the top of the file,
   * returns a `File_structure` expression,
   * and expects there to be at least one tune in the file.
   */
  parse() {
    try {
      const AST = this.file_structure();
      this.AST = AST;
      return AST;
    } catch (err) {
      return null;
    }
  }

  /**
   * @throws {Error}
   */
  private file_structure() {
    let file_header: File_header | null = null;
    let tunes: Array<Tune> = [];
    while (!this.isAtEnd()) {
      const pkd = this.peek();
      if (this.current === 0 && pkd.lexeme !== "X:") {
        file_header = this.file_header();
      } else if (pkd.type === TokenType.LETTER_COLON) {
        tunes.push(this.tune());
      } else if (pkd.type === TokenType.EOF) {
        break;
        /**accomodate cases where WS and empty lines follow end of a tune */
      } else if (pkd.type === TokenType.WHITESPACE || pkd.type === TokenType.EOL) {
        this.advance();
        continue;
      } else {
        throw this.error(this.peek(), "Expected a tune or file header", ParserErrorType.FILE_HEADER);
      }
    }
    return new File_structure(this.ctx, file_header, tunes);
  }

  private file_header() {
    //collect a multiline string
    //until finding two line breaks in a row
    let header_text = "";
    let tokens: Token[] = [];
    while (!this.isAtEnd()) {
      if (this.peek().type === TokenType.EOL && this.peekNext().type === TokenType.EOL) {
        this.consume(TokenType.EOL, "Expected a line break", ParserErrorType.FILE_HEADER);
      } else if (this.peek().lexeme === "X:") {
        break;
      } else {
        tokens.push(this.peek());
        header_text += this.peek().lexeme;
        this.advance();
      }
    }
    return new File_header(this.ctx, header_text, tokens);
  }
  private tune() {
    // parse a tune header
    // then try to parse a tune body
    // unless the header is followed by a line break
    const tune_header = this.tune_header();
    if (this.peek().type === TokenType.EOL || this.peek().type === TokenType.EOF) {
      return new Tune(this.ctx, tune_header);
    } else {
      const tune_body = this.tune_body(tune_header.voices);
      return new Tune(this.ctx, tune_header, tune_body);
    }
  }

  private tune_header() {
    const info_lines = [];
    const voices: Array<string> = [];
    while (!this.isAtEnd()) {
      if (this.peek().type === TokenType.LETTER_COLON) {
        /**
         * read the info line: if it's a VOICE line (V: key)
         * then stringify the tokens in the value, and add to the array of voice names.
         */
        //find whether this is the voices legend or the actual start of the tune_body.
        if (this.peek().lexeme === "V:" && !this.isVoicesLegend(voices)) {
          return new Tune_header(this.ctx, info_lines, voices);
        }
        const line = this.info_line();
        if (line.key.lexeme === "V:") {
          /**
           * trim the space in the value line, and remove any trailing comments after the legend
           */
          const legend = line.value[0].lexeme;
          voices.push(legend);
        }
        info_lines.push(line);
      } else if (this.peek().type === TokenType.COMMENT || this.peek().type === TokenType.STYLESHEET_DIRECTIVE) {
        info_lines.push(this.comment_line());
      } else if (
        this.peek().type === TokenType.EOL &&
        (this.peekNext().type === TokenType.LETTER_COLON ||
          this.peekNext().type === TokenType.COMMENT ||
          this.peekNext().type === TokenType.STYLESHEET_DIRECTIVE)
      ) {
        this.advance();
      } else {
        break;
      }
    }
    this.advance();
    return new Tune_header(this.ctx, info_lines, voices);
  }

  private info_line() {
    const info_line = [];
    while (!this.isAtEnd()) {
      if (this.peek().type === TokenType.EOL && !(this.peekNext().type === TokenType.PLUS_COLON)) {
        break;
      } else {
        if (this.peek().type === TokenType.EOL) {
          info_line.push(this.peek());
          this.advance();
        }
        info_line.push(this.peek());
        this.advance();
      }
    }
    return new Info_line(this.ctx, info_line);
  }

  private tune_body(voices?: string[]) {
    let elements: Array<tune_body_code> = [];

    while (!this.isAtEnd()) {
      //check for commentline
      // check for info line
      // check for music_code
      try {
        if (this.peek().type === TokenType.COMMENT || this.peek().type === TokenType.STYLESHEET_DIRECTIVE) {
          elements.push(this.comment_line());
        } else if (this.peek().type === TokenType.LETTER_COLON) {
          const info_line = this.info_line();
          elements.push(info_line);
        } else if (!(this.peek().type === TokenType.EOL && this.peekNext().type === TokenType.EOL)) {
          elements = elements.concat(this.music_content().contents);
        } else if (this.peek().type === TokenType.EOL) {
          break;
        }
      } catch (err: any) {
        // Convert errors into ErrorExpr nodes
        elements.push(this.handleError(this.peek(), err.message, ParserErrorType.TUNE_BODY));
      }
    }

    const elements_with_beams = this.beam(elements);
    const systems = new VoiceParser(elements_with_beams, voices).parse();
    return new Tune_Body(this.ctx, systems);
  }

  /**
   * @throws {Error}
   */
  private music_content() {
    const contents: Array<
      | Token
      | YSPACER
      | BarLine
      | Decoration
      | Annotation
      | Note
      | Grace_group
      | Inline_field
      | Chord
      | Symbol
      | MultiMeasureRest
      | Beam
      | Tuplet
      | ErrorExpr
    > = [];
    const curTokn = this.peek();

    switch (curTokn.type) {
      case TokenType.BACKTICK:
        if (this.current === this.tokens.length - 1) {
          throw this.error(curTokn, "backticks should be inside a beam", ParserErrorType.BACKTICK);
        } else if (!isInvalidBacktick(contents, this.tokens.slice(this.current + 1))) {
          contents.push(new Decoration(this.ctx, curTokn));
          this.advance();
        } else {
          throw this.error(curTokn, "backticks should be inside a beam", ParserErrorType.BACKTICK);
        }
        break;
      case TokenType.EOL:
      case TokenType.DOLLAR:
      case TokenType.RESERVED_CHAR:
      case TokenType.WHITESPACE:
      case TokenType.ANTISLASH_EOL:
        contents.push(curTokn);
        this.advance();
        break;
      case TokenType.AMPERSAND:
        let ampersands = [];
        while (this.peek().type === TokenType.AMPERSAND) {
          ampersands.push(this.peek());
          this.advance();
        }
        contents.push(this.voice_overlay(ampersands));
        break;

      case TokenType.LEFTBRKT:
        if (this.peekNext().type === TokenType.LETTER_COLON) {
          contents.push(this.inline_field());
        } else if (this.peekNext().type === TokenType.BARLINE || this.peekNext().type === TokenType.NUMBER) {
          contents.push(this.parseBarLine());
        } else {
          contents.push(this.chord());
        }
        break;
      case TokenType.BARLINE:
      case TokenType.COLON:
        contents.push(this.parseBarLine());
        break;
      // // TODO accomodate cases of
      // // nth repeat containing a barline
      // // parse a nth repeat
      // const nthRepeat = this.nth_repeat();
      // if (nthRepeat.length === 2) {
      //   contents.push(nthRepeat[0]);
      //   contents.push(nthRepeat[1]);
      // } else if (nthRepeat.length === 1) {
      //   contents.push(nthRepeat[0]);
      // }
      // break;
      case TokenType.STRING:
        contents.push(this.annotation());
        this.advance();
        break;
      case TokenType.DOT:
      case TokenType.TILDE:
        // parse the note following the dot
        // and add the dot to the note
        if (this.isDecoration()) {
          contents.push(new Decoration(this.ctx, curTokn));
          this.advance();
        } else {
          throw this.error(this.peek(), "decorations should be followed by a note", ParserErrorType.DECORATION);
        }
        break;
      case TokenType.FLAT:
      case TokenType.FLAT_HALF:
      case TokenType.SHARP_HALF:
      case TokenType.FLAT_DBL:
      case TokenType.NATURAL:
      case TokenType.NOTE_LETTER:
      case TokenType.SHARP:
      case TokenType.SHARP_DBL:
        // TODO in the interpreter:
        // parse a beam group
        // if there is only one note in the beam group
        // return a note
        contents.push(this.parse_note());
        break;
      case TokenType.LEFT_BRACE:
        contents.push(this.grace_group());
        break;

      case TokenType.LEFTPAREN:
        contents.push(curTokn);
        this.advance();
        break;
      case TokenType.RIGHT_PAREN:
        contents.push(curTokn);
        this.advance();
        break;
      case TokenType.LEFTPAREN_NUMBER:
        if (foundMusic(this.tokens, this.current + 1)) {
          contents.push(this.tuplet());
        } else {
          throw this.error(curTokn, "Tuplet markers should be followed by a note", ParserErrorType.TUPLET);
        }
        break;
      case TokenType.SYMBOL:
        contents.push(this.symbol());
        break;
      case TokenType.LETTER:
        if (curTokn.lexeme === "y") {
          const ySpacer = curTokn;
          this.advance();

          // Check for optional rhythm
          let rhythm: Rhythm | undefined;
          if (isRhythmToken(this.peek())) {
            rhythm = this.rhythm();
          }

          contents.push(new YSPACER(this.ctx, ySpacer, rhythm));
        } else if (this.isDecoration()) {
          contents.push(new Decoration(this.ctx, curTokn));
          this.advance();
        } else if (isMultiMesureRestToken(this.peek())) {
          contents.push(this.multiMeasureRest());
        } else if (isRestToken(this.peek())) {
          contents.push(this.parse_note());
        } else {
          throw this.error(curTokn, "Unexpected token after letter", ParserErrorType.LETTER);
        }
        break;
      default:
        // Instead of throwing, create an error node
        throw this.error(curTokn, "Unexpected token in music code", ParserErrorType.TUNE_BODY);
    }

    return new Music_code(this.ctx, contents);
  }
  voice_overlay(ampersands: Token[]): Voice_overlay {
    return new Voice_overlay(this.ctx, ampersands);
  }
  /**
   * Parse a tuplet expression.
   * Syntax can be either:
   * - Simple form: (n where n is 2-9
   * - Extended form: (p:q:r where:
   *   p = number of notes
   *   q = time value (optional)
   *   r = number of notes affected (optional, defaults to p)
   *
   * Examples:
   * (3    -> (3:2:3  (triplet)
   * (3::  -> (3:2:3  (same)
   * (3:2  -> (3:2:3  (same)
   * (3::2 -> (3:2:2  (triplet affecting 2 notes)
   */
  private tuplet(): Tuplet {
    // Get the opening (n token
    const p = this.consume(TokenType.LEFTPAREN_NUMBER, "Expected tuplet marker", ParserErrorType.TUPLET);
    // Check for extended syntax with colons
    if (this.match(TokenType.COLON)) {
      const firstColon = this.previous();

      if (this.match(TokenType.NUMBER)) {
        // (p:q form
        const q = [firstColon, this.previous()];

        if (this.match(TokenType.COLON)) {
          const col = this.previous();
          if (this.match(TokenType.NUMBER)) {
            // (p:q:r form
            const r = [col, this.previous()];
            return new Tuplet(this.ctx, p, q, r);
          }
        }
        return new Tuplet(this.ctx, p, q);
      }

      if (this.match(TokenType.COLON)) {
        // (p:: form
        const q = [firstColon]; // First colon
        const r = [this.previous()]; // Second colon

        if (this.match(TokenType.NUMBER)) {
          // (p::2 form
          r.push(this.previous());
          return new Tuplet(this.ctx, p, q, r);
        }

        return new Tuplet(this.ctx, p, q, r);
      }

      // (p: form (just one colon)
      return new Tuplet(this.ctx, p, [firstColon]);
    }

    // Simple form (n - just the p token
    return new Tuplet(this.ctx, p);
  }

  /**
   * iterate the music code
   *
   * if find beamed notes (not WS-separated), create a beam.
   * For all the other tokens, keep them as is.
   */
  beam(music_code: Array<tune_body_code>) {
    let updatedMusicCode: Array<tune_body_code> = [];
    let beam: Array<Beam_contents> = [];

    for (let i = 0; i < music_code.length; i++) {
      /**
       * TODO rewrite using this.match()
       */
      if (foundBeam(music_code, i)) {
        while (!beamEnd(music_code, i) && i < music_code.length) {
          beam.push(music_code[i] as Beam_contents);
          i++;
        }
        if (isNote(music_code[i]) || isChord(music_code[i])) {
          beam.push(music_code[i] as Note);
          updatedMusicCode.push(new Beam(this.ctx, beam));
          beam = [];
        } else {
          updatedMusicCode.push(new Beam(this.ctx, beam));
          beam = [];
          if (i < music_code.length) {
            updatedMusicCode.push(music_code[i]);
          }
        }
      } else {
        updatedMusicCode.push(music_code[i]);
      }
    }
    return updatedMusicCode;
  }

  annotation() {
    return new Annotation(this.ctx, this.peek());
  }

  /**
  *
  * Writing down the rules as a grammar that resembles a regex:
  * ```
  * <colon>+(<barline>+(<WS>?<RBrkt>))?
  * <barline>+(<colon>+|(<WS>?(<RBrkt>|(<LBrkt><REPEAT_NUMBERS>))))?
  * <LBrkt>(<REPEAT_NUMBERS>|(<barline>(<colon>+)?)|<RBrkt>)
  ```
  */
  private parseBarLine(): BarLine {
    switch (this.peek().type) {
      case TokenType.COLON:
        return this.parseColonStart();
      case TokenType.BARLINE:
        return this.parseBarlineStart();
      case TokenType.LEFTBRKT:
        return this.parseLeftBracketStart();
      default:
        throw this.error(this.peek(), "Unexpected token in barline", ParserErrorType.TUNE_BODY);
    }
  }
  /**
   * Parse repeat numbers when current token is first number
   * Valid syntax:
   * - Single number: 1
   * - Number list: 1,2,3
   * - Range: 1-3
   * - Mixed: 1,3,5-7,9
   * - X notation: 1x2,3 or 1,2x2,3
   */
  private parseRepeatNumbers(): Token[] {
    const numbers: Token[] = [];
    // Must start with a number
    numbers.push(this.advance());
    while (!this.isAtEnd()) {
      if (this.match(TokenType.COMMA)) {
        // After comma must be number
        numbers.push(this.previous()); // Keep comma
        numbers.push(this.consume(TokenType.NUMBER, "Expected number after comma", ParserErrorType.REPEAT_NUMBER));
      } else if (this.match(TokenType.MINUS)) {
        // After dash must be number
        numbers.push(this.previous()); // Keep dash
        numbers.push(this.consume(TokenType.NUMBER, "Expected number after dash", ParserErrorType.REPEAT_NUMBER));
      } else if (this.match(TokenType.LETTER)) {
        // Handle x notation
        if (this.previous().lexeme !== "x") {
          throw this.error(this.previous(), "letters other than x not allowed in repeats", ParserErrorType.REPEAT_NUMBER);
        } else if (this.peek().type !== TokenType.NUMBER) {
          throw this.error(this.previous(), "letters other than x not allowed in repeats", ParserErrorType.REPEAT_NUMBER);
        } else {
          numbers.push(this.previous());
          numbers.push(this.advance());
        }
      }
    }
    return numbers;
  }

  /**
  * <LBrkt>(<REPEAT_NUMBERS>|(<barline>(<colon>+|RBrkt)?)|<RBrkt>)
  ```
  */
  private parseLeftBracketStart(): BarLine {
    const parts: Token[] = [];
    parts.push(this.advance()); // consume [

    // After [, expect either number, barline, or right bracket
    switch (this.peek().type) {
      case TokenType.NUMBER:
        // [1,2,3 etc
        const repeatNumbers = this.parseRepeatNumbers();
        return new BarLine(this.ctx, parts, repeatNumbers);
      case TokenType.BARLINE:
        // [| possibly followed by : or ]
        parts.push(this.advance()); // consume |
        if (this.peek().type === TokenType.COLON) {
          do {
            parts.push(this.previous());
          } while (this.match(TokenType.COLON));
        } else if (this.peek().type === TokenType.RIGHT_BRKT) {
          parts.push(this.advance());
        }
        return new BarLine(this.ctx, parts);
      default:
        return new BarLine(this.ctx, parts);
    }
  }

  /**
   * <barline>+(<colon>+|(<WS>?(<RBrkt>|(<LBrkt><REPEAT_NUMBERS>))))?
   */
  private parseBarlineStart(): BarLine {
    const parts: Array<Token> = [];
    // add initial barlines
    do {
      parts.push(this.advance());
    } while (this.match(TokenType.BARLINE));

    switch (this.peek().type) {
      case TokenType.NUMBER:
        const repeatNumbers = this.parseRepeatNumbers();
        return new BarLine(this.ctx, parts, repeatNumbers);
      case TokenType.COLON:
        do {
          parts.push(this.advance());
        } while (this.match(TokenType.COLON));
        return new BarLine(this.ctx, parts);
      case TokenType.LEFTBRKT:
        if (this.peekNext().type === TokenType.NUMBER) {
          parts.push(this.advance());
          const repeatNumbers = this.parseRepeatNumbers();
          return new BarLine(this.ctx, parts, repeatNumbers);
        } else {
          return new BarLine(this.ctx, parts);
        }
      case TokenType.RIGHT_BRKT:
        parts.push(this.advance());
        return new BarLine(this.ctx, parts);
      case TokenType.WHITESPACE:
        if (this.peekNext().type === TokenType.RIGHT_BRKT) {
          parts.push(this.advance());
          parts.push(this.advance());
          return new BarLine(this.ctx, parts);
          break;
        } else if (this.peekNext().type === TokenType.LEFTBRKT && this.tokens[this.current + 2].type === TokenType.NUMBER) {
          parts.push(this.advance());
          const repeatNumbers = this.parseRepeatNumbers();
          return new BarLine(this.ctx, parts);
        } else {
          return new BarLine(this.ctx, parts);
        }
      default:
        return new BarLine(this.ctx, parts);
    }
  }

  /**
  * <colon>+(<barline>+(<WS>?<RBrkt>))?
  ```
  */
  private parseColonStart(): BarLine {
    const parts: Token[] = [];

    // Consume one or more colons
    do {
      parts.push(this.advance()); // consume COLON
    } while (this.match(TokenType.COLON));

    // Optional barlines sequence with optional right bracket
    if (this.match(TokenType.BARLINE)) {
      do {
        parts.push(this.previous()); // add BARLINE
      } while (this.match(TokenType.BARLINE));

      // Optional whitespace and right bracket
      if (this.peek().type === TokenType.WHITESPACE && this.peekNext().type === TokenType.RIGHT_BRKT) {
        parts.push(this.previous());
        parts.push(this.previous());
      } else if (this.peekNext().type === TokenType.RIGHT_BRKT) {
        parts.push(this.previous());
      } else if (this.peek().type === TokenType.NUMBER) {
        // if the barline is followed by a number, then it's a repeat number
        const repeatNumbers = this.parseRepeatNumbers();
        return new BarLine(this.ctx, parts, repeatNumbers);
      }
    }
    return new BarLine(this.ctx, parts);
  }

  /**
   * Check if current token is part of a decoration sequence.
   * A decoration sequence is one or more decorations followed by a note, rest, or chord.
   * Valid decorations: ., ~, H, L, M, O, P, S, T, u, v, symbols (!xxx!)
   */
  private isDecoration(): boolean {
    let i = this.current;

    // First token must be a decoration
    if (!isDecorationToken(this.tokens[i])) {
      return false;
    }

    // Look ahead until we find a note/rest/chord or invalid token
    while (i < this.tokens.length) {
      const token = this.tokens[i];

      // Found target - success
      if (
        isNoteToken(token) ||
        hasRestAttributes(token) ||
        token.type === TokenType.LEFTBRKT ||
        (token.type === TokenType.LETTER && token.lexeme === "y")
      ) {
        return true;
      }

      // If not a decoration, string, or symbol, fail
      if (!isDecorationToken(token) && token.type !== TokenType.STRING && token.type !== TokenType.SYMBOL) {
        return false;
      }

      i++;
    }

    return false;
  }

  /**
   * Pretty awful.
   * Check if the voice line is already in nomenclature
   * else, peek at the next line - ignoring comment/stylesheet lines:
   * info lines => true
   * voice marker => true
   * music code => false
   * */
  private isVoicesLegend(voices: Array<string>) {
    let i = this.current + 1;
    let voice_tokens: Array<Token> = [];
    while (i < this.tokens.length && this.tokens[i].type !== TokenType.EOL) {
      voice_tokens.push(this.tokens[i]);
      i++;
    }

    const info_line = new Info_line(this.ctx, [this.tokens[this.current], ...voice_tokens]);
    const voice_legend = info_line.value[0].lexeme;
    if (voices.includes(voice_legend)) {
      return false;
    }
    // peek at the next line, ignoring comment/stylesheet lines
    while (i < this.tokens.length) {
      i++;
      const cur = this.tokens[i];
      if (cur.type === TokenType.COMMENT || cur.type === TokenType.STYLESHEET_DIRECTIVE) {
        if (this.tokens[i + 1].type === TokenType.EOL) {
          i++;
        }
        continue;
        // true if followed by another info line or a voice marker
      } else if (cur.type === TokenType.LETTER_COLON || cur.type === TokenType.EOF || this.isVoiceMarker(i)) {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  // returns the voice name of the voice marker, or null
  private isVoiceMarker(i: number): string | null {
    if (
      // fmt
      this.tokens[i].type === TokenType.LEFTBRKT &&
      this.tokens[i + 1].type === TokenType.LETTER_COLON &&
      this.tokens[i + 1].lexeme === "V:"
    ) {
      let tokens: Array<Token> = [];
      i = i++;
      while (i < this.tokens.length && this.tokens[i].type !== TokenType.EOL && this.tokens[i].type !== TokenType.RIGHT_BRKT) {
        i++;
        tokens.push(this.peek());
      }
      return tokens
        .map((t) => t.lexeme)
        .join("")
        .trim();
    }
    return null;
  }

  chord() {
    // parse a chord
    // a left bracket followed by
    // string
    // or notes
    // followed by a right bracket
    // optionally followed by a rhythm
    const chordContents: Array<Note | Annotation> = [];
    let chordRhythm: Rhythm | undefined = undefined;
    let chordTie: Token | undefined = undefined;
    const leftBracket = this.advance();

    try {
      while (!this.isAtEnd() && !(this.peek().type === TokenType.RIGHT_BRKT)) {
        // parse string
        // or parse a note
        if (this.peek().type === TokenType.STRING) {
          chordContents.push(this.annotation());
          //chordContents.push(this.peek())
          this.advance();
        } else {
          chordContents.push(this.parse_note());
        }
      }
      //consume the right bracket
      this.consume(this.peek().type, "Expected a right bracket", ParserErrorType.CHORD);
      // optionally parse a rhythm
      if (isRhythmToken(this.peek())) {
        chordRhythm = this.rhythm();
      }
    } catch (e) {
      // if note/rhythm/finding right bracket fails, treat all the other tokens as errs.
      const reTokenizer = new TokensVisitor(this.ctx);

      chordContents.forEach((element) => (isNote(element) ? reTokenizer.visitNoteExpr(element) : reTokenizer.visitAnnotationExpr(element)));
      this.err_tokens.push(leftBracket, ...reTokenizer.tokens);
      throw e;
    }
    if (!this.isAtEnd() && this.peek().type === TokenType.MINUS) {
      chordTie = this.peek();
      this.advance();
    }

    return new Chord(this.ctx, chordContents, chordRhythm, chordTie);
  }
  inline_field() {
    // inline field is a left bracket followed by a letter followed by a colon
    // followed by any text followed by a right bracket
    const leftBracket = this.peek();
    this.advance();
    const field = this.peek();
    this.advance();
    const text: Array<Token> = [];
    while (!this.isAtEnd() && this.peek().type !== TokenType.RIGHT_BRKT) {
      text.push(this.peek());
      this.advance();
    }
    // consume the right bracket
    this.consume(this.peek().type, "Expected a right bracket", ParserErrorType.INLINE_FIELD);
    return new Inline_field(this.ctx, field, text);
  }
  grace_group() {
    // parse a grace group
    // starts with a left brace
    // optionally followed by a slash
    // followed by a multiple pitch
    // followed by a right brace
    let isAccaciatura = false;
    let notes: Array<Note> = [];
    this.advance();
    if (!this.isAtEnd() && this.peek().type === TokenType.SLASH) {
      isAccaciatura = true;
      this.advance();
    }
    while (!this.isAtEnd() && this.peek().type !== TokenType.RIGHT_BRACE) {
      try {
        const note = this.parse_note();
        notes.push(note);
      } catch (e) {
        // if one of the notes fails, treat all the others as errs as well
        const reTokenizer = new TokensVisitor(this.ctx);
        notes.forEach((element) => {
          reTokenizer.visitNoteExpr(element);
        });
        this.err_tokens.push(...reTokenizer.tokens);
        throw e;
      }
    }
    this.consume(TokenType.RIGHT_BRACE, "expected a right brace", ParserErrorType.GRACE_GROUP);
    // TODO include beam in grace group
    return new Grace_group(this.ctx, notes, isAccaciatura);
  }
  private symbol() {
    const symbol = this.peek();
    this.advance();
    return new Symbol(this.ctx, symbol);
  }

  /**
   * @throws {Error}
   */
  private parse_note() {
    // pitch or rest, optionnally followed by a rhythm
    type noteType = {
      pitchOrRest: Pitch | Rest;
      rhythm?: Rhythm;
      tie?: Token;
    };
    let note = <noteType>{};
    const pkd = this.peek();
    if (
      pkd.type === TokenType.SHARP ||
      pkd.type === TokenType.FLAT ||
      pkd.type === TokenType.SHARP_DBL ||
      pkd.type === TokenType.FLAT_DBL ||
      pkd.type === TokenType.SHARP_HALF ||
      pkd.type === TokenType.FLAT_HALF ||
      pkd.type === TokenType.NATURAL ||
      pkd.type === TokenType.NOTE_LETTER
    ) {
      note = { pitchOrRest: this.pitch() };
    } else if (isRestToken(this.peek())) {
      note = { pitchOrRest: this.rest() };
    } else {
      throw this.error(this.peek(), "Unexpected token in note", ParserErrorType.NOTE);
    }

    if (!this.isAtEnd() && isRhythmToken(this.peek())) {
      try {
        note.rhythm = this.rhythm();
      } catch (e) {
        // If rhythm fails, treate note’s tokens as an err.
        const reTokenizer = new TokensVisitor(this.ctx);
        reTokenizer.visitNoteExpr(new Note(this.ctx, note.pitchOrRest, undefined, undefined));
        this.err_tokens.push(...reTokenizer.tokens);
        throw e;
      }
    }
    if (!this.isAtEnd() && this.peek().type === TokenType.MINUS) {
      note.tie = this.peek();
      this.advance();
    }
    return new Note(this.ctx, note.pitchOrRest, note.rhythm, note.tie);
  }

  /**
   * @throws {Error}
   */
  private rest() {
    let rest: Token;

    if (isRestToken(this.peek())) {
      rest = this.peek();
      this.advance();
    } else {
      throw this.error(this.peek(), "Unexpected token in rest", ParserErrorType.REST);
    }
    return new Rest(this.ctx, rest);
  }

  /**
   * @throws {Error}
   */
  private multiMeasureRest() {
    let rest: Token;
    let length: Token;
    if (isMultiMesureRestToken(this.peek())) {
      rest = this.peek();
      this.advance();
    } else {
      throw this.error(this.peek(), "Unexpected token in multi measure rest", ParserErrorType.MULTI_MEASURE_REST);
    }
    if (this.peek().type === TokenType.NUMBER) {
      length = this.peek();
      this.advance();
      return new MultiMeasureRest(this.ctx, rest, length || undefined);
    }
    return new MultiMeasureRest(this.ctx, rest);
  }

  /**
   * @throws {Error}
   */
  private rhythm() {
    let numerator: Token | null = null;
    let separator: Token | undefined = undefined;
    let denominator: Token | null | undefined = undefined;
    let broken: Token | null = null;

    // slash optionnally followed by a number
    if (this.peek().type === TokenType.SLASH) {
      if (this.peekNext().type === TokenType.NUMBER) {
        separator = this.peek();
        denominator = this.peekNext();
        this.advance();
        this.advance();
        //return new Rhythm(null, slash, number)
      } else {
        separator = this.peek();
        this.advance();
        //return new Rhythm(null, this.previous())
      }
      // number optionnally followed by a ( slash|greater|less ) and a number
    } else if (this.peek().type === TokenType.NUMBER) {
      numerator = this.peek();
      this.advance();
      if (this.peek().type === TokenType.SLASH) {
        if (this.peekNext().type === TokenType.NUMBER) {
          separator = this.peek();
          denominator = this.peekNext();
          //const rhythm = new Rhythm(firstNum, this.peek(), this.peekNext())
          this.advance();
          this.advance();
          //return rhythm
        } else {
          separator = this.peek();
          //const rhythm = new Rhythm(firstNum, this.peek())
          this.advance();
          //return rhythm
        }
      } /* else {
        //this.advance()
        return new Rhythm(firstNum)
      } */
      // broken rhythm
    } else if (!(this.peek().type === TokenType.GREATER || this.peek().type === TokenType.LESS)) {
      throw this.error(this.peek(), "Unexpected token in rhythm", ParserErrorType.RHYTHM);
    }

    if (this.peek().type === TokenType.GREATER || this.peek().type === TokenType.LESS) {
      broken = this.peek();
      this.advance();
      //return new Rhythm(null, this.previous())
    }
    return new Rhythm(this.ctx, numerator, separator, denominator, broken);
  }

  private comment_line() {
    let comment = "";
    let token = this.peek();
    while (!this.isAtEnd()) {
      if (this.peek().type === TokenType.EOL) {
        break;
      } else {
        comment += this.peek().lexeme;
        this.advance();
      }
    }
    token.lexeme = comment;
    return new Comment(this.ctx, comment, token);
  }
  // TODO integrate in the file structure
  private lyric_section() {
    const lyric_section = [];
    while (!this.isAtEnd() && this.peek().type === TokenType.LETTER_COLON && this.peekNext().lexeme === "W:") {
      lyric_section.push(this.info_line());
    }
    return new Lyric_section(this.ctx, lyric_section);
  }

  /**
   * @throws {Error}
   */
  private pitch() {
    let alteration, noteLetter, octave;
    if (
      this.match(TokenType.SHARP, TokenType.SHARP_DBL, TokenType.FLAT, TokenType.FLAT_DBL, TokenType.NATURAL, TokenType.SHARP_HALF, TokenType.FLAT_HALF)
    ) {
      //new Alteration
      alteration = this.previous();
    }
    if (this.match(TokenType.NOTE_LETTER)) {
      //new NoteLetter
      noteLetter = this.previous();
    } else {
      throw this.error(this.peek(), "Expected a note letter", ParserErrorType.PITCH);
    }
    if (this.match(TokenType.COMMA, TokenType.APOSTROPHE)) {
      octave = this.previous();
    }
    return new Pitch(this.ctx, { alteration, noteLetter, octave });
  }

  /**
   * @throws {Error}
   */
  private consume(type: TokenType, message: string, errorType: ParserErrorType): Token {
    if (this.check(type)) {
      return this.advance();
    }
    throw this.error(this.peek(), message, errorType);
  }

  private error(token: Token, message: string, origin: ParserErrorType): Error {
    return new Error(this.ctx.errorReporter.parserError(token, message, origin));
  }

  private match(...types: Array<TokenType>): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  private check(type: TokenType) {
    if (this.isAtEnd()) {
      return false;
    }
    return this.peek().type === type;
  }
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
  private peek(): Token {
    return this.tokens[this.current];
  }
  private peekNext(): Token {
    return this.tokens[this.current + 1];
  }
  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private handleError(token: Token, message: string, origin: ParserErrorType): ErrorExpr {
    // const token = this.peek();
    // Log the error but don't throw

    // Collect tokens until we reach a synchronization point

    while (!this.isAtEnd() && !this.isRecoveryPoint()) {
      this.err_tokens.push(this.advance());
    }

    const errorExpr = new ErrorExpr(this.ctx, this.err_tokens, undefined, message);
    this.err_tokens = [];
    return errorExpr;
  }

  // Helper to identify recovery points
  private isRecoveryPoint(): boolean {
    const type = this.peek().type;
    return (
      type === TokenType.EOL ||
      type === TokenType.BARLINE ||
      // type === TokenType.BAR_COLON || // |:
      // type === TokenType.BAR_DBL || // ||
      // type === TokenType.BAR_DIGIT || // |1
      // type === TokenType.BAR_RIGHTBRKT || // |]
      // type === TokenType.COLON_BAR || // :|
      // type === TokenType.COLON_BAR_DIGIT || // :|1
      false
    );
  }
}
