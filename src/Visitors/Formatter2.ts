import {
  isBarLine,
  isInfo_line,
  isBeam,
  isComment,
  isInline_field,
  isMultiMeasureRest,
  isNote,
  isNthRepeat,
  isToken,
  isVoice_overlay,
} from "../helpers";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
  Expr,
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
  Visitor,
  Voice_overlay,
  YSPACER,
  music_code,
  ErrorExpr,
  tune_body_code,
} from "../types/Expr";
import { Token } from "../types/token";
import { System, TokenType } from "../types/types";

export class TuneBodyFormatter {
  private tune: Tune[];

  private rules = new Map<Expr, FormattingRule[]>();

  constructor(tune: Tune[]) {
    this.tune = tune;
  }
  // Main entry point
  formatSystems(system: Array<System>): string {
    return system.map((system) => this.formatSystem(system)).join("\n");
  }
}
