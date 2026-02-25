import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Card,
  CardContent,
  Chip,
} from "@mui/material";
import { Archive, Business } from "@mui/icons-material";
import { apiClient } from "../../../shared/api/client";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles);
  const isAdmin = roles.includes("admin");

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const currentTenant = useTenantStore((s) => s.currentTenant);
  const clearTenant = useTenantStore((s) => s.clearTenant);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const handleArchiveOrg = async () => {
    if (!currentTenant?.id) return;
    setArchiving(true);
    try {
      await apiClient.delete(`/tenants/${currentTenant.id}`);
      showNotification("Organization archived");
      clearTenant();
      setArchiveDialogOpen(false);
      navigate("/select-tenant", { replace: true });
    } catch (err: unknown) {
      const problem = err as { detail?: string };
      showNotification(problem.detail ?? "Failed to archive organization", "error");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <SettingsPageWrapper>
      <OrgSettingsBreadcrumbs currentPageLabel="Overview" />
      <Typography component="h1" variant="h4" gutterBottom>
        Organization settings
      </Typography>

      {/* Organization info */}
      <Card variant="outlined" sx={{ mb: 3, maxWidth: 560 }}>
        <CardContent>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <Business fontSize="small" />
            General
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Name
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {currentTenant?.name ?? "—"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Slug
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {currentTenant?.slug ?? "—"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Tier
              </Typography>
              <Box sx={{ mt: 0.25 }}>
                <Chip
                  label={currentTenant?.tier ?? "—"}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Danger zone (admin only) */}
      {isAdmin && (
        <Box sx={{ maxWidth: 560 }}>
          <Typography variant="h6" color="error" gutterBottom>
            Danger zone
          </Typography>
          <Card variant="outlined" sx={{ borderColor: "error.light" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Archiving this organization will soft-delete it. Only admins can archive. You will
                be redirected to tenant selection.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Archive />}
                onClick={() => setArchiveDialogOpen(true)}
              >
                Archive organization
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

      <Dialog open={archiveDialogOpen} onClose={() => !archiving && setArchiveDialogOpen(false)}>
        <DialogTitle>Archive organization?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will archive the current organization. You will need to select another organization
            or log out. This action can be reversed by a system administrator. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveDialogOpen(false)} disabled={archiving}>
            Cancel
          </Button>
          <Button color="error" onClick={handleArchiveOrg} disabled={archiving} variant="contained">
            {archiving ? "Archiving…" : "Archive"}
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsPageWrapper>
  );
}
