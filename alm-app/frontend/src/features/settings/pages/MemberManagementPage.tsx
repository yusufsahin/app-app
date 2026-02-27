import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import {
  Box,
  Button,
  Chip,
  Skeleton,
  Typography,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Card,
  CardContent,
  Stack,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { PersonAdd, PersonAddAlt1, Delete, People, PersonOff, ManageAccounts } from "@mui/icons-material";
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

const baseColumns: GridColDef<MemberRow>[] = [
  {
    field: "display_name",
    headerName: "Name",
    flex: 1,
    minWidth: 150,
  },
  {
    field: "email",
    headerName: "Email",
    flex: 1.2,
    minWidth: 200,
  },
  {
    field: "roles",
    headerName: "Roles",
    flex: 1.5,
    minWidth: 200,
    sortable: false,
    renderCell: (params: GridRenderCellParams<MemberRow>) => {
      const roles = params.row.roles;
      const slugs = (params.row as MemberRow).role_slugs;
      if (slugs?.length) {
        return (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", py: 0.5 }}>
            {slugs.map((s) => (
              <Chip key={s} label={s} size="small" variant="outlined" />
            ))}
          </Box>
        );
      }
      return (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", py: 0.5 }}>
          {roles?.map((role) => (
            <Chip
              key={role.id}
              label={role.name}
              size="small"
              color={role.is_system ? "primary" : "default"}
              variant={role.is_system ? "filled" : "outlined"}
            />
          ))}
        </Box>
      );
    },
  },
  {
    field: "joined_at",
    headerName: "Joined",
    width: 160,
    valueFormatter: (value: string) => {
      if (!value) return "";
      return new Date(value).toLocaleDateString(undefined, {
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

  const columns: GridColDef<MemberRow>[] = [
    ...baseColumns,
    ...(includeDeleted
      ? [
          {
            field: "deleted_at",
            headerName: "Deleted",
            width: 120,
            renderCell: (params: GridRenderCellParams<MemberRow>) =>
              params.row.deleted_at ? (
                <Chip label="Deleted" size="small" color="error" variant="outlined" />
              ) : (
                "—"
              ),
          } as GridColDef<MemberRow>,
          {
            field: "actions",
            headerName: " ",
            width: 56,
            sortable: false,
            renderCell: (params: GridRenderCellParams<MemberRow>) =>
              !params.row.deleted_at ? (
                <IconButton
                  size="small"
                  color="error"
                  aria-label="Delete user"
                  onClick={() => setRemoveDialogUser({ user_id: params.row.user_id, email: params.row.email })}
                >
                  <Delete />
                </IconButton>
              ) : null,
          } as GridColDef<MemberRow>,
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
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <OrgSettingsBreadcrumbs currentPageLabel="Members" />
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
            Members
          </Typography>
          {isAdmin && (
            <FormProvider {...includeDeletedForm}>
              <RhfCheckbox<IncludeDeletedValues>
                name="includeDeleted"
                control={includeDeletedForm.control}
                label="Include deleted"
              />
            </FormProvider>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => setInviteOpen(true)}
          >
            Invite Member
          </Button>
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<PersonAddAlt1 />}
              onClick={() => setCreateUserOpen(true)}
            >
              Create User
            </Button>
          )}
        </Box>
      </Box>

      {/* Stat Cards */}
      {rows.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: "primary.light",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <People sx={{ color: "primary.main" }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>{rows.length}</Typography>
                    <Typography variant="body2" color="text.secondary">Total Members</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: "success.light",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ManageAccounts sx={{ color: "success.main" }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>
                      {rows.filter((r) => !r.deleted_at).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Active Members</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: "error.light",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PersonOff sx={{ color: "error.main" }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>
                      {rows.filter((r) => r.deleted_at).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Removed Members</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load members. Please try again.
        </Alert>
      )}

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => row.user_id}
        autoHeight
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        disableRowSelectionOnClick
        sx={{
          bgcolor: "background.paper",
          borderRadius: 2,
          "& .MuiDataGrid-columnHeaders": {
            bgcolor: "grey.50",
            fontWeight: 600,
          },
        }}
      />

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

      <Dialog
        open={!!removeDialogUser}
        onClose={() => !deleteUser.isPending && setRemoveDialogUser(null)}
      >
        <DialogTitle>Remove user?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove {removeDialogUser?.email}? They will no longer be able to sign in. This can be
            reversed by an administrator.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveDialogUser(null)} disabled={deleteUser.isPending}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmRemove}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsPageWrapper>
  );
}
