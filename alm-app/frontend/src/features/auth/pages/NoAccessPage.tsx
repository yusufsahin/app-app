import { Container, Typography, Button, Stack } from "@mui/material";
import { Block } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../shared/stores/authStore";
import { hasPermission } from "../../../shared/utils/permissions";

export default function NoAccessPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const permissions = useAuthStore((s) => s.permissions);
  const canViewProjects = hasPermission(permissions, "project:read");

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
      <Block color="error" sx={{ fontSize: 64, mb: 2 }} />
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Access Denied
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        You don&apos;t have permission to view this page.
      </Typography>
      <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
        {canViewProjects && (
          <Button variant="contained" onClick={() => navigate("/")}>
            Go to Projects
          </Button>
        )}
        <Button variant="outlined" onClick={handleSignOut}>
          Sign out
        </Button>
      </Stack>
    </Container>
  );
}
