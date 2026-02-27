import { useForm, FormProvider } from "react-hook-form";
import { Skeleton } from "../../../shared/components/ui";
import { RhfSelect, RhfTextField } from "../../../shared/components/forms";
import { useAccessAudit, type AccessAuditEntry } from "../../../shared/api/adminApi";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";

const typeOptions = [
  { value: "", label: "All" },
  { value: "LOGIN_SUCCESS", label: "Login success" },
  { value: "LOGIN_FAILURE", label: "Login failure" },
];

type FilterFormValues = {
  from_date: string;
  to_date: string;
  type_filter: string;
  limit: number;
};

const columns: Array<{
  field: keyof AccessAuditEntry;
  headerName: string;
  minWidth?: number;
  valueFormatter?: (value: unknown) => string;
}> = [
  {
    field: "timestamp",
    headerName: "Time",
    minWidth: 180,
    valueFormatter: (value: unknown) => {
      if (!value) return "—";
      return new Date(String(value)).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "medium",
      });
    },
  },
  { field: "type", headerName: "Type", minWidth: 140 },
  { field: "email", headerName: "Email", minWidth: 200 },
  { field: "ip", headerName: "IP", minWidth: 140 },
  { field: "user_agent", headerName: "User agent", minWidth: 220 },
];

export default function AccessAuditPage() {
  const form = useForm<FilterFormValues>({
    defaultValues: {
      from_date: "",
      to_date: "",
      type_filter: "",
      limit: 200,
    },
  });
  const { watch } = form;
  const values = watch();

  const params = {
    from_date: values.from_date || undefined,
    to_date: values.to_date || undefined,
    type_filter: values.type_filter || undefined,
    limit: Number(values.limit) || 200,
  };
  const { data: entries, isLoading, isError } = useAccessAudit(params);

  if (isLoading) {
    return (
      <SettingsPageWrapper>
        <Skeleton className="mb-4 h-10 w-48" />
        <Skeleton className="h-[400px] rounded-md" />
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <OrgSettingsBreadcrumbs currentPageLabel="Access audit" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Access audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View login and access audit log for this organization.
        </p>
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
          Failed to load audit log.
        </div>
      )}

      <FormProvider {...form}>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Filters</p>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <RhfTextField<FilterFormValues>
            name="from_date"
            label="From date"
            type="date"
          />
          <RhfTextField<FilterFormValues>
            name="to_date"
            label="To date"
            type="date"
          />
          <div className="min-w-[160px]">
            <RhfSelect<FilterFormValues>
              name="type_filter"
              control={form.control}
              label="Type"
              options={typeOptions}
            />
          </div>
          <RhfTextField<FilterFormValues>
            name="limit"
            label="Limit"
            type="number"
          />
        </div>
      </FormProvider>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full table-auto border-collapse text-left text-sm">
          <thead className="bg-muted/50 font-semibold">
            <tr>
              {columns.map((col) => (
                <th key={col.field} className="border-b px-4 py-3" style={{ minWidth: col.minWidth }}>
                  {col.headerName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((col) => {
                  const raw = row[col.field];
                  const value = col.valueFormatter
                    ? col.valueFormatter(raw)
                    : raw != null
                      ? String(raw)
                      : "—";
                  return (
                    <td key={col.field} className="px-4 py-2" style={{ minWidth: col.minWidth }}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsPageWrapper>
  );
}
