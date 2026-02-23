import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Chip,
  Skeleton,
  Alert,
} from "@mui/material";
import { ArrowBack, AccountTree, Policy } from "@mui/icons-material";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectManifest } from "../../../shared/api/manifestApi";

export default function ManifestPage() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const navigate = useNavigate();
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);

  const {
    data: manifest,
    isLoading,
    isError,
  } = useProjectManifest(orgSlug, project?.id);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "..")}
        sx={{ mb: 3 }}
      >
        Back to project
      </Button>

      {!project && projectSlug ? (
        <Typography color="text.secondary">Project &quot;{projectSlug}&quot; not found.</Typography>
      ) : isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
        </Box>
      ) : isError ? (
        <Alert severity="warning">
          This project has no process template assigned, or you don&apos;t have permission to view the manifest.
        </Alert>
      ) : manifest ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="h4" fontWeight={700}>
              Process Manifest
            </Typography>
            <Chip label={manifest.template_name} size="small" color="primary" />
            <Typography variant="body2" color="text.secondary">
              v{manifest.version}
            </Typography>
          </Box>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="overline" color="primary" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <AccountTree fontSize="small" />
              Workflows
            </Typography>
            {manifest.manifest_bundle.workflows &&
            manifest.manifest_bundle.workflows.length > 0 ? (
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                {JSON.stringify(manifest.manifest_bundle.workflows, null, 2)}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No workflows defined.
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="overline" color="primary" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Policy fontSize="small" />
              Policies
            </Typography>
            {manifest.manifest_bundle.policies &&
            manifest.manifest_bundle.policies.length > 0 ? (
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                {JSON.stringify(manifest.manifest_bundle.policies, null, 2)}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No policies defined.
              </Typography>
            )}
          </Paper>
        </Box>
      ) : null}
    </Container>
  );
}
