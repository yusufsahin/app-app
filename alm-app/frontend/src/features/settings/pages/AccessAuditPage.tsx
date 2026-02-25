import {
  Box,
  Typography,
  Skeleton,
  Alert,
} from "@mui/material";
import { useForm, FormProvider } from "react-hook-form";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
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
      <SettingsPageWrapper>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <OrgSettingsBreadcrumbs currentPageLabel="Access audit" />
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          Access audit
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          View login and access audit log for this organization.
        </Typography>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load audit log.
        </Alert>
      )}

      <FormProvider {...form}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Filters
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            mb: 3,
            alignItems: "center",
          }}
        >
          <RhfTextField<FilterFormValues>
            name="from_date"
            label="From date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <RhfTextField<FilterFormValues>
            name="to_date"
            label="To date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <Box sx={{ minWidth: 160 }}>
            <RhfSelect<FilterFormValues>
              name="type_filter"
              control={form.control}
              label="Type"
              options={typeOptions}
              selectProps={{ size: "small" }}
            />
          </Box>
          <RhfTextField<FilterFormValues>
            name="limit"
            label="Limit"
            type="number"
            size="small"
            inputProps={{ min: 1, max: 1000 }}
            sx={{ width: 100 }}
          />
        </Box>
      </FormProvider>

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
    </SettingsPageWrapper>
  );
}
