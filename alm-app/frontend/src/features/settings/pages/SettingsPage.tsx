import { useMemo } from "react";
import { Box, Container, Typography, Card, CardContent, CardActionArea } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Folder, People, Security, VerifiedUser } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../shared/stores/authStore";
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
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const permissions = useAuthStore((s) => s.permissions);

  const visibleCards = useMemo(
    () => SETTING_CARDS.filter((c) => hasPermission(permissions, c.permission)),
    [permissions],
  );

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
    </Container>
  );
}
