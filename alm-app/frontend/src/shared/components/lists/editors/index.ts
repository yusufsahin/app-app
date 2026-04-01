import type { TabularEditorKind } from "../types";
import { choiceCellEditor } from "./ChoiceCellEditor";
import { dateCellEditor } from "./DateCellEditor";
import { multiSelectTextCellEditor } from "./MultiSelectTextCellEditor";
import { numberCellEditor } from "./NumberCellEditor";
import { readonlyCellEditor } from "./readonlyFallback";
import { textCellEditor } from "./TextCellEditor";
import type { TabularEditorDefinition } from "./types";

export function getTabularEditor<T>(kind: TabularEditorKind): TabularEditorDefinition<T> {
  switch (kind) {
    case "number":
      return numberCellEditor as TabularEditorDefinition<T>;
    case "singleSelect":
      return choiceCellEditor as TabularEditorDefinition<T>;
    case "multiSelectText":
      return multiSelectTextCellEditor as TabularEditorDefinition<T>;
    case "date":
      return dateCellEditor as TabularEditorDefinition<T>;
    case "text":
      return textCellEditor as TabularEditorDefinition<T>;
    case "readonly":
    default:
      return readonlyCellEditor as TabularEditorDefinition<T>;
  }
}

export type { GridCell, TabularEditorDefinition } from "./types";
