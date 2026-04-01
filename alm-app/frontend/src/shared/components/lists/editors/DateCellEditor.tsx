import type { DateCell } from "@silevis/reactgrid";
import type { BuildEditorCellArgs, ParseEditorChangeArgs, TabularEditorDefinition } from "./types";

function asDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export const dateCellEditor: TabularEditorDefinition<unknown> = {
  buildCell: ({ rawValue, editable, draftError, draftPending }: BuildEditorCellArgs<unknown>) =>
    ({
      type: "date",
      date: asDate(rawValue),
      nonEditable: !editable,
      className: draftError ? "rg-tabular-cell-error" : draftPending ? "rg-tabular-cell-pending" : undefined,
    }) satisfies DateCell,
  parseChange: ({ change }: ParseEditorChangeArgs<unknown>) => {
    if (change.type !== "date") return null;
    return {
      nextValue: change.newCell.date ?? null,
      previousValue: change.previousCell.date ?? null,
    };
  },
};
