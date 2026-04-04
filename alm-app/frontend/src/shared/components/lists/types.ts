import type { ReactNode } from "react";
import type { SchemaLookup } from "../../types/formSchema";

export type TabularEditorKind = "text" | "number" | "singleSelect" | "multiSelectText" | "date" | "readonly";

export interface TabularOption {
  value: string;
  label: string;
  isDisabled?: boolean;
}

export interface TabularColumnModel<T> {
  key: string;
  fieldKey?: string;
  label: string;
  width?: number;
  pinned?: boolean;
  editorKind: TabularEditorKind;
  writeTarget?: "root" | "custom_field" | null;
  lookup?: SchemaLookup | null;
  isEditable: (row: T) => boolean;
  isSupported: boolean;
  getRawValue: (row: T) => unknown;
  getDisplayValue: (row: T, value: unknown) => string;
  toCommitValue?: (value: unknown, row: T) => unknown;
  validate?: (value: unknown, row: T) => string | null;
  getOptions?: (row: T) => TabularOption[];
  renderDisplay?: (row: T, value: unknown) => ReactNode | null | undefined;
}

export interface TabularCellCommitArgs<T> {
  row: T;
  rowId: string;
  column: TabularColumnModel<T>;
  nextValue: unknown;
  previousValue: unknown;
}

export interface TabularDraftState {
  value: unknown;
  pending: boolean;
  error?: string | null;
}

export interface MetadataDrivenGridProps<T> {
  columns: TabularColumnModel<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  selectionColumn?: boolean;
  selectedKeys?: Set<string> | string[];
  onToggleSelect?: (rowKey: string) => void;
  onSelectAll?: (checked: boolean) => void;
  renderRowActions?: (row: T) => ReactNode;
  onRowOpen?: (row: T) => void;
  onCellCommit?: (args: TabularCellCommitArgs<T>) => Promise<void> | void;
  /** When set with `renderExpandedRow`, inserts a non-editable detail row after each expanded data row (`rowId` suffix `__taskDetail`). */
  expandedDetailRowKeys?: ReadonlySet<string>;
  renderExpandedRow?: (row: T) => ReactNode;
}
