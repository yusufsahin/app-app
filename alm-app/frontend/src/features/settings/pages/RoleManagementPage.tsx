import { Badge, Skeleton } from "../../../shared/components/ui";
import { useParams } from "react-router-dom";
import { useOrgRoles, type TenantRoleDetail } from "../../../shared/api/orgApi";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";

const columns: Array<{
  field: keyof TenantRoleDetail | "privileges";
  headerName: string;
  minWidth?: number;
  align?: "left" | "center" | "right";
  render?: (row: TenantRoleDetail) => React.ReactNode;
  valueGetter?: (row: TenantRoleDetail) => string | number;
}> = [
  {
    field: "name",
    headerName: "Role Name",
    minWidth: 160,
    render: (row) => (
      <span className="font-medium">{row.name}</span>
    ),
  },
  {
    field: "description",
    headerName: "Description",
    minWidth: 200,
  },
  {
    field: "is_system",
    headerName: "Type",
    minWidth: 120,
    render: (row) =>
      row.is_system ? (
        <Badge variant="secondary" className="text-xs">System</Badge>
      ) : (
        <Badge variant="outline" className="text-xs">Custom</Badge>
      ),
  },
  {
    field: "hierarchy_level",
    headerName: "Hierarchy",
    minWidth: 120,
    align: "center",
    valueGetter: (row) => row.hierarchy_level ?? "—",
  },
  {
    field: "privileges",
    headerName: "Privileges",
    minWidth: 130,
    align: "center",
    valueGetter: (row) => row.privileges?.length ?? 0,
  },
];

export default function RoleManagementPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: roles, isLoading, isError } = useOrgRoles(orgSlug);

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
      <OrgSettingsBreadcrumbs currentPageLabel="Roles" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage roles and their associated privileges
        </p>
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
          Failed to load roles. Please try again.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full table-auto border-collapse text-left text-sm">
          <thead className="bg-muted/50 font-semibold">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.field}
                  className="border-b px-4 py-3"
                  style={{ minWidth: col.minWidth, textAlign: col.align ?? "left" }}
                >
                  {col.headerName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(roles ?? []).map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((col) => {
                  if (col.render) {
                    return (
                      <td
                        key={col.field}
                        className="px-4 py-2"
                        style={{ minWidth: col.minWidth, textAlign: col.align ?? "left" }}
                      >
                        {col.render(row)}
                      </td>
                    );
                  }
                  const value = col.valueGetter
                    ? col.valueGetter(row)
                    : row[col.field as keyof TenantRoleDetail] != null
                      ? String(row[col.field as keyof TenantRoleDetail])
                      : "—";
                  return (
                    <td
                      key={col.field}
                      className="px-4 py-2"
                      style={{ minWidth: col.minWidth, textAlign: col.align ?? "left" }}
                    >
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
