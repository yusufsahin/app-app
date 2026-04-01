import type { DropdownCell } from "@silevis/reactgrid";
import type { BuildEditorCellArgs, ParseEditorChangeArgs, TabularEditorDefinition } from "./types";

export const choiceCellEditor: TabularEditorDefinition<unknown> = {
  buildCell: ({ row, column, rawValue, editable, draftError, draftPending }: BuildEditorCellArgs<unknown>) =>
    ({
      type: "dropdown",
      selectedValue: rawValue == null ? undefined : String(rawValue),
      values: column.getOptions?.(row) ?? [],
      isDisabled: !editable,
      className: draftError ? "rg-tabular-cell-error" : draftPending ? "rg-tabular-cell-pending" : undefined,
    }) satisfies DropdownCell,
  parseChange: ({ change }: ParseEditorChangeArgs<unknown>) => {
    if (change.type !== "dropdown") return null;
    return {
      nextValue: change.newCell.selectedValue ?? "",
      previousValue: change.previousCell.selectedValue ?? "",
    };
  },
};
