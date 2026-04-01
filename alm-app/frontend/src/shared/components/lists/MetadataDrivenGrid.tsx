import "@silevis/reactgrid/styles.css";

import { useCallback, useMemo, useState } from "react";
import type {
  CellChange,
  CellLocation,
  Column,
  Row,
  TextCell,
} from "@silevis/reactgrid";
import { ReactGrid } from "@silevis/reactgrid";
import type { ReactNode } from "react";
import type { MetadataDrivenGridProps, TabularDraftState } from "./types";
import { getTabularEditor, type GridCell } from "./editors";

function draftKey(rowId: string, columnKey: string): string {
  return `${rowId}::${columnKey}`;
}

function staticTextCell(text: string, renderer?: (text: string) => ReactNode): TextCell {
  return { type: "text", text, nonEditable: true, renderer };
}

function isSpecialColumn(columnId: string): boolean {
  return columnId === "__select__" || columnId === "__actions__";
}

interface PendingGridChange<T> {
  key: string;
  row: T;
  rowId: string;
  column: MetadataDrivenGridProps<T>["columns"][number];
  commitValue: unknown;
  previousValue: unknown;
  validationError: string | null;
}

interface GridHistoryEntry<T> {
  row: T;
  rowId: string;
  column: MetadataDrivenGridProps<T>["columns"][number];
  previousValue: unknown;
  nextValue: unknown;
}

interface GridHistoryTransaction<T> {
  entries: GridHistoryEntry<T>[];
}

export function MetadataDrivenGrid<T>({
  columns,
  data,
  getRowKey,
  emptyMessage = "No items",
  selectionColumn = false,
  selectedKeys,
  onToggleSelect,
  onSelectAll,
  renderRowActions,
  onRowOpen,
  onCellCommit,
}: MetadataDrivenGridProps<T>) {
  const [drafts, setDrafts] = useState<Record<string, TabularDraftState>>({});
  const [focusLocation, setFocusLocation] = useState<CellLocation | undefined>(undefined);
  const [undoStack, setUndoStack] = useState<GridHistoryTransaction<T>[]>([]);
  const [redoStack, setRedoStack] = useState<GridHistoryTransaction<T>[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);

  const selectedSet = useMemo(() => {
    if (selectedKeys == null) return new Set<string>();
    if (selectedKeys instanceof Set) return selectedKeys;
    return new Set(selectedKeys);
  }, [selectedKeys]);

  const columnList = useMemo<Column[]>(() => {
    const items: Column[] = [];
    if (selectionColumn) items.push({ columnId: "__select__", width: 44, resizable: false });
    for (const column of columns) {
      items.push({
        columnId: column.key,
        width: column.width ?? (column.key === "title" ? 280 : 150),
        resizable: true,
      });
    }
    if (renderRowActions) items.push({ columnId: "__actions__", width: 96, resizable: false });
    return items;
  }, [columns, renderRowActions, selectionColumn]);

  const stickyLeftColumns = useMemo(() => {
    let count = selectionColumn ? 1 : 0;
    for (const column of columns) {
      if (!column.pinned) break;
      count += 1;
    }
    return count;
  }, [columns, selectionColumn]);

  const rowMap = useMemo(() => {
    const map = new Map<string, T>();
    for (const row of data) map.set(getRowKey(row), row);
    return map;
  }, [data, getRowKey]);

  const allSelected = data.length > 0 && data.every((row) => selectedSet.has(getRowKey(row)));

  const focusableColumnIds = useMemo(
    () => columnList.map((column) => String(column.columnId)).filter((columnId) => !isSpecialColumn(columnId)),
    [columnList],
  );

  const firstFocusableColumnId = focusableColumnIds[0];

  const firstRow = data[0];

  const normalizeFocusLocation = useCallback((location: CellLocation | undefined): CellLocation | undefined => {
    if (!location || !firstRow || !firstFocusableColumnId) return undefined;
    const rowId = String(location.rowId);
    if (rowId === "__header__") {
      return { rowId: getRowKey(firstRow), columnId: firstFocusableColumnId };
    }
    const hasRow = rowMap.has(rowId);
    const safeRowId = hasRow ? rowId : getRowKey(firstRow);
    const columnId = String(location.columnId);
    if (focusableColumnIds.includes(columnId)) {
      return { rowId: safeRowId, columnId };
    }
    return { rowId: safeRowId, columnId: firstFocusableColumnId };
  }, [firstFocusableColumnId, firstRow, focusableColumnIds, getRowKey, rowMap]);

  const resolvedFocusLocation = useMemo(() => {
    const normalized = normalizeFocusLocation(focusLocation);
    if (normalized) return normalized;
    if (!firstRow || !firstFocusableColumnId) return undefined;
    return { rowId: getRowKey(firstRow), columnId: firstFocusableColumnId };
  }, [firstFocusableColumnId, firstRow, focusLocation, getRowKey, normalizeFocusLocation]);

  const rows = useMemo<Row<GridCell>[]>(() => {
    const headerCells: GridCell[] = [];
    if (selectionColumn) {
      headerCells.push({
        type: "checkbox",
        checked: allSelected,
        nonEditable: false,
      });
    }
    for (const column of columns) {
      headerCells.push({
        type: "header",
        text: column.label,
      });
    }
    if (renderRowActions) {
      headerCells.push({
        type: "header",
        text: "Actions",
      });
    }

    const bodyRows = data.map((row) => {
      const rowId = getRowKey(row);
      const cells: GridCell[] = [];

      if (selectionColumn) {
        cells.push({
          type: "checkbox",
          checked: selectedSet.has(rowId),
          nonEditable: false,
        });
      }

      for (const column of columns) {
        const key = draftKey(rowId, column.key);
        const draft = drafts[key];
        const rawValue = draft ? draft.value : column.getRawValue(row);
        const displayValue = column.getDisplayValue(row, rawValue);
        const editable = column.isEditable(row);
        const commonClassName = draft?.error ? "rg-tabular-cell-error" : draft?.pending ? "rg-tabular-cell-pending" : undefined;

        const editor = getTabularEditor<T>(column.editorKind);
        const cell = editor.buildCell({
          row,
          column,
          rawValue,
          displayValue,
          editable,
          draftError: draft?.error ?? null,
          draftPending: draft?.pending ?? false,
        });
        if (cell.type === "text") {
          cell.renderer = (text: string) => {
            const custom = column.renderDisplay?.(row, rawValue);
            if (custom != null) return custom;
            if (onRowOpen && column.key === "artifact_key") {
              return (
                <button
                  type="button"
                  className="cursor-pointer text-left text-primary underline-offset-2 hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRowOpen(row);
                  }}
                >
                  {text || "Open"}
                </button>
              );
            }
            return text || "—";
          };
        }
        if (!("className" in cell) && commonClassName) {
          (cell as GridCell & { className?: string }).className = commonClassName;
        }
        cells.push(cell);
      }

      if (renderRowActions) {
        cells.push(
          staticTextCell("", () => (
            <div className="flex items-center justify-end">
              {renderRowActions(row)}
            </div>
          )),
        );
      }

      return { rowId, cells, height: 38 };
    });

    return [{ rowId: "__header__", cells: headerCells, height: 40 }, ...bodyRows];
  }, [allSelected, columns, data, drafts, getRowKey, onRowOpen, renderRowActions, selectedSet, selectionColumn]);

  const handleCellsChanged = useCallback((changes: CellChange[]) => {
    void (async () => {
      const pendingByKey = new Map<string, PendingGridChange<T>>();

      for (const change of changes) {
        const rowId = String(change.rowId);
        const columnId = String(change.columnId);

        if (rowId === "__header__" && columnId === "__select__" && change.type === "checkbox") {
          onSelectAll?.(change.newCell.checked);
          continue;
        }

        if (columnId === "__select__" && change.type === "checkbox") {
          onToggleSelect?.(rowId);
          continue;
        }

        if (columnId === "__actions__") continue;
        const row = rowMap.get(rowId);
        const column = columns.find((item) => item.key === columnId);
        if (!row || !column || !column.isEditable(row)) continue;

        const editor = getTabularEditor<T>(column.editorKind);
        const parsedChange = editor.parseChange({ change, row, column });
        if (!parsedChange) {
          continue;
        }
        const { nextValue, previousValue } = parsedChange;

        const commitValue = column.toCommitValue ? column.toCommitValue(nextValue, row) : nextValue;
        const validationError = column.validate?.(commitValue, row) ?? null;
        const key = draftKey(rowId, column.key);

        pendingByKey.set(key, {
          key,
          row,
          rowId,
          column,
          commitValue,
          previousValue,
          validationError,
        });
      }

      const pendingChanges = [...pendingByKey.values()];
      if (pendingChanges.length === 0) return;

      setDrafts((current) => {
        const nextDrafts = { ...current };
        for (const pendingChange of pendingChanges) {
          nextDrafts[pendingChange.key] = {
            value: pendingChange.commitValue,
            pending: !pendingChange.validationError,
            error: pendingChange.validationError,
          };
        }
        return nextDrafts;
      });

      const committableChanges = pendingChanges.filter((pendingChange) => !pendingChange.validationError);
      if (committableChanges.length === 0) return;

      const results = await Promise.all(
        committableChanges.map(async (pendingChange) => {
          try {
            await onCellCommit?.({
              row: pendingChange.row,
              rowId: pendingChange.rowId,
              column: pendingChange.column,
              nextValue: pendingChange.commitValue,
              previousValue: pendingChange.previousValue,
            });
            return {
              key: pendingChange.key,
              ok: true as const,
              historyEntry: {
                row: pendingChange.row,
                rowId: pendingChange.rowId,
                column: pendingChange.column,
                previousValue: pendingChange.previousValue,
                nextValue: pendingChange.commitValue,
              } satisfies GridHistoryEntry<T>,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not save cell.";
            return {
              key: pendingChange.key,
              ok: false as const,
              previousValue: pendingChange.previousValue,
              message,
            };
          }
        }),
      );

      setDrafts((current) => {
        const nextDrafts = { ...current };
        for (const result of results) {
          if (result.ok) {
            delete nextDrafts[result.key];
            continue;
          }
          nextDrafts[result.key] = {
            value: result.previousValue,
            pending: false,
            error: result.message,
          };
        }
        return nextDrafts;
      });

      const successfulEntries = results.flatMap((result) => (result.ok ? [result.historyEntry] : []));
      if (successfulEntries.length > 0) {
        const transaction: GridHistoryTransaction<T> = { entries: successfulEntries };
        setUndoStack((current) => [...current, transaction].slice(-100));
        setRedoStack([]);
      }
    })();
  }, [columns, onCellCommit, onSelectAll, onToggleSelect, rowMap]);

  const applyHistoryTransaction = useCallback(async (transaction: GridHistoryTransaction<T>, direction: "undo" | "redo") => {
    if (!onCellCommit) return false;
    const orderedEntries = direction === "undo" ? [...transaction.entries].reverse() : transaction.entries;

    setDrafts((current) => {
      const nextDrafts = { ...current };
      for (const entry of orderedEntries) {
        const targetValue = direction === "undo" ? entry.previousValue : entry.nextValue;
        nextDrafts[draftKey(entry.rowId, entry.column.key)] = {
          value: targetValue,
          pending: true,
          error: null,
        };
      }
      return nextDrafts;
    });

    const results = await Promise.all(
      orderedEntries.map(async (entry) => {
        const targetValue = direction === "undo" ? entry.previousValue : entry.nextValue;
        const sourceValue = direction === "undo" ? entry.nextValue : entry.previousValue;
        try {
          await onCellCommit({
            row: entry.row,
            rowId: entry.rowId,
            column: entry.column,
            nextValue: targetValue,
            previousValue: sourceValue,
          });
          return { key: draftKey(entry.rowId, entry.column.key), ok: true as const };
        } catch (error) {
          const message = error instanceof Error ? error.message : `Could not ${direction} change.`;
          return {
            key: draftKey(entry.rowId, entry.column.key),
            ok: false as const,
            fallbackValue: sourceValue,
            message,
          };
        }
      }),
    );

    const hasFailure = results.some((result) => !result.ok);
    setDrafts((current) => {
      const nextDrafts = { ...current };
      for (const result of results) {
        if (result.ok) {
          delete nextDrafts[result.key];
          continue;
        }
        nextDrafts[result.key] = {
          value: result.fallbackValue,
          pending: false,
          error: result.message,
        };
      }
      return nextDrafts;
    });

    return !hasFailure;
  }, [onCellCommit]);

  const handleUndo = useCallback(() => {
    if (historyBusy || undoStack.length === 0) return;
    const transaction = undoStack[undoStack.length - 1];
    if (!transaction) return;

    void (async () => {
      setHistoryBusy(true);
      const ok = await applyHistoryTransaction(transaction, "undo");
      if (ok) {
        setUndoStack((current) => current.slice(0, -1));
        setRedoStack((current) => [...current, transaction].slice(-100));
      }
      setHistoryBusy(false);
    })();
  }, [applyHistoryTransaction, historyBusy, undoStack]);

  const handleRedo = useCallback(() => {
    if (historyBusy || redoStack.length === 0) return;
    const transaction = redoStack[redoStack.length - 1];
    if (!transaction) return;

    void (async () => {
      setHistoryBusy(true);
      const ok = await applyHistoryTransaction(transaction, "redo");
      if (ok) {
        setRedoStack((current) => current.slice(0, -1));
        setUndoStack((current) => [...current, transaction].slice(-100));
      }
      setHistoryBusy(false);
    })();
  }, [applyHistoryTransaction, historyBusy, redoStack]);

  const handleGridKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() !== "z") return;

    event.preventDefault();
    event.stopPropagation();

    if (event.shiftKey) {
      handleRedo();
      return;
    }
    handleUndo();
  }, [handleRedo, handleUndo]);

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-md border border-border bg-background"
      onKeyDown={handleGridKeyDown}
      role="grid"
      aria-label="Tabular grid editor"
      tabIndex={0}
    >
      <div className="metadata-driven-grid h-[70vh] overflow-auto">
        <ReactGrid
          columns={columnList}
          rows={rows}
          focusLocation={resolvedFocusLocation}
          stickyTopRows={1}
          stickyLeftColumns={stickyLeftColumns}
          enableFillHandle
          enableRangeSelection
          onFocusLocationChanged={(location) => {
            setFocusLocation(normalizeFocusLocation(location));
          }}
          onFocusLocationChanging={(location) => {
            const normalized = normalizeFocusLocation(location);
            if (!normalized) return false;
            const sameLocation =
              String(normalized.rowId) === String(location.rowId) &&
              String(normalized.columnId) === String(location.columnId);
            if (sameLocation) return true;
            setFocusLocation(normalized);
            return false;
          }}
          onCellsChanged={handleCellsChanged}
        />
      </div>
    </div>
  );
}
