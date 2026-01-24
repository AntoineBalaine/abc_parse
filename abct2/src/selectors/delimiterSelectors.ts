import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { TT } from "../../../parse/parsers/scan2";
import { Selection } from "../selection";

export interface DelimiterConfig {
  targetTag: string;
  openTokenType: TT;
  closeTokenType: TT;
}

const CHORD_CONFIG: DelimiterConfig = {
  targetTag: TAGS.Chord,
  openTokenType: TT.CHRD_LEFT_BRKT,
  closeTokenType: TT.CHRD_RIGHT_BRKT,
};

const GRACE_GROUP_CONFIG: DelimiterConfig = {
  targetTag: TAGS.Grace_group,
  openTokenType: TT.GRC_GRP_LEFT_BRACE,
  closeTokenType: TT.GRC_GRP_RGHT_BRACE,
};

const INLINE_FIELD_CONFIG: DelimiterConfig = {
  targetTag: TAGS.Inline_field,
  openTokenType: TT.INLN_FLD_LFT_BRKT,
  closeTokenType: TT.INLN_FLD_RGT_BRKT,
};

const GROUPING_CONFIG: DelimiterConfig = {
  targetTag: TAGS.Grouping,
  openTokenType: TT.LPAREN,
  closeTokenType: TT.RPAREN,
};

interface DelimiterWalkCtx {
  cursor: Set<number>;
  config: DelimiterConfig;
  seen: Set<number>;
  outputCursors: Set<number>[];
  collectFn: (delimNode: CSNode, config: DelimiterConfig) => Set<number>;
}

function walk(ctx: DelimiterWalkCtx, node: CSNode, enclosingDelimiter: CSNode | null): void {
  let current: CSNode | null = node;
  while (current) {
    let effectiveEnclosing = enclosingDelimiter;
    if (current.tag === ctx.config.targetTag) {
      effectiveEnclosing = current;
    }

    if (ctx.cursor.has(current.id) && effectiveEnclosing !== null && !ctx.seen.has(effectiveEnclosing.id)) {
      ctx.seen.add(effectiveEnclosing.id);
      const ids = ctx.collectFn(effectiveEnclosing, ctx.config);
      if (ids.size > 0) {
        ctx.outputCursors.push(ids);
      }
    }

    if (current.firstChild) {
      walk(ctx, current.firstChild, effectiveEnclosing);
    }

    current = current.nextSibling;
  }
}

function collectInsideIds(delimNode: CSNode, config: DelimiterConfig): Set<number> {
  const children: CSNode[] = [];
  let child = delimNode.firstChild;
  while (child) {
    children.push(child);
    child = child.nextSibling;
  }

  const openIdx = children.findIndex(
    (c) => isTokenNode(c) && getTokenData(c).tokenType === config.openTokenType
  );
  const closeIdx = findLastIndex(children, (c) =>
    isTokenNode(c) && getTokenData(c).tokenType === config.closeTokenType
  );

  if (openIdx === -1 || closeIdx === -1 || closeIdx <= openIdx) {
    return new Set();
  }

  const result = new Set<number>();
  for (let i = openIdx + 1; i < closeIdx; i++) {
    result.add(children[i].id);
  }
  return result;
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

function delimiterWalk(
  input: Selection,
  config: DelimiterConfig,
  collectFn: (delimNode: CSNode, config: DelimiterConfig) => Set<number>
): Selection {
  const outputCursors: Set<number>[] = [];

  for (const cursor of input.cursors) {
    const ctx: DelimiterWalkCtx = {
      cursor,
      config,
      seen: new Set(),
      outputCursors,
      collectFn,
    };
    walk(ctx, input.root, null);
  }

  return { root: input.root, cursors: outputCursors };
}

function selectAroundDelimited(input: Selection, config: DelimiterConfig): Selection {
  return delimiterWalk(input, config, (delimNode) => new Set([delimNode.id]));
}

function selectInsideDelimited(input: Selection, config: DelimiterConfig): Selection {
  return delimiterWalk(input, config, collectInsideIds);
}

export function selectInsideChord(input: Selection): Selection {
  return selectInsideDelimited(input, CHORD_CONFIG);
}

export function selectAroundChord(input: Selection): Selection {
  return selectAroundDelimited(input, CHORD_CONFIG);
}

export function selectInsideGraceGroup(input: Selection): Selection {
  return selectInsideDelimited(input, GRACE_GROUP_CONFIG);
}

export function selectAroundGraceGroup(input: Selection): Selection {
  return selectAroundDelimited(input, GRACE_GROUP_CONFIG);
}

export function selectInsideInlineField(input: Selection): Selection {
  return selectInsideDelimited(input, INLINE_FIELD_CONFIG);
}

export function selectAroundInlineField(input: Selection): Selection {
  return selectAroundDelimited(input, INLINE_FIELD_CONFIG);
}

export function selectInsideGrouping(input: Selection): Selection {
  return selectInsideDelimited(input, GROUPING_CONFIG);
}

export function selectAroundGrouping(input: Selection): Selection {
  return selectAroundDelimited(input, GROUPING_CONFIG);
}
