/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetadataDrivenGrid } from "./MetadataDrivenGrid";
import type { MetadataDrivenGridProps, TabularColumnModel } from "./types";

type RowShape = {
  id: string;
  title: string;
};

let latestGridProps: {
  rows?: Array<{ rowId: string | number; cells: Array<{ type: string; text?: string; className?: string }> }>;
  onCellsChanged?: (changes: unknown[]) => void;
} = {};

vi.mock("@silevis/reactgrid", () => ({
  ReactGrid: (props: {
    rows: Array<{ rowId: string | number; cells: Array<{ type: string; text?: string; className?: string }> }>;
    onCellsChanged?: (changes: unknown[]) => void;
  }) => {
    latestGridProps = props;
    return (
      <div data-testid="react-grid-mock">
        <button
          type="button"
          onClick={() =>
            props.onCellsChanged?.([
              {
                rowId: "row-1",
                columnId: "title",
                type: "text",
                previousCell: { type: "text", text: "Before" },
                newCell: { type: "text", text: "After" },
              },
            ])
          }
        >
          trigger-text-change
        </button>
        <button
          type="button"
          onClick={() =>
            props.onCellsChanged?.([
              {
                rowId: "__header__",
                columnId: "__select__",
                type: "checkbox",
                previousCell: { type: "checkbox", checked: false },
                newCell: { type: "checkbox", checked: true },
              },
            ])
          }
        >
          trigger-select-all
        </button>
        {props.rows.map((row) => (
          <div key={String(row.rowId)} data-testid={`row-${String(row.rowId)}`}>
            {row.cells.map((cell, index) => (
              <div
                key={`${String(row.rowId)}-${index}`}
                data-testid={`cell-${String(row.rowId)}-${index}`}
                className={cell.className}
              >
                {cell.text ?? ""}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeColumn(): TabularColumnModel<RowShape> {
  return {
    key: "title",
    label: "Title",
    editorKind: "text",
    isSupported: true,
    isEditable: () => true,
    getRawValue: (row) => row.title,
    getDisplayValue: (_row, value) => String(value ?? ""),
    toCommitValue: (value) => String(value ?? "").trim(),
    validate: (value) => (String(value ?? "").trim() ? null : "Title is required."),
  };
}

function renderGrid(overrides: Partial<MetadataDrivenGridProps<RowShape>> = {}) {
  const defaultProps: MetadataDrivenGridProps<RowShape> = {
    columns: [makeColumn()],
    data: [{ id: "row-1", title: "Before" }],
    getRowKey: (row) => row.id,
    onCellCommit: vi.fn().mockResolvedValue(undefined),
  };

  return render(<MetadataDrivenGrid {...defaultProps} {...overrides} />);
}

describe("MetadataDrivenGrid", () => {
  it("renders empty state when there is no data", () => {
    renderGrid({ data: [], emptyMessage: "Nothing here" });
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("shows pending state during commit and clears it on success", async () => {
    const pendingCommit = deferred<void>();
    const onCellCommit = vi.fn(() => pendingCommit.promise);
    renderGrid({ onCellCommit });

    fireEvent.click(screen.getByText("trigger-text-change"));

    await waitFor(() => {
      expect(onCellCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          rowId: "row-1",
          nextValue: "After",
          previousValue: "Before",
        }),
      );
      const bodyCell = latestGridProps.rows?.find((row) => row.rowId === "row-1")?.cells[0];
      expect(bodyCell?.className).toBe("rg-tabular-cell-pending");
    });

    pendingCommit.resolve();

    await waitFor(() => {
      const bodyCell = latestGridProps.rows?.find((row) => row.rowId === "row-1")?.cells[0];
      expect(bodyCell?.className).toBeUndefined();
    });
  });

  it("rolls back failed commits into error state and forwards select-all actions", async () => {
    const onSelectAll = vi.fn();
    const onCellCommit = vi.fn().mockRejectedValue(new Error("Save failed"));
    renderGrid({ onCellCommit, selectionColumn: true, onSelectAll });

    fireEvent.click(screen.getByText("trigger-select-all"));
    expect(onSelectAll).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("trigger-text-change"));

    await waitFor(() => {
      const row = latestGridProps.rows?.find((entry) => entry.rowId === "row-1");
      const bodyCell = row?.cells[1];
      expect(bodyCell?.className).toBe("rg-tabular-cell-error");
      expect(bodyCell?.text).toBe("Before");
    });
  });

  it("supports undo and redo through keyboard shortcuts", async () => {
    const onCellCommit = vi.fn().mockResolvedValue(undefined);
    renderGrid({ onCellCommit });

    fireEvent.click(screen.getByText("trigger-text-change"));
    await waitFor(() => expect(onCellCommit).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(screen.getByRole("grid", { name: "Tabular grid editor" }), {
      key: "z",
      ctrlKey: true,
    });
    await waitFor(() => expect(onCellCommit).toHaveBeenCalledTimes(2));
    expect(onCellCommit.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        nextValue: "Before",
        previousValue: "After",
      }),
    );

    fireEvent.keyDown(screen.getByRole("grid", { name: "Tabular grid editor" }), {
      key: "z",
      ctrlKey: true,
      shiftKey: true,
    });
    await waitFor(() => expect(onCellCommit).toHaveBeenCalledTimes(3));
    expect(onCellCommit.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        nextValue: "After",
        previousValue: "Before",
      }),
    );
  });
});
