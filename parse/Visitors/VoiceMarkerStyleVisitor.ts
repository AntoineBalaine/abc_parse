import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import {
  Info_line,
  Inline_field,
  System,
  Tune_Body,
  VoiceMarkerStyle,
  tune_body_code,
} from "../types/Expr2";
import { cloneToken, isInfo_line, isInline_field, isToken } from "../helpers";

/**
 * Visitor that transforms voice markers between inline ([V:1]) and infoline (V:1) forms.
 *
 * This visitor operates on the Tune_Body AST and transforms voice markers based on
 * the target style. It does not implement the full Visitor interface because it only
 * needs to transform specific parts of the AST (tune body systems).
 *
 * Systems contain individual elements directly (Token, Info_line, Note, Inline_field, etc.),
 * not wrapped in Music_code containers.
 */
export class VoiceMarkerStyleVisitor {
  ctx: ABCContext;
  targetStyle: VoiceMarkerStyle;

  constructor(ctx: ABCContext, targetStyle: VoiceMarkerStyle) {
    this.ctx = ctx;
    this.targetStyle = targetStyle;
  }

  /**
   * Transform voice markers in the tune body based on the target style.
   * Returns a new Tune_Body with transformed systems.
   *
   * When converting to inline, we also need to merge systems because a V: info line
   * on its own line becomes its own system. After conversion, we need to merge the
   * inline voice marker with the following music content.
   */
  transformTuneBody(tuneBody: Tune_Body): Tune_Body {
    if (this.targetStyle === "inline") {
      return this.transformToInline(tuneBody);
    } else {
      return this.transformToInfoline(tuneBody);
    }
  }

  /**
   * Transform voice markers to inline form and merge systems as needed.
   *
   * When a system contains only a voice marker (and whitespace/EOL), we merge it
   * with the following system so the inline field appears at the start of the music line.
   */
  transformToInline(tuneBody: Tune_Body): Tune_Body {
    const transformedSystems: System[] = [];
    let pendingInlineFields: Array<Inline_field | Token> = [];

    for (const system of tuneBody.sequence) {
      const transformed = this.convertInfoLinesToInline(system);

      // Check if this system contains only voice markers and whitespace
      const isVoiceOnlySystem = this.isVoiceMarkerOnlySystem(transformed);

      if (isVoiceOnlySystem) {
        // Collect the inline fields to prepend to the next system
        for (const elem of transformed) {
          if (this.isVoiceInlineField(elem) || (isToken(elem) && elem.type === TT.WS)) {
            pendingInlineFields.push(elem as Inline_field | Token);
          }
        }
      } else {
        // This system has music content, prepend any pending inline fields
        if (pendingInlineFields.length > 0) {
          const merged: System = [...pendingInlineFields, ...transformed];
          transformedSystems.push(merged);
          pendingInlineFields = [];
        } else {
          transformedSystems.push(transformed);
        }
      }
    }

    // If there are leftover pending inline fields (no following music), keep them as a system
    if (pendingInlineFields.length > 0) {
      transformedSystems.push(pendingInlineFields as System);
    }

    return new Tune_Body(this.ctx.generateId(), transformedSystems, tuneBody.voices);
  }

  /**
   * Transform voice markers to infoline form.
   * No system merging needed because info lines naturally occupy their own lines.
   */
  transformToInfoline(tuneBody: Tune_Body): Tune_Body {
    const transformedSystems = tuneBody.sequence.map((system) => this.convertInlineToInfoLines(system));
    return new Tune_Body(this.ctx.generateId(), transformedSystems, tuneBody.voices);
  }

  /**
   * Check if a system contains only voice markers and whitespace/EOL tokens.
   */
  isVoiceMarkerOnlySystem(system: System): boolean {
    for (const elem of system) {
      // Skip voice inline fields and whitespace tokens
      if (this.isVoiceInlineField(elem)) continue;
      if (isToken(elem) && (elem.type === TT.WS || elem.type === TT.EOL)) continue;
      // Found something else (note, bar, etc.) - not a voice-only system
      return false;
    }
    return system.length > 0;
  }

  /**
   * Transform voice markers in a single system.
   */
  transformSystem(system: System): System {
    if (this.targetStyle === "inline") {
      return this.convertInfoLinesToInline(system);
    } else {
      return this.convertInlineToInfoLines(system);
    }
  }

  /**
   * Convert V: info lines to [V:] inline fields.
   *
   * Input structure: [Info_line(V:1), EOL, Note, Note, ...]
   * Output structure: [Inline_field(V:1), WS, Note, Note, ...]
   *
   * The EOL token following the V: info line is removed because the info line
   * is replaced by an inline field that stays on the same line as the following content.
   */
  convertInfoLinesToInline(system: System): System {
    const result: System = [];
    let i = 0;

    while (i < system.length) {
      const element = system[i];

      // Check if this is a V: info line
      if (this.isVoiceInfoLine(element)) {
        const inlineField = this.createInlineFieldFromInfoLine(element);
        result.push(inlineField);

        // Add a space after the inline field
        const wsToken = this.createWSToken();
        result.push(wsToken);

        i++;

        // Because we're inlining the voice marker, we skip any following EOL tokens
        while (i < system.length && this.isEOLToken(system[i])) {
          i++;
        }
      } else {
        // Not a voice info line, keep as-is
        result.push(element);
        i++;
      }
    }

    return result;
  }

  /**
   * Convert [V:] inline fields to V: info lines.
   *
   * Input structure: [Inline_field(V:1), WS, Note, Note, ...]
   * Output structure: [Info_line(V:1), EOL, Note, Note, ...]
   *
   * An EOL token is inserted after the newly created info line.
   */
  convertInlineToInfoLines(system: System): System {
    const result: System = [];
    let i = 0;

    while (i < system.length) {
      const element = system[i];

      // Check if this is a V: inline field
      if (this.isVoiceInlineField(element)) {
        const infoLine = this.createInfoLineFromInlineField(element);
        result.push(infoLine);

        // Add an EOL after the info line
        const eolToken = this.createEOLToken();
        result.push(eolToken);

        i++;

        // Because we're moving the inline field to its own line, we skip any following WS tokens
        while (i < system.length && this.isWSToken(system[i])) {
          i++;
        }
      } else {
        // Not a voice inline field, keep as-is
        result.push(element);
        i++;
      }
    }

    return result;
  }

  // ============================================================================
  // Type Guards
  // ============================================================================

  isVoiceInfoLine(node: tune_body_code): node is Info_line {
    return isInfo_line(node) && node.key.lexeme === "V:";
  }

  isVoiceInlineField(node: tune_body_code): node is Inline_field {
    return isInline_field(node) && node.field.lexeme === "V:";
  }

  isEOLToken(node: tune_body_code): boolean {
    return isToken(node) && node.type === TT.EOL;
  }

  isWSToken(node: tune_body_code): boolean {
    return isToken(node) && node.type === TT.WS;
  }

  // ============================================================================
  // Node Creation Helpers
  // ============================================================================

  /**
   * Create an Inline_field from an Info_line's content.
   * Extracts the voice content and wraps it with brackets.
   */
  createInlineFieldFromInfoLine(infoLine: Info_line): Inline_field {
    const leftBracket = new Token(TT.INLN_FLD_LFT_BRKT, "[", this.ctx.generateId());
    const rightBracket = new Token(TT.INLN_FLD_RGT_BRKT, "]", this.ctx.generateId());
    const fieldToken = new Token(TT.INF_HDR, "V:", this.ctx.generateId());

    // Clone the value tokens
    const text = infoLine.value.map((t) => cloneToken(t, this.ctx));
    const value2 = infoLine.value2 ? [...infoLine.value2] : undefined;

    return new Inline_field(
      this.ctx.generateId(),
      fieldToken,
      text,
      value2,
      leftBracket,
      rightBracket
    );
  }

  /**
   * Create an Info_line from an Inline_field's content.
   * Extracts the voice content and creates a standalone info line.
   */
  createInfoLineFromInlineField(inlineField: Inline_field): Info_line {
    const keyToken = new Token(TT.INF_HDR, "V:", this.ctx.generateId());

    // Clone the text tokens
    const valueTokens = inlineField.text.map((t) => cloneToken(t, this.ctx));
    const allTokens = [keyToken, ...valueTokens];

    // Use value2 if available
    const value2 = inlineField.value2 ? [...inlineField.value2] : undefined;

    return new Info_line(this.ctx.generateId(), allTokens, undefined, value2);
  }

  /**
   * Create a whitespace token with a single space.
   */
  createWSToken(): Token {
    return new Token(TT.WS, " ", this.ctx.generateId());
  }

  /**
   * Create an EOL token with a newline character.
   */
  createEOLToken(): Token {
    return new Token(TT.EOL, "\n", this.ctx.generateId());
  }
}
