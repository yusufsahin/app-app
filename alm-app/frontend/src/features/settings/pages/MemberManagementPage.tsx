import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Skeleton,
  Typography,
  Alert,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { PersonAdd } from "@mui/icons-material";
import { useTenantMembers, type TenantMember } from "../../../shared/api/tenantApi";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import InviteMemberModal from "../components/InviteMemberModal";

const columns: GridColDef<TenantMember>[] = [
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
    renderCell: (params) => (
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", py: 0.5 }}>
        {params.row.roles.map((role) => (
          <Chip
            key={role.id}
            label={role.name}
            size="small"
            color={role.is_system ? "primary" : "default"}
            variant={role.is_system ? "filled" : "outlined"}
          />
        ))}
      </Box>
    ),
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
  const tenantId = useTenantStore((s) => s.currentTenant?.id);
  const { data: members, isLoading, isError } = useTenantMembers(tenantId);
  const [inviteOpen, setInviteOpen] = useState(false);

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
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight={700}>
          Members
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={() => setInviteOpen(true)}
        >
          Invite Member
        </Button>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load members. Please try again.
        </Alert>
      )}

      <DataGrid
        rows={members ?? []}
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
      />
    </Container>
  );
}
