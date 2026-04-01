import type {
  CellChange,
  CheckboxCell,
  DateCell,
  DropdownCell,
  HeaderCell,
  NumberCell,
  TextCell,
} from "@silevis/reactgrid";
import type { TabularColumnModel } from "../types";

export type GridCell = HeaderCell | TextCell | NumberCell | DropdownCell | DateCell | CheckboxCell;

export interface BuildEditorCellArgs<T> {
  row: T;
  column: TabularColumnModel<T>;
  rawValue: unknown;
  displayValue: string;
  editable: boolean;
  draftError?: string | null;
  draftPending?: boolean;
}

export interface ParseEditorChangeArgs<T> {
  change: CellChange;
  row: T;
  column: TabularColumnModel<T>;
}

export interface TabularEditorDefinition<T> {
  buildCell: (args: BuildEditorCellArgs<T>) => GridCell;
  parseChange: (args: ParseEditorChangeArgs<T>) => { nextValue: unknown; previousValue: unknown } | null;
}
