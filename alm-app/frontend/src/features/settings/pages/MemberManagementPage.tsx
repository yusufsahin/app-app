import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { Button, Card, CardContent, Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, Skeleton, Badge } from "../../../shared/components/ui";
import { UserPlus, CircleUser, Trash2, Users, UserX, Settings2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { useOrgMembers, type TenantMember } from "../../../shared/api/orgApi";
import {
  useAdminUsers,
  useDeleteAdminUser,
  type AdminUser,
} from "../../../shared/api/adminApi";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { RhfCheckbox } from "../../../shared/components/forms";
import InviteMemberModal from "../components/InviteMemberModal";
import CreateUserModal from "../components/CreateUserModal";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";

type MemberRow = TenantMember & { deleted_at?: string | null; role_slugs?: string[] };

const baseColumns: Array<{
  field: keyof MemberRow | "actions";
  headerName: string;
  minWidth?: number;
  render?: (row: MemberRow) => React.ReactNode;
  valueFormatter?: (value: unknown, row: MemberRow) => string;
}> = [
  {
    field: "display_name",
    headerName: "Name",
    minWidth: 150,
  },
  {
    field: "email",
    headerName: "Email",
    minWidth: 200,
  },
  {
    field: "roles",
    headerName: "Roles",
    minWidth: 200,
    render: (row) => {
      const roles = row.roles;
      const slugs = row.role_slugs;
      if (slugs?.length) {
        return (
          <div className="flex flex-wrap gap-1 py-0.5">
            {slugs.map((s) => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-1 py-0.5">
          {roles?.map((role) => (
            <Badge
              key={role.id}
              variant={role.is_system ? "default" : "outline"}
              className="text-xs"
            >
              {role.name}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    field: "joined_at",
    headerName: "Joined",
    valueFormatter: (value: unknown) => {
      if (!value) return "";
      return new Date(String(value)).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
  },
];

export default function MemberManagementPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const roles = useAuthStore((s) => s.roles);
  const isAdmin = roles.includes("admin");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [removeDialogUser, setRemoveDialogUser] = useState<{ user_id: string; email: string } | null>(null);

  type IncludeDeletedValues = { includeDeleted: boolean };
  const includeDeletedForm = useForm<IncludeDeletedValues>({ defaultValues: { includeDeleted } });
  useEffect(() => {
    includeDeletedForm.reset({ includeDeleted });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync prop into form only; includeDeletedForm omitted
  }, [includeDeleted]);
  const watchedIncludeDeleted = includeDeletedForm.watch("includeDeleted");
  useEffect(() => {
    setIncludeDeleted(watchedIncludeDeleted);
  }, [watchedIncludeDeleted, setIncludeDeleted]);

  const { data: orgMembers, isLoading: orgLoading, isError: orgError } = useOrgMembers(orgSlug);
  const { data: adminUsers, isLoading: adminLoading } = useAdminUsers(includeDeleted);
  const deleteUser = useDeleteAdminUser();
  const showNotification = useNotificationStore((s) => s.showNotification);

  const isLoading = includeDeleted ? adminLoading : orgLoading;
  const isError = !includeDeleted && orgError;

  const rows: MemberRow[] = includeDeleted && adminUsers
    ? adminUsers.map((u: AdminUser) => ({
        user_id: u.user_id,
        email: u.email,
        display_name: u.display_name,
        roles: [],
        joined_at: "",
        deleted_at: u.deleted_at,
        role_slugs: u.role_slugs,
      }))
    : (orgMembers ?? []).map((m) => ({ ...m, deleted_at: null }));

  const allColumns = [
    ...baseColumns,
    ...(includeDeleted
      ? [
          {
            field: "deleted_at" as const,
            headerName: "Deleted",
            minWidth: 120,
            render: (row: MemberRow) =>
              row.deleted_at ? (
                <Badge variant="destructive" className="text-xs">Deleted</Badge>
              ) : (
                "—"
              ),
          },
          {
            field: "actions" as const,
            headerName: " ",
            minWidth: 56,
            render: (row: MemberRow) =>
              !row.deleted_at ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                  aria-label="Delete user"
                  onClick={() => setRemoveDialogUser({ user_id: row.user_id, email: row.email })}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null,
          },
        ]
      : []),
  ];

  const handleConfirmRemove = async () => {
    if (!removeDialogUser) return;
    try {
      await deleteUser.mutateAsync(removeDialogUser.user_id);
      showNotification("User removed");
      setRemoveDialogUser(null);
    } catch (e) {
      const err = e as { detail?: string };
      showNotification(err.detail ?? "Failed to remove user", "error");
    }
  };

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
      <OrgSettingsBreadcrumbs currentPageLabel="Members" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-semibold">Members</h1>
          {isAdmin && (
            <FormProvider {...includeDeletedForm}>
              <RhfCheckbox<IncludeDeletedValues>
                name="includeDeleted"
                control={includeDeletedForm.control}
                label="Include deleted"
              />
            </FormProvider>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            Invite Member
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setCreateUserOpen(true)}>
              <CircleUser className="size-4" />
              Create User
            </Button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      {rows.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-row items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/15">
                  <Users className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rows.length}</p>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-row items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-lg bg-green-500/15">
                  <Settings2 className="size-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rows.filter((r) => !r.deleted_at).length}</p>
                  <p className="text-sm text-muted-foreground">Active Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-row items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/15">
                  <UserX className="size-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rows.filter((r) => r.deleted_at).length}</p>
                  <p className="text-sm text-muted-foreground">Removed Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
          Failed to load members. Please try again.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full table-auto border-collapse text-left text-sm">
          <thead className="bg-muted/50 font-semibold">
            <tr>
              {allColumns.map((col) => (
                <th key={col.field} className="border-b px-4 py-3" style={{ minWidth: col.minWidth }}>
                  {col.headerName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id} className="border-b last:border-0 hover:bg-muted/30">
                {allColumns.map((col) => {
                  if (col.field === "actions" && col.render) {
                    return (
                      <td key={col.field} className="px-4 py-2">
                        {col.render(row)}
                      </td>
                    );
                  }
                  if (col.render) {
                    return (
                      <td key={col.field} className="px-4 py-2" style={{ minWidth: col.minWidth }}>
                        {col.render(row)}
                      </td>
                    );
                  }
                  const raw = row[col.field as keyof MemberRow];
                  const value = "valueFormatter" in col && col.valueFormatter ? col.valueFormatter(raw, row) : raw != null ? String(raw) : "—";
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

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        orgSlug={orgSlug}
      />
      <CreateUserModal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        orgSlug={orgSlug}
      />

      <Dialog open={!!removeDialogUser} onOpenChange={(open) => !open && !deleteUser.isPending && setRemoveDialogUser(null)}>
        <DialogContent>
          <DialogTitle>Remove user?</DialogTitle>
          <DialogDescription>
            Remove {removeDialogUser?.email}? They will no longer be able to sign in. This can be
            reversed by an administrator.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogUser(null)} disabled={deleteUser.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRemove} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPageWrapper>
  );
}
