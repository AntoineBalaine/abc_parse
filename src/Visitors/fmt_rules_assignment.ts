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
} from "../helpers";
import { Expr, File_structure, Tune_Body } from "../types/Expr";
import { Token } from "../types/token";
import { System, TokenType } from "../types/types";

// Types for rules assignment
enum SpcRul {
  SURROUND_SPC,
  FOLLOW_SPC,
  PRECEDE_SPC,
  NO_SPC,
  SURROUND_LN,
  FOLLOW_LN,
  PRECEDE_LN,
}

export class RuleAssigner {
  private ruleMap = new Map<Expr | Token, SpcRul[]>();

  assignRules(ast: File_structure) {
    // Start at tune body level
    for (const tune of ast.tune) {
      if (tune.tune_body) {
        this.assignTuneBodyRules(tune.tune_body);
      }
    }
    return this.ruleMap;
  }

  private assignTuneBodyRules(tuneBody: Tune_Body) {
    // Process each system
    for (let system of tuneBody.sequence) {
      system = system.filter((expr) => !(expr instanceof Token && expr.type === TokenType.WHITESPACE));
      for (const node of system) {
        if (isComment(node) || isTuplet(node) || isDecoration(node) || isGrace_group(node) || isSymbol(node)) {
          this.ruleMap.set(node, [SpcRul.PRECEDE_SPC]);
        } else if (
          isYSPACER(node) ||
          (isToken(node) &&
            (node.type === TokenType.RIGHT_PAREN || node.type === TokenType.LEFTPAREN || node.type === TokenType.EOL || node.type === TokenType.EOF))
        ) {
          this.ruleMap.set(node, [SpcRul.NO_SPC]);
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
          this.ruleMap.set(node, [SpcRul.SURROUND_SPC]);
        } else if (isInline_field(node)) {
          this.ruleMap.set(node, [SpcRul.FOLLOW_SPC]);
        }
      }
    }
  }
}

export class RulesResolver {
  // Input is the map from your RuleAssigner
  resolve(ruleMap: Map<Expr | Token, SpcRul[]>, system: System) {
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
}
