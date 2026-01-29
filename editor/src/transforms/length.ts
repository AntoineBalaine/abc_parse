import { Selection } from "../selection";

export function length(selection: Selection): number {
  return selection.cursors.length;
}
