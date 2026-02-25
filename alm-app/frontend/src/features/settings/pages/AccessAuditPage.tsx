import { useState } from "react";
import {
  Box,
  Container,
  Typography,
  Skeleton,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useAccessAudit, type AccessAuditEntry } from "../../../shared/api/adminApi";

const typeOptions = [
  { value: "", label: "All" },
  { value: "LOGIN_SUCCESS", label: "Login success" },
  { value: "LOGIN_FAILURE", label: "Login failure" },
];

export default function AccessAuditPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [limit, setLimit] = useState(200);

  const params = {
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    type_filter: typeFilter || undefined,
    limit,
  };
  const { data: entries, isLoading, isError } = useAccessAudit(params);

  const columns: GridColDef<AccessAuditEntry>[] = [
    {
      field: "timestamp",
      headerName: "Time",
      width: 180,
      valueFormatter: (value: string) => {
        if (!value) return "—";
        return new Date(value).toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "medium",
        });
      },
    },
    { field: "type", headerName: "Type", width: 140 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    { field: "ip", headerName: "IP", width: 140 },
    {
      field: "user_agent",
      headerName: "User agent",
      flex: 1.5,
      minWidth: 220,
    },
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
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Access audit
      </Typography>

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load audit log.
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
          alignItems: "center",
        }}
      >
        <TextField
          label="From date"
          type="date"
          size="small"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />
        <TextField
          label="To date"
          type="date"
          size="small"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {typeOptions.map((o) => (
              <MenuItem key={o.value || "all"} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Limit"
          type="number"
          size="small"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) || 200)}
          inputProps={{ min: 1, max: 1000 }}
          sx={{ width: 100 }}
        />
      </Box>

      <DataGrid
        rows={entries ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        pageSizeOptions={[25, 50, 100]}
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
    </Container>
  );
}
