import type { NumberCell } from "@silevis/reactgrid";
import type { BuildEditorCellArgs, ParseEditorChangeArgs, TabularEditorDefinition } from "./types";

export const numberCellEditor: TabularEditorDefinition<unknown> = {
  buildCell: ({ rawValue, editable, draftError, draftPending }: BuildEditorCellArgs<unknown>) =>
    ({
      type: "number",
      value: typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0),
      nonEditable: !editable,
      errorMessage: draftError ?? undefined,
      className: draftError ? "rg-tabular-cell-error" : draftPending ? "rg-tabular-cell-pending" : undefined,
    }) satisfies NumberCell,
  parseChange: ({ change }: ParseEditorChangeArgs<unknown>) => {
    if (change.type !== "number") return null;
    return {
      nextValue: change.newCell.value,
      previousValue: change.previousCell.value,
    };
  },
};
