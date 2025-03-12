import { isChord, isNote, isToken, isWS } from "../../helpers2";
import { ABCContext } from "../../parsers/Context";
import { Token, TT } from "../../parsers/scan2";
import { BarLine, Beam, Decoration, Expr, Grace_group, MultiMeasureRest, System, Tune, Tune_Body, YSPACER, tune_body_code } from "../../types/Expr2";
import { Ctx } from "../../parsers/scan2";

// Types for rules assignment
export enum SpcRul {
  FOLLOW_SPC,
  NO_SPC,
  PRECEDE_SPC,
}

export function resolveRules(ast: Tune, ctx: ABCContext): Tune {
  const tune_body = ast.tune_body;
  // Start at tune body level
  if (tune_body) {
    ast = preprocessTune(ast, ctx);
    const ruleMap = assignTuneBodyRules(ast);
    ast.tune_body = resolveTuneBody(tune_body, ruleMap, ctx);
  }
  return ast;
}

/**
 * Strip WS tokens and - if it's a multi-voice tune - expand multi-measure rests in tune.
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
    return system.filter((node) => !(isToken(node) && (node.type === TT.WS || node.type === TT.EOL)));
  });

  return tune;
}

export function assignTuneBodyRules(tune: Tune): Map<Expr | Token, SpcRul> {
  const tuneBody = tune.tune_body!;
  let ruleMap = new Map<Expr | Token, SpcRul>();
  // Process each system
  for (let system of tuneBody.sequence) {
    for (const node of system) {
      if (node instanceof YSPACER || (isToken(node) && (node.type === TT.SLUR || node.type === TT.EOL || node.type === TT.EOF))) {
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
export function resolveTuneBody(tuneBody: Tune_Body, ruleMap: Map<Expr | Token, SpcRul>, ctx: ABCContext): Tune_Body {
  for (let s = 0; s < tuneBody.sequence.length; s++) {
    let system = tuneBody.sequence[s];
    const spacingDecisions = resolveSystem(ruleMap, system);
    for (let i = 0; i < system.length; i++) {
      const node = system[i];
      const decision = spacingDecisions.get(node);
      if (decision === TT.WS) {
        const tknCtx = new Ctx(" ");
        tknCtx.current = tknCtx.source.length;
        tuneBody.sequence[s].splice(i, 0, new Token(TT.WS, tknCtx));
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
    if (node instanceof MultiMeasureRest && node.length) {
      const is_invisible_rest = node.rest.lexeme === "X";
      const measures = node.length ? parseInt(node.length.lexeme) : 1;

      // Add first Z
      const firstRestCtx = new Ctx(is_invisible_rest ? "X" : "Z");
      firstRestCtx.current = firstRestCtx.source.length;
      const firstRest = new Token(TT.NOTE_LETTER, firstRestCtx);
      expanded.push(new MultiMeasureRest(node.id, firstRest));

      // Add barline and Z for remaining measures
      for (let i = 1; i < measures; i++) {
        const barCtx = new Ctx("|");
        barCtx.current = barCtx.source.length;
        const barToken = new Token(TT.BARLINE, barCtx);
        expanded.push(new BarLine(node.id + i * 1000, [barToken]));

        const restCtx = new Ctx(is_invisible_rest ? "X" : "Z");
        restCtx.current = restCtx.source.length;
        const restToken = new Token(TT.NOTE_LETTER, restCtx);
        expanded.push(new MultiMeasureRest(node.id + i * 1000 + 1, restToken));
      }
    } else {
      expanded.push(node);
    }
  }

  return expanded;
}

export function resolveSystem(ruleMap: Map<Expr | Token, SpcRul>, system: System) {
  // Will hold final spacing decisions
  const spacingDecisions = new Map<Expr | Token, TT | null>();

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
          spacingDecisions.set(node, TT.WS);
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

function noPrev(prev: tune_body_code | null, cur: tune_body_code): boolean {
  return (
    !prev || // start of input
    (isToken(prev) && prev.type === TT.EOL) || // start of line
    (prev instanceof Decoration && isNote(cur)) ||
    (prev instanceof Decoration && isChord(cur)) ||
    (prev instanceof Decoration && prev instanceof Decoration) ||
    (prev instanceof Decoration && cur instanceof Beam) ||
    (prev instanceof Grace_group && isNote(cur)) ||
    (prev instanceof Grace_group && cur instanceof Beam) ||
    (prev instanceof Grace_group && isChord(cur))
  );
}
