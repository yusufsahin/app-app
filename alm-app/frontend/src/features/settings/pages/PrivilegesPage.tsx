import { Badge, Skeleton } from "../../../shared/components/ui";
import { usePrivileges, type Privilege } from "../../../shared/api/tenantApi";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";

const columns: Array<{
  field: keyof Privilege;
  headerName: string;
  minWidth?: number;
  render?: (row: Privilege) => React.ReactNode;
}> = [
  {
    field: "code",
    headerName: "Code",
    minWidth: 180,
    render: (row) => (
      <span className="font-mono font-medium">{row.code}</span>
    ),
  },
  {
    field: "resource",
    headerName: "Resource",
    minWidth: 120,
    render: (row) => (
      <Badge variant="outline" className="text-xs">{row.resource}</Badge>
    ),
  },
  {
    field: "action",
    headerName: "Action",
    minWidth: 100,
  },
  {
    field: "description",
    headerName: "Description",
    minWidth: 200,
  },
];

export default function PrivilegesPage() {
  const { data: privileges, isLoading, isError } = usePrivileges();

  if (isLoading) {
    return (
      <SettingsPageWrapper>
        <Skeleton className="mb-4 h-10 w-40" />
        <Skeleton className="h-[400px] rounded-md" />
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <OrgSettingsBreadcrumbs currentPageLabel="Privileges" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Privileges</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Available privileges (read-only). Assign to roles via Roles settings.
        </p>
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
          Failed to load privileges. Please try again.
        </div>
      )}

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
            {(privileges ?? []).map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((col) => {
                  if (col.render) {
                    return (
                      <td key={col.field} className="px-4 py-2" style={{ minWidth: col.minWidth }}>
                        {col.render(row)}
                      </td>
                    );
                  }
                  const value = row[col.field] != null ? String(row[col.field]) : "—";
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
