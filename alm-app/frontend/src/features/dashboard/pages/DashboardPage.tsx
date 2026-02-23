import { useParams } from "react-router-dom";
import { Container, Typography, Card, CardContent, CircularProgress } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useOrgDashboardStats } from "../../../shared/api/orgApi";

export default function DashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: stats, isLoading, error } = useOrgDashboardStats(orgSlug);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Projects
              </Typography>
              {isLoading ? (
                <CircularProgress size={32} />
              ) : (
                <Typography variant="h3">{stats?.projects ?? 0}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Artifacts
              </Typography>
              {isLoading ? (
                <CircularProgress size={32} />
              ) : (
                <Typography variant="h3">{stats?.artifacts ?? 0}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Tasks
              </Typography>
              {isLoading ? (
                <CircularProgress size={32} />
              ) : (
                <Typography variant="h3">{stats?.tasks ?? 0}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Open Defects
              </Typography>
              {isLoading ? (
                <CircularProgress size={32} />
              ) : (
                <Typography variant="h3">{stats?.openDefects ?? 0}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          Failed to load dashboard stats
        </Typography>
      )}
    </Container>
  );
}
