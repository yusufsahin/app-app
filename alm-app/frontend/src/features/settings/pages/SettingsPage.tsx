import { useMemo, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Folder, People, Security, VerifiedUser, History, Archive } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../../shared/api/client";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { hasPermission } from "../../../shared/utils/permissions";

interface SettingCard {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  permission: string;
}

const SETTING_CARDS: SettingCard[] = [
  {
    title: "Projects",
    description: "View and manage projects",
    path: "..",
    icon: <Folder color="primary" sx={{ fontSize: 40 }} />,
    permission: "project:read",
  },
  {
    title: "Members",
    description: "Manage tenant members and invitations",
    path: "../members",
    icon: <People color="primary" sx={{ fontSize: 40 }} />,
    permission: "member:read",
  },
  {
    title: "Roles",
    description: "Manage roles and their privilege assignments",
    path: "../roles",
    icon: <Security color="primary" sx={{ fontSize: 40 }} />,
    permission: "role:read",
  },
  {
    title: "Privileges",
    description: "View available privileges (resource:action)",
    path: "../privileges",
    icon: <VerifiedUser color="primary" sx={{ fontSize: 40 }} />,
    permission: "role:read",
  },
  {
    title: "Access audit",
    description: "View login and access audit log",
    path: "../audit",
    icon: <History color="primary" sx={{ fontSize: 40 }} />,
    permission: "admin:audit", // shown only when user has admin role
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const permissions = useAuthStore((s) => s.permissions);
  const roles = useAuthStore((s) => s.roles);
  const isAdmin = roles.includes("admin");

  const visibleCards = useMemo(
    () =>
      SETTING_CARDS.filter((c) =>
        c.permission === "admin:audit"
          ? isAdmin
          : hasPermission(permissions, c.permission),
      ),
    [permissions, isAdmin],
  );

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
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Settings
      </Typography>
      <Grid container spacing={3}>
        {visibleCards.map((card) => (
          <Grid key={card.path} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardActionArea onClick={() => navigate(card.path)}>
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {card.icon}
                  <Box>
                    <Typography variant="h6">{card.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {isAdmin && (
        <Box sx={{ mt: 6 }}>
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
    </Container>
  );
}
