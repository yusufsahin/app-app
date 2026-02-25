/**
 * Metadata-driven list — renders table from ListSchemaDto (columns + optional filters).
 */
import {
  Box,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from "@mui/material";
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
}: MetadataDrivenListProps<T>) {
  const sortedColumns = useMemo(
    () => [...(schema.columns ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [schema.columns],
  );

  const sortedFilters = useMemo(
    () => [...(schema.filters ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [schema.filters],
  );

  const hasFilters = sortedFilters.length > 0 && onFilterChange;

  type FilterFormValues = Record<string, string>;
  const filterDefaultValues = useMemo<FilterFormValues>(
    () => Object.fromEntries(sortedFilters.map((f) => [f.key, filterValues[f.key] ?? ""])),
    [], // eslint-disable-line react-hooks/exhaustive-deps -- only initial
  );
  const filterForm = useForm<FilterFormValues>({ defaultValues: filterDefaultValues });
  useEffect(() => {
    filterForm.reset(Object.fromEntries(sortedFilters.map((f) => [f.key, filterValues[f.key] ?? ""])));
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {hasFilters && (
        <FormProvider {...filterForm}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {sortedFilters.map((f) => (
              <RhfSelect<FilterFormValues>
                key={f.key}
                name={f.key}
                control={filterForm.control}
                label={filterLabel(f)}
                options={[{ value: "", label: "All" }, ...(f.options ?? []).map((opt) => ({ value: opt, label: opt }))]}
                selectProps={{ size: "small", sx: { minWidth: 140 } }}
              />
            ))}
          </Box>
        </FormProvider>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={schema.entity_type}>
          <TableHead>
            <TableRow>
              {selectionColumn && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={someSelected && !allSelected}
                    checked={allSelected}
                    onChange={(_, checked) => onSelectAll?.(checked)}
                    disabled={data.length === 0}
                    aria-label="Select all on page"
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
              )}
              {sortedColumns.map((col) => (
                <TableCell key={col.key}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {columnLabel(col)}
                  </Typography>
                </TableCell>
              ))}
              {renderRowActions && <TableCell width={80}>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const rowKey = getRowKey(row);
                const checked = selectedSet.has(rowKey);
                return (
                  <TableRow
                    key={rowKey}
                    hover={!!onRowClick}
                    onClick={() => onRowClick?.(row)}
                    sx={onRowClick ? { cursor: "pointer" } : undefined}
                  >
                    {selectionColumn && (
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          onChange={() => onToggleSelect?.(rowKey)}
                          aria-label={`Select ${rowKey}`}
                        />
                      </TableCell>
                    )}
                    {sortedColumns.map((col) => {
                      const val = getCellValue(row, col.key);
                      return (
                        <TableCell key={col.key}>
                          {val !== undefined && val !== null ? String(val) : "—"}
                        </TableCell>
                      );
                    })}
                    {renderRowActions && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {renderRowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
