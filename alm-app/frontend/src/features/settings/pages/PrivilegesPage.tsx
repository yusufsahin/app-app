import {
  Box,
  Skeleton,
  Typography,
  Alert,
  Chip,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { usePrivileges, type Privilege } from "../../../shared/api/tenantApi";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";

const columns: GridColDef<Privilege>[] = [
  {
    field: "code",
    headerName: "Code",
    flex: 1,
    minWidth: 180,
    renderCell: (params) => (
      <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
        {params.row.code}
      </Typography>
    ),
  },
  {
    field: "resource",
    headerName: "Resource",
    width: 120,
    renderCell: (params) => (
      <Chip label={params.row.resource} size="small" variant="outlined" />
    ),
  },
  {
    field: "action",
    headerName: "Action",
    width: 100,
  },
  {
    field: "description",
    headerName: "Description",
    flex: 2,
    minWidth: 200,
  },
];

export default function PrivilegesPage() {
  const { data: privileges, isLoading, isError } = usePrivileges();

  if (isLoading) {
    return (
      <SettingsPageWrapper>
        <Skeleton variant="text" width={160} height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <OrgSettingsBreadcrumbs currentPageLabel="Privileges" />
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Privileges
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Available privileges (read-only). Assign to roles via Roles settings.
        </Typography>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load privileges. Please try again.
        </Alert>
      )}

      <DataGrid
        rows={privileges ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
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
    </SettingsPageWrapper>
  );
}
