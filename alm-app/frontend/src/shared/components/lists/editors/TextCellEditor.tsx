import type { TextCell } from "@silevis/reactgrid";
import type { BuildEditorCellArgs, ParseEditorChangeArgs, TabularEditorDefinition } from "./types";

function textCell(text: string, nonEditable = true): TextCell {
  return { type: "text", text, nonEditable };
}

export const textCellEditor: TabularEditorDefinition<unknown> = {
  buildCell: ({ displayValue, editable, draftError, draftPending }: BuildEditorCellArgs<unknown>) =>
    ({
      ...textCell(displayValue || "—", !editable),
      className: draftError ? "rg-tabular-cell-error" : draftPending ? "rg-tabular-cell-pending" : undefined,
    }) satisfies TextCell,
  parseChange: ({ change }: ParseEditorChangeArgs<unknown>) => {
    if (change.type !== "text") return null;
    return {
      nextValue: change.newCell.text,
      previousValue: change.previousCell.text,
    };
  },
};
