/**
 * Metadata-driven list — renders table from ListSchemaDto (columns + optional filters).
 */
import { Checkbox } from "../ui";
import { useMemo, useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { RhfSelect } from "../forms";
import type { ListSchemaDto, ListColumnSchema, ListFilterSchema } from "../../types/listSchema";

function columnLabel(col: ListColumnSchema): string {
  return col.label ?? col.label_key ?? col.key;
}

function filterLabel(f: ListFilterSchema): string {
  return f.label ?? f.label_key ?? f.key;
}

export interface MetadataDrivenListProps<T> {
  schema: ListSchemaDto;
  data: T[];
  getCellValue: (row: T, columnKey: string) => string | number | undefined | null;
  getRowKey: (row: T) => string;
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  renderRowActions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** When set, show a checkbox column and call onToggleSelect when row checkbox is toggled. */
  selectionColumn?: boolean;
  /** Set of row keys that are selected (used with selectionColumn). */
  selectedKeys?: Set<string> | string[];
  /** Called when a row checkbox is toggled (row key). */
  onToggleSelect?: (rowKey: string) => void;
  /** Called when header "select all" is toggled (true = select all on page, false = deselect all). */
  onSelectAll?: (checked: boolean) => void;
  /** When true, do not render the filter row (filters are shown elsewhere, e.g. toolbar). */
  hideFilters?: boolean;
}

export function MetadataDrivenList<T>({
  schema,
  data,
  getCellValue,
  getRowKey,
  filterValues = {},
  onFilterChange,
  renderRowActions,
  emptyMessage = "No items",
  onRowClick,
  selectionColumn = false,
  selectedKeys,
  onToggleSelect,
  onSelectAll,
  hideFilters = false,
}: MetadataDrivenListProps<T>) {
  const sortedColumns = useMemo(
    () => [...(schema.columns ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [schema.columns],
  );

  const sortedFilters = useMemo(
    () => [...(schema.filters ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [schema.filters],
  );

  const hasFilters = sortedFilters.length > 0 && onFilterChange && !hideFilters;

  type FilterFormValues = Record<string, string>;
  const filterDefaultValues = useMemo<FilterFormValues>(
    () => Object.fromEntries(sortedFilters.map((f) => [f.key, filterValues[f.key] ?? ""])),
    [], // eslint-disable-line react-hooks/exhaustive-deps -- only initial
  );
  const filterForm = useForm<FilterFormValues>({ defaultValues: filterDefaultValues });
  useEffect(() => {
    filterForm.reset(Object.fromEntries(sortedFilters.map((f) => [f.key, filterValues[f.key] ?? ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when filter values/tabs change; filterForm omitted to avoid loops
  }, [filterValues, sortedFilters]);
  const watchedFilterValues = filterForm.watch();
  const filterInitialMount = useRef(true);
  useEffect(() => {
    if (!onFilterChange) return;
    if (filterInitialMount.current) {
      filterInitialMount.current = false;
      return;
    }
    for (const f of sortedFilters) {
      const v = watchedFilterValues[f.key] ?? "";
      if (v !== (filterValues[f.key] ?? "")) {
        onFilterChange(f.key, v);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on watchedFilterValues change only; onFilterChange/filterValues/sortedFilters omitted
  }, [watchedFilterValues]);

  const selectedSet = useMemo(() => {
    if (selectedKeys == null) return new Set<string>();
    if (selectedKeys instanceof Set) return selectedKeys;
    return new Set(selectedKeys);
  }, [selectedKeys]);

  const dataKeys = useMemo(() => data.map((row) => getRowKey(row)), [data, getRowKey]);
  const allSelected =
    dataKeys.length > 0 && dataKeys.every((k) => selectedSet.has(k));
  const someSelected = dataKeys.some((k) => selectedSet.has(k));
  const colSpan =
    sortedColumns.length + (renderRowActions ? 1 : 0) + (selectionColumn ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {hasFilters && (
        <FormProvider {...filterForm}>
          <div className="flex flex-wrap gap-4">
            {sortedFilters.map((f) => (
              <RhfSelect<FilterFormValues>
                key={f.key}
                name={f.key}
                control={filterForm.control}
                label={filterLabel(f)}
                options={[{ value: "", label: "All" }, ...(f.options ?? []).map((opt) => ({ value: opt, label: opt }))]}
                selectProps={{ size: "sm" }}
              />
            ))}
          </div>
        </FormProvider>
      )}

      <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm" aria-label={schema.entity_type}>
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr>
              {selectionColumn && (
                <th className="w-12 border-b border-border p-2">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                    disabled={data.length === 0}
                    aria-label="Select all on page"
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              )}
              {sortedColumns.map((col) => (
                <th key={col.key} className="border-b border-border px-2 py-2 text-left font-semibold">
                  {columnLabel(col)}
                </th>
              ))}
              {renderRowActions && <th className="w-20 border-b border-border px-2 py-2 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="border-b border-border px-2 py-6 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const rowKey = getRowKey(row);
                const checked = selectedSet.has(rowKey);
                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  >
                    {selectionColumn && (
                      <td className="border-b border-border p-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => onToggleSelect?.(rowKey)}
                          aria-label={`Select ${rowKey}`}
                        />
                      </td>
                    )}
                    {sortedColumns.map((col) => {
                      const val = getCellValue(row, col.key);
                      return (
                        <td key={col.key} className="border-b border-border px-2 py-2">
                          {val !== undefined && val !== null ? String(val) : "—"}
                        </td>
                      );
                    })}
                    {renderRowActions && (
                      <td className="border-b border-border px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        {renderRowActions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
