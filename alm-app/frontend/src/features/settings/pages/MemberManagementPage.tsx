import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import {
  Box,
  Button,
  Chip,
  Container,
  Skeleton,
  Typography,
  Alert,
  IconButton,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { PersonAdd, PersonAddAlt1, Delete } from "@mui/icons-material";
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

  type IncludeDeletedValues = { includeDeleted: boolean };
  const includeDeletedForm = useForm<IncludeDeletedValues>({ defaultValues: { includeDeleted } });
  useEffect(() => {
    includeDeletedForm.reset({ includeDeleted });
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
                  onClick={async () => {
                    if (!window.confirm(`Remove ${params.row.email}? They will not be able to sign in.`)) return;
                    try {
                      await deleteUser.mutateAsync(params.row.user_id);
                      showNotification("User removed");
                    } catch (e) {
                      const err = e as { detail?: string };
                      showNotification(err.detail ?? "Failed to remove user", "error");
                    }
                  }}
                >
                  <Delete />
                </IconButton>
              ) : null,
          } as GridColDef<MemberRow>,
        ]
      : []),
  ];

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
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
          <Typography variant="h4" fontWeight={700}>
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
    </Container>
  );
}
