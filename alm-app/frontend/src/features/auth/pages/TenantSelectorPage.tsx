import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Business } from "@mui/icons-material";
import { useSwitchTenant } from "../../../shared/api/authApi";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useTenantStore } from "../../../shared/stores/tenantStore";

interface LocationState {
  tempToken: string;
  tenants: { id: string; name: string; slug: string; tier: string }[];
}

export default function TenantSelectorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const switchTenant = useSwitchTenant();
  const setTokens = useAuthStore((s) => s.setTokens);
  const accessToken = useAuthStore((s) => s.accessToken);
  const storedTenants = useTenantStore((s) => s.tenants);
  const setTenant = useTenantStore((s) => s.setTenant);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const state = location.state as LocationState | null;
  const tenants = state?.tenants ?? storedTenants;
  const token = state?.tempToken ?? accessToken;

  if (!token || tenants.length === 0) {
    return <Navigate to="/login" replace />;
  }

  const handleSelect = async (tenantId: string) => {
    setError(null);
    setSwitchingId(tenantId);
    try {
      const result = await switchTenant.mutateAsync({ tenantId, token });
      setTokens(result.access_token, result.refresh_token);
      const selected = tenants.find((t) => t.id === tenantId);
      if (selected) {
        setTenant(selected);
      }
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const problem = err as { detail?: string; message?: string };
      setError(problem.detail ?? problem.message ?? "Failed to select organization.");
      setSwitchingId(null);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <Typography variant="h4" fontWeight={700} color="primary.main" gutterBottom>
        ALM Manifest
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
        Select an organization
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, maxWidth: 600, width: "100%" }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ maxWidth: 720 }} justifyContent="center">
        {tenants.map((tenant) => (
          <Grid key={tenant.id} size={{ xs: 12, sm: 6 }}>
            <Card
              sx={{
                height: "100%",
                transition: "box-shadow 0.2s, transform 0.2s",
                "&:hover": {
                  boxShadow: 6,
                  transform: "translateY(-2px)",
                },
              }}
            >
              <CardActionArea
                onClick={() => handleSelect(tenant.id)}
                disabled={switchTenant.isPending}
                sx={{ p: 3, height: "100%" }}
              >
                <CardContent sx={{ textAlign: "center", p: 0 }}>
                  {switchingId === tenant.id ? (
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                  ) : (
                    <Business
                      sx={{ fontSize: 48, color: "primary.main", mb: 2 }}
                    />
                  )}
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {tenant.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {tenant.slug}
                  </Typography>
                  {tenant.tier && (
                    <Chip
                      label={tenant.tier}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
