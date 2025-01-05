import { isBeam, isChord, isDecoration, isGraceGroup, isMultiMeasureRest, isNote, isToken, isYSPACER } from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { BarLine, Expr, File_structure, MultiMeasureRest, Tune, Tune_Body } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";

// Types for rules assignment
export enum SpcRul {
  FOLLOW_SPC,
  NO_SPC,
  PRECEDE_SPC,
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

export function assignTuneBodyRules(tune: Tune): Map<Expr | Token, SpcRul> {
  const tuneBody = tune.tune_body!;
  let ruleMap = new Map<Expr | Token, SpcRul>();
  // Process each system
  for (let system of tuneBody.sequence) {
    for (const node of system) {
      if (
        isYSPACER(node) ||
        (isToken(node) &&
          (node.type === TokenType.RIGHT_PAREN || node.type === TokenType.LEFTPAREN || node.type === TokenType.EOL || node.type === TokenType.EOF))
      ) {
        ruleMap.set(node, SpcRul.NO_SPC);
      } else {
        ruleMap.set(node, SpcRul.PRECEDE_SPC);
      }
    }
  }
  return ruleMap;
}

/**
 * Updates the parse tree in place
 */
export function resolveTuneBody(tuneBody: Tune_Body, ruleMap: Map<Expr | Token, SpcRul>, ctx: ABCContext) {
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

export function resolveSystem(ruleMap: Map<Expr | Token, SpcRul>, system: System) {
  // Will hold final spacing decisions
  const spacingDecisions = new Map<Expr | Token, TokenType | null>();

  for (let i = 0; i < system.length; i++) {
    const node = system[i];
    const currentRules: SpcRul | undefined = ruleMap.get(node);
    if (!currentRules) {
      continue;
    }

    // Resolve spacing between current and next node
    switch (currentRules) {
      case SpcRul.PRECEDE_SPC: {
        const prevNode = i > 0 ? system[i - 1] : null;

        if (!noPrev(prevNode, node)) {
          spacingDecisions.set(node, TokenType.WHITESPACE);
        }
        break;
      }
      case SpcRul.NO_SPC:
      default: {
        spacingDecisions.set(node, null);
        break;
      }
    }
  }

  return spacingDecisions;
}

function noPrev(prev: Expr | Token | null, cur: Expr | Token): boolean {
  return (
    !prev || // start of input
    (isToken(prev) && prev.type === TokenType.EOL) || // start of line
    (isDecoration(prev) && isNote(cur)) ||
    (isDecoration(prev) && isChord(cur)) ||
    (isDecoration(prev) && isDecoration(cur)) ||
    (isDecoration(prev) && isBeam(cur)) ||
    (isGraceGroup(prev) && isNote(cur)) ||
    (isGraceGroup(prev) && isBeam(cur)) ||
    (isGraceGroup(prev) && isChord(cur))
  );
}
