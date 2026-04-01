import type { BuildEditorCellArgs, TabularEditorDefinition } from "./types";

export const readonlyCellEditor: TabularEditorDefinition<unknown> = {
  buildCell: ({ displayValue, draftError, draftPending }: BuildEditorCellArgs<unknown>) => ({
    type: "text",
    text: displayValue || "—",
    nonEditable: true,
    className: draftError ? "rg-tabular-cell-error" : draftPending ? "rg-tabular-cell-pending" : undefined,
  }),
  parseChange: () => null,
};
