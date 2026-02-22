import {
  Box,
  Chip,
  Container,
  Skeleton,
  Typography,
  Alert,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useTenantRoles, type TenantRoleDetail } from "../../../shared/api/tenantApi";
import { useTenantStore } from "../../../shared/stores/tenantStore";

const columns: GridColDef<TenantRoleDetail>[] = [
  {
    field: "name",
    headerName: "Role Name",
    flex: 1,
    minWidth: 160,
    renderCell: (params) => (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" fontWeight={500}>
          {params.row.name}
        </Typography>
      </Box>
    ),
  },
  {
    field: "description",
    headerName: "Description",
    flex: 1.5,
    minWidth: 200,
  },
  {
    field: "is_system",
    headerName: "Type",
    width: 120,
    renderCell: (params) =>
      params.row.is_system ? (
        <Chip label="System" size="small" color="warning" variant="filled" />
      ) : (
        <Chip label="Custom" size="small" color="default" variant="outlined" />
      ),
  },
  {
    field: "hierarchy_level",
    headerName: "Hierarchy",
    width: 120,
    align: "center",
    headerAlign: "center",
  },
  {
    field: "privileges",
    headerName: "Privileges",
    width: 130,
    align: "center",
    headerAlign: "center",
    valueGetter: (_value: string[], row: TenantRoleDetail) => row.privileges?.length ?? 0,
  },
];

export default function RoleManagementPage() {
  const tenantId = useTenantStore((s) => s.currentTenant?.id);
  const { data: roles, isLoading, isError } = useTenantRoles(tenantId);

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width={160} height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Roles
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage roles and their associated privileges
        </Typography>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load roles. Please try again.
        </Alert>
      )}

      <DataGrid
        rows={roles ?? []}
        columns={columns}
        autoHeight
        pageSizeOptions={[10, 25]}
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
    </Container>
  );
}
