import type { TextCell } from "@silevis/reactgrid";
import type { BuildEditorCellArgs, ParseEditorChangeArgs, TabularEditorDefinition } from "./types";

function textCell(text: string, nonEditable = true): TextCell {
  return { type: "text", text, nonEditable };
}

function normalizeToken(token: string): string {
  return token.trim().toLocaleLowerCase();
}

export const multiSelectTextCellEditor: TabularEditorDefinition<unknown> = {
  buildCell: ({ displayValue, editable, draftError, draftPending }: BuildEditorCellArgs<unknown>) =>
    ({
      ...textCell(displayValue || "", !editable),
      placeholder: editable ? "Comma separated values" : undefined,
      className: draftError ? "rg-tabular-cell-error" : draftPending ? "rg-tabular-cell-pending" : undefined,
    }) satisfies TextCell,
  parseChange: ({ change, row, column }: ParseEditorChangeArgs<unknown>) => {
    if (change.type !== "text") return null;

    const options = column.getOptions?.(row) ?? [];
    const optionMap = new Map<string, string>();
    for (const option of options) {
      optionMap.set(normalizeToken(option.value), option.value);
      optionMap.set(normalizeToken(option.label), option.value);
    }

    const parseList = (value: string): string[] =>
      value
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => optionMap.get(normalizeToken(token)) ?? token);

    return {
      nextValue: parseList(change.newCell.text),
      previousValue: parseList(change.previousCell.text),
    };
  },
};
