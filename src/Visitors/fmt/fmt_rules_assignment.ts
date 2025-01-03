import {
  isAnnotation,
  isBarLine,
  isBeam,
  isChord,
  isComment,
  isDecoration,
  isErrorExpr,
  isGrace_group,
  isInfo_line,
  isInline_field,
  isMultiMeasureRest,
  isNote,
  isNth_repeat,
  isSymbol,
  isToken,
  isTuplet,
  isYSPACER,
} from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { BarLine, Expr, File_structure, MultiMeasureRest, Tune, Tune_Body } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";

// Types for rules assignment
export enum SpcRul {
  SURROUND_SPC,
  FOLLOW_SPC,
  PRECEDE_SPC,
  NO_SPC,
  SURROUND_LN,
  FOLLOW_LN,
  PRECEDE_LN,
}

export function resolveRules(ast: File_structure, ctx: ABCContext) {
  // Start at tune body level
  for (let tune of ast.tune) {
    if (tune.tune_body) {
      tune = preprocessTune(tune, ctx);
      const ruleMap = assignTuneBodyRules(tune);
      tune.tune_body = resolveTuneBody(tune.tune_body!, ruleMap, ctx);
    }
  }
  return ast;
}
/**
 * Strip WS tokens and - if it’s a multi-voice tune - expand multi-measure rests in tune.
 * @param tune
 * @param ctx
 * @returns
 */
export function preprocessTune(tune: Tune, ctx: ABCContext): Tune {
  const tuneBody = tune.tune_body!;
  const is_multivoice = tune.tune_header.voices.length > 1;

  tuneBody.sequence = tuneBody.sequence.map((system) => {
    if (is_multivoice) {
      system = expandMultiMeasureRests(system, ctx);
    }
    return system.filter((node) => !(isToken(node) && node.type === TokenType.WHITESPACE));
  });

  return tune;
}

export function assignTuneBodyRules(tune: Tune): Map<Expr | Token, SpcRul[]> {
  const tuneBody = tune.tune_body!;
  let ruleMap = new Map<Expr | Token, SpcRul[]>();
  // Process each system
  for (let system of tuneBody.sequence) {
    for (const node of system) {
      if (isComment(node) || isTuplet(node) || isDecoration(node) || isGrace_group(node) || isSymbol(node)) {
        ruleMap.set(node, [SpcRul.PRECEDE_SPC]);
      } else if (
        isYSPACER(node) ||
        (isToken(node) &&
          (node.type === TokenType.RIGHT_PAREN || node.type === TokenType.LEFTPAREN || node.type === TokenType.EOL || node.type === TokenType.EOF))
      ) {
        ruleMap.set(node, [SpcRul.NO_SPC]);
      } else if (
        isAnnotation(node) ||
        isBarLine(node) ||
        isBeam(node) ||
        isInfo_line(node) ||
        isNote(node) ||
        isChord(node) ||
        isErrorExpr(node) ||
        isNth_repeat(node) ||
        isMultiMeasureRest(node) ||
        isToken(node)
      ) {
        ruleMap.set(node, [SpcRul.SURROUND_SPC]);
      } else if (isInline_field(node)) {
        ruleMap.set(node, [SpcRul.FOLLOW_SPC]);
      }
    }
  }
  return ruleMap;
}

/**
 * Return a new parse tree, containing WS where necessary.
 */
export function resolveTuneBody(tuneBody: Tune_Body, ruleMap: Map<Expr | Token, SpcRul[]>, ctx: ABCContext) {
  for (let s = 0; s < tuneBody.sequence.length; s++) {
    let system = tuneBody.sequence[s];
    const spacingDecisions = resolveSystem(ruleMap, system);
    for (let i = 0; i < system.length; i++) {
      const node = system[i];
      const decision = spacingDecisions.get(node);
      if (decision === TokenType.WHITESPACE) {
        tuneBody.sequence[s].splice(i, 0, new Token(TokenType.WHITESPACE, " ", null, -1, -1, ctx));
        i += 1;
      }
    }
  }
  return tuneBody;
}

/**
 * IN MULTI-VOICE SCORES ONLY
 * multi-measure rests need to be expanded to align bar lines.
 * @param system
 * @returns
 */
export function expandMultiMeasureRests(system: System, ctx: ABCContext): System {
  const expanded: System = [];

  for (const node of system) {
    if (isMultiMeasureRest(node) && node.length) {
      const is_invisible_rest = node.rest.lexeme === "X";
      const measures = node.length ? parseInt(node.length.lexeme) : 1;

      // Add first Z
      expanded.push(
        new MultiMeasureRest(ctx, new Token(TokenType.LETTER, is_invisible_rest ? "X" : "Z", null, node.rest.line, node.rest.position, ctx))
      );

      // Add barline and Z for remaining measures
      for (let i = 1; i < measures; i++) {
        expanded.push(new BarLine(ctx, new Token(TokenType.BARLINE, "|", null, node.rest.line, node.rest.position, ctx)));
        expanded.push(
          new MultiMeasureRest(ctx, new Token(TokenType.LETTER, is_invisible_rest ? "X" : "Z", null, node.rest.line, node.rest.position, ctx))
        );
      }
    } else {
      expanded.push(node);
    }
  }

  return expanded;
}

export function resolveSystem(ruleMap: Map<Expr | Token, SpcRul[]>, system: System) {
  // Will hold final spacing decisions
  const spacingDecisions = new Map<Expr | Token, TokenType | null>();

  for (let i = 0; i < system.length; i++) {
    const node = system[i];
    const currentRules = ruleMap.get(node);
    if (!currentRules) {
      continue;
    }

    // Look ahead to next node's rules
    const nextNode = system[i + 1];
    const nextRules = nextNode ? ruleMap.get(nextNode) : null;

    // Resolve spacing between current and next node
    if (currentRules.includes(SpcRul.SURROUND_SPC)) {
      // Handle surround space cases
      if (nextRules && nextRules.includes(SpcRul.NO_SPC)) {
        // No space after if next wants none
        spacingDecisions.set(node, TokenType.WHITESPACE);
      } else {
        spacingDecisions.set(node, TokenType.WHITESPACE);
      }
    } else if (currentRules.includes(SpcRul.FOLLOW_SPC)) {
      spacingDecisions.set(node, TokenType.WHITESPACE);
    } else if (currentRules.includes(SpcRul.PRECEDE_SPC)) {
      // Only add space if previous didn't already add one
      const prevNode = i === 0 ? null : system[i - 1];
      if (prevNode) {
        const prevDecision = spacingDecisions.get(prevNode);
        if (prevDecision !== TokenType.WHITESPACE) {
          spacingDecisions.set(prevNode, TokenType.WHITESPACE);
        }
      }
    } else if (currentRules.includes(SpcRul.NO_SPC)) {
      spacingDecisions.set(node, null);
    }
  }

  return spacingDecisions;
}
