import { beamEnd, foundBeam, hasRestAttributes, isChord, isDecorationToken, isMultiMesureRestToken, isNote, isNoteToken, isRestToken, isRhythmToken, isTupletToken } from "../helpers";
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
  Nth_repeat,
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
  tune_body_code
} from "../types/Expr";
import { Token } from "../types/token";
import { ParserErrorType, TokenType } from "../types/types";
import { AbcErrorReporter } from "./ErrorReporter";
import { VoiceParser } from "./Voices";

export class Parser {
  private tokens: Array<Token>;
  private current = 0;
  private source = "";
  private errorReporter: AbcErrorReporter;
  private AST: File_structure | null = null;
  constructor(tokens: Array<Token>, source?: string, errorReporter?: AbcErrorReporter) {
    this.tokens = tokens;
    if (source) {
      this.source = source;
    }
    if (errorReporter) {
      this.errorReporter = errorReporter;
    } else {
      this.errorReporter = new AbcErrorReporter();
    }
  }
  hasErrors = () => this.errorReporter.hasErrors();
  resetErrors = () => this.errorReporter.resetErrors();
  getErrors = () => this.errorReporter.getErrors();

  parse() {
    try {
      const AST = this.file_structure();
      this.AST = AST;
      return AST;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  }


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
    return new File_structure(file_header, tunes);
  }

  private file_header() {
    //collect a multiline string
    //until finding two line breaks in a row
    let header_text = "";
    let tokens: Token[] = [];
    while (!this.isAtEnd()) {
      if (
        this.peek().type === TokenType.EOL &&
        this.peekNext().type === TokenType.EOL
      ) {
        this.consume(TokenType.EOL, "Expected a line break");
        this.consume(TokenType.EOL, "Expected a line break");
      } else if (this.peek().lexeme === "X:") {
        break;
      } else {
        tokens.push(this.peek());
        header_text += this.peek().lexeme;
        this.advance();
      }
    }
    return new File_header(header_text, tokens);
  }
  private tune() {
    // parse a tune header
    // then try to parse a tune body
    // unless the header is followed by a line break
    const tune_header = this.tune_header();
    if (
      this.peek().type === TokenType.EOL ||
      this.peek().type === TokenType.EOF
    ) {
      return new Tune(tune_header);
    } else {
      const tune_body = this.tune_body(tune_header.voices);
      return new Tune(tune_header, tune_body);
    }
  }

  private tune_header() {
    const info_lines = [];
    const voices = [];
    while (!this.isAtEnd()) {
      if (this.peek().type === TokenType.LETTER_COLON) {
        /**
         * read the info line: if it's a VOICE line (V: key)
         * then stringify the tokens in the value, and add to the array of voice names.
         */
        //find whether this is the voices legend or the actual start of the tune_body.
        if (this.peek().lexeme === "V:" && !this.isVoicesLegend() && !voices.length) {
          return new Tune_header(info_lines, voices);
        }
        const line = this.info_line();
        if (line.key.lexeme === "V:") {
          /**
           * trim the space in the value line, and remove any trailing comments after the legend
           */
          const legend = line.value.map(token => token.lexeme).join("").trim().replace(/\s.*/, "");
          voices.push(legend);
        }
        info_lines.push(line);
      } else if (this.peek().type === TokenType.COMMENT
        || this.peek().type === TokenType.STYLESHEET_DIRECTIVE
      ) {
        info_lines.push(this.comment_line());
      } else if (
        this.peek().type === TokenType.EOL &&
        (this.peekNext().type === TokenType.LETTER_COLON
          || this.peekNext().type === TokenType.COMMENT
          || this.peekNext().type === TokenType.STYLESHEET_DIRECTIVE
        )
      ) {
        this.advance();
      } else {
        break;
      }
    }
    this.advance();
    return new Tune_header(info_lines, voices);
  }

  private info_line() {
    const info_line = [];
    while (!this.isAtEnd()) {
      if (
        (this.peek().type === TokenType.EOL &&
          !(this.peekNext().type === TokenType.PLUS_COLON)) || this.peek().type === TokenType.COMMENT
      ) {
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
    return new Info_line(info_line);
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
        } else if (
          !(
            this.peek().type === TokenType.EOL &&
            this.peekNext().type === TokenType.EOL
          )
        ) {
          elements = elements.concat(this.music_content().contents);
        } else if (this.peek().type === TokenType.EOL) {
          break;
        }
      } catch (err: any) {
        console.error(err.message);
        this.synchronize();
      }
    }

    const elements_with_beams = this.beam(elements);
    const systems = new VoiceParser(elements_with_beams, voices).parse();
    return new Tune_Body(systems);
  }

  private music_content() {
    const contents: Array<
      | Token
      | YSPACER
      | BarLine
      | Decoration
      | Annotation
      | Note
      | Grace_group
      | Nth_repeat
      | Inline_field
      | Chord
      | Symbol
      | MultiMeasureRest
      | Beam
      | Tuplet
    > = [];
    const curTokn = this.peek();

    switch (curTokn.type) {
      case TokenType.EOL:
      case TokenType.DOLLAR:
      case TokenType.RESERVED_CHAR:
      case TokenType.WHITESPACE:
      case TokenType.ANTISLASH_EOL:
        contents.push(curTokn);
        this.advance();
        break;
      case TokenType.ESCAPED_CHAR:
        this.errorReporter.parserWarning(curTokn, "Escaped characters don't get evaluated as music.", ParserErrorType.TUNE_BODY);
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
      case TokenType.BARLINE:
      case TokenType.BAR_COLON:
      case TokenType.BAR_DBL:
      case TokenType.BAR_RIGHTBRKT:
      case TokenType.COLON_BAR:
      case TokenType.COLON_DBL:
      case TokenType.LEFTBRKT_BAR:
        contents.push(this.barline());
        this.advance();
        break;
      case TokenType.STRING:
        contents.push(this.annotation());
        this.advance();
        break;
      case TokenType.DOT:
      case TokenType.TILDE:
        // parse the note following the dot
        // and add the dot to the note
        if (this.isDecoration()) {
          contents.push(new Decoration(curTokn));
          this.advance();
        } else {
          throw this.error(
            this.peek(),
            "Unexpected token: " +
            curTokn.lexeme +
            "\nline " +
            curTokn.line +
            "\n decorations should be followed by a note"
            , ParserErrorType.TUNE_BODY);
        }
        break;
      case TokenType.FLAT:
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
      case TokenType.BAR_DIGIT:
      case TokenType.COLON_BAR_DIGIT:
      case TokenType.LEFTBRKT_NUMBER:
        // TODO accomodate cases of
        // nth repeat containing a barline
        // parse a nth repeat
        const nthRepeat = this.nth_repeat();
        if (nthRepeat.length === 2) {
          contents.push(nthRepeat[0]);
          contents.push(nthRepeat[1]);
        } else if (nthRepeat.length === 1) {
          contents.push(nthRepeat[0]);
        }
        break;
      case TokenType.LEFTBRKT:
        if (this.peekNext().type === TokenType.LETTER_COLON) {
          contents.push(this.inline_field());
        } else {
          contents.push(this.chord());
        }
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
        if (this.isTuplet()) {
          contents.push(this.tuplet());
        } else {
          throw this.error(curTokn, "Tuplet markers should be followed by a note", ParserErrorType.TUNE_BODY);
        }
        break;
      case TokenType.SYMBOL:
        contents.push(this.symbol());
        break;
      case TokenType.LETTER:
        if (curTokn.lexeme === "y") {
          contents.push(
            new YSPACER(
              curTokn,
              this.peekNext().type === TokenType.NUMBER
                ? this.peekNext()
                : undefined
            )
          );
          this.advance();
          if (this.peek().type === TokenType.NUMBER) {
            this.advance();
          }
        } else if (this.isDecoration()) {
          contents.push(new Decoration(curTokn));
          this.advance();
        } else if (isMultiMesureRestToken(this.peek())) {
          contents.push(this.multiMeasureRest());
        } else if (isRestToken(this.peek())) {
          contents.push(this.parse_note());
        } else {
          throw this.error(curTokn, "Unexpected token after letter", ParserErrorType.TUNE_BODY);
        }
        break;
      default:
        throw this.error(curTokn, "Unexpected token in music code", ParserErrorType.TUNE_BODY);
    }

    return new Music_code(contents);
  }
  voice_overlay(ampersands: Token[]): Voice_overlay {
    return new Voice_overlay(ampersands);
  }
  tuplet() {
    // implement more strictly the possible contents of the tuplet
    // which is a leftparen_number followed by
    /**
     * find end of expression
     * (leftparen_number, :[0-9], :[0-9]
     * opt WS
     * NOTE
     *
COLON NUMBER (opt *2)
COLON_DBL NUMBER
     */
    let p: Token;
    let q: Token | undefined = undefined;
    let r: Token | undefined = undefined;
    // find if followed by note
    p = this.peek();
    this.advance();
    /**
     * TODO rewrite using this.match()
     */
    if (this.peek().type === TokenType.COLON_DBL) {
      q = new Token(TokenType.COLON, ":", null, p.line, this.peek().position);
      r = new Token(TokenType.COLON, ":", null, p.line, this.peek().position + 1);
      this.advance();
    } else {
      /** either it will be a COLON_NUMBER once or TWICE */
      if (this.peek().type === TokenType.COLON_NUMBER) {
        q = this.peek();
        this.advance();
      }
      /**second time */
      if (this.peek().type === TokenType.COLON_NUMBER) {
        q = this.peek();
        this.advance();
      }
    }
    return new Tuplet(p, q, r);
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
          updatedMusicCode.push(new Beam(beam));
          beam = [];
        } else {
          updatedMusicCode.push(new Beam(beam));
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

  barline() {
    return new BarLine(this.peek());
  }
  annotation() {
    return new Annotation(this.peek());
  }
  nth_repeat() {
    // some nth repeat tokens
    // contain the bar line
    // and the repeat number
    // it's necessary to separate them.
    const pkd = this.peek();
    if (
      pkd.type === TokenType.BAR_DIGIT ||
      pkd.type === TokenType.COLON_BAR_DIGIT
    ) {
      // create a bar token
      // and a number token
      if (pkd.type === TokenType.BAR_DIGIT) {
        // TODO: move this to the tokenizer
        const barToken = new Token(
          TokenType.BARLINE,
          "|",
          null,
          pkd.line,
          pkd.position
        );
        const numberToken = new Token(
          TokenType.NUMBER,
          pkd.lexeme.substring(1),
          null,
          pkd.line,
          pkd.position + 1
        );
        this.advance();
        return [new BarLine(barToken), new Nth_repeat(numberToken)];
        // create a COLON_BAR token
        // and a number token
      } else {
        const barToken = new Token(
          TokenType.COLON_BAR,
          ":|",
          null,
          pkd.line,
          pkd.position
        );
        const numberToken = new Token(
          TokenType.NUMBER,
          pkd.lexeme.substring(2),
          null,
          pkd.line,
          pkd.position + 2
        );
        this.advance();
        return [new BarLine(barToken), new Nth_repeat(numberToken)];
      }
    } else {
      this.advance();
      return [new Nth_repeat(this.previous())];
    }
  }
  private isDecoration() {
    const pkd = this.peek();
    const lexeme = pkd.lexeme;
    const type = this.peek().type;
    const nxtType = this.peekNext();
    if (
      isDecorationToken(pkd) &&
      (isNoteToken(nxtType) ||
        hasRestAttributes(nxtType))
    ) {
      return true;
    } else if (
      type === TokenType.DOT ||
      type === TokenType.TILDE ||
      (type === TokenType.LETTER && /[HLMOPSTuv]/.test(lexeme))
    ) {
      let i = this.current;
      while (i < this.tokens.length) {
        i++;
        const cur = this.tokens[i];
        if (!isDecorationToken(cur)
          && !isNoteToken(cur)
          && !hasRestAttributes(cur)) {
          return false;
        } else if (isNoteToken(cur)) {
          return true;
        }
      }
      return false;
    }
    else {
      return false;
    }
  }

  /**
   * parse all tokens entil EOL.
   * Then, if the next line is a voice, return true
   * 
   * if it's a comment, skip it and continue 
   * 
   * if it's an info line, return true
   * 
   * else return false
   * */
  private isVoicesLegend() {
    let i = this.current;
    while (i < this.tokens.length && this.tokens[i].type !== TokenType.EOL) {
      i++;
    }
    while (i < this.tokens.length) {
      i++;
      const cur = this.tokens[i];
      if (cur.type === TokenType.COMMENT || cur.type === TokenType.STYLESHEET_DIRECTIVE) {
        continue;
      } else if (cur.type === TokenType.LETTER_COLON) {
        return true;
      } else if (cur.type === TokenType.EOF) {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }
  private isTuplet() {
    /**
     * start at next token
     * if is anything other than a note token, a decoration, or a ws,
     * or <annotations> or <decorations>
     * or colondouble followed by number
    */
    let i = this.current;
    while (i < this.tokens.length) {
      i++;
      const cur = this.tokens[i];

      /**
       * TODO rewrite using this.match()
       */
      if (!isDecorationToken(cur)
        && !isNoteToken(cur)
        && !isTupletToken(cur)
        && (cur.type !== TokenType.STRING && cur.lexeme !== "\"")
        && cur.type !== TokenType.WHITESPACE
        && cur.type !== TokenType.COLON_DBL
        && cur.type !== TokenType.NUMBER
      ) {
        return false;
      } else if (isNoteToken(cur)) {
        return true;
      }
    }
    return false;
  }
  chord() {
    // parse a chord
    // a left bracket followed by
    // string
    // or notes
    // followed by a right bracket
    // optionally followed by a rhythm
    const chordContents = [];
    let chordRhythm: Rhythm | undefined = undefined;
    let chordTie: Token | undefined = undefined;
    const leftBracket = this.peek();
    this.advance();
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
    this.consume(this.peek().type, "Expected a right bracket");
    // optionally parse a rhythm
    if (isRhythmToken(this.peek())) {
      chordRhythm = this.rhythm();
    }
    if (!this.isAtEnd() && this.peek().type === TokenType.MINUS) {
      chordTie = this.peek();
      this.advance();
    }

    return new Chord(chordContents, chordRhythm, chordTie);
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
    this.consume(this.peek().type, "Expected a right bracket");
    return new Inline_field(field, text);
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
      notes.push(this.parse_note());
    }
    this.consume(TokenType.RIGHT_BRACE, "expected a right brace");
    // TODO include beam in grace group
    return new Grace_group(notes, isAccaciatura);
  }
  private symbol() {
    const symbol = this.peek();
    this.advance();
    return new Symbol(symbol);
  }
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
      pkd.type === TokenType.NATURAL
    ) {
      note = { pitchOrRest: this.pitch() };
    } else if (this.peek().type === TokenType.NOTE_LETTER) {
      note = { pitchOrRest: this.pitch() };
    } else if (isRestToken(this.peek())) {
      note = { pitchOrRest: this.rest() };
    } else {
      throw this.error(this.peek(), "Unexpected token in note", ParserErrorType.TUNE_BODY);
    }

    if (!this.isAtEnd() && isRhythmToken(this.peek())) {
      note.rhythm = this.rhythm();
    }
    if (!this.isAtEnd() && this.peek().type === TokenType.MINUS) {
      note.tie = this.peek();
      this.advance();
    }
    return new Note(note.pitchOrRest, note.rhythm, note.tie);
  }

  private rest() {
    let rest: Token;

    if (isRestToken(this.peek())) {
      rest = this.peek();
      this.advance();
    } else {
      throw this.error(this.peek(), "Unexpected token in rest", ParserErrorType.TUNE_BODY);
    }
    return new Rest(rest);
  }

  private multiMeasureRest() {
    let rest: Token;
    let length: Token;
    if (isMultiMesureRestToken(this.peek())) {
      rest = this.peek();
      this.advance();
    } else {
      throw this.error(this.peek(), "Unexpected token in multi measure rest", ParserErrorType.TUNE_BODY);
    }
    if (this.peek().type === TokenType.NUMBER) {
      length = this.peek();
      this.advance();
      return new MultiMeasureRest(rest, length || undefined);
    }
    return new MultiMeasureRest(rest);
  }

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
    } else if (!(
      this.peek().type === TokenType.GREATER ||
      this.peek().type === TokenType.LESS
    )) {
      throw this.error(this.peek(), "Unexpected token in rhythm", ParserErrorType.TUNE_BODY);
    }

    if (
      this.peek().type === TokenType.GREATER ||
      this.peek().type === TokenType.LESS
    ) {
      broken = this.peek();
      this.advance();
      //return new Rhythm(null, this.previous())
    }
    return new Rhythm(numerator, separator, denominator, broken);
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
    return new Comment(comment, token);
  }
  // TODO integrate in the file structure
  private lyric_section() {
    const lyric_section = [];
    while (
      !this.isAtEnd() &&
      this.peek().type === TokenType.LETTER_COLON &&
      this.peekNext().lexeme === "W:"
    ) {
      lyric_section.push(this.info_line());
    }
    return new Lyric_section(lyric_section);
  }

  private pitch() {
    let alteration, noteLetter, octave;
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
      alteration = this.previous();
    }
    if (this.match(TokenType.NOTE_LETTER)) {
      //new NoteLetter
      noteLetter = this.previous();
    } else {
      throw this.error(this.peek(), "Expected a note letter", ParserErrorType.TUNE_BODY);
    }
    if (this.match(TokenType.COMMA, TokenType.APOSTROPHE)) {
      octave = this.previous();
    }
    return new Pitch({ alteration, noteLetter, octave });
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    throw this.error(this.peek(), message, ParserErrorType.UNKNOWN);
  }

  private error(token: Token, message: string, origin: ParserErrorType): Error {
    let errMsg: string;
    // get the currentline
    if (this.source) {
      const curLin = this.source.substring(0).split("\n")[token.line]; //TODO double check now that lines are 0-indexed
      const position = token.position >= 0 ? token.position : 0;
      const test = `${curLin}\n${" ".repeat(position)}^\n${" ".repeat(position)}${message}\n`;
      // add a caret under the token
      //const caret = " ".repeat(token.position) + "^"
      errMsg = this.errorReporter.parserError(token, "\n" + test, origin);
    } else {
      errMsg = this.errorReporter.parserError(token, message, origin);
    }

    return new Error(errMsg);
  }

  private synchronize() {
    this.advance();
    while (!this.isAtEnd()) {
      if (
        this.previous().type === TokenType.EOL ||
        this.previous().type === TokenType.BARLINE ||
        this.previous().type === TokenType.BAR_COLON || // |:
        this.previous().type === TokenType.BAR_DBL || // ||
        this.previous().type === TokenType.BAR_DIGIT || // |1
        this.previous().type === TokenType.BAR_RIGHTBRKT || // |]
        this.previous().type === TokenType.COLON_BAR || // :|
        this.previous().type === TokenType.COLON_BAR_DIGIT // :|1
      ) {
        return;
      }
      this.advance();
    }
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
}
