import { Box, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import { AccountTree, Edit, FolderOff } from "@mui/icons-material";
import { Link, useParams } from "react-router-dom";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { StandardPageLayout } from "../../../shared/components/Layout/StandardPageLayout";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";

/**
 * Organization settings → Process manifest: list projects and link to each project's manifest editor.
 * Layout adapted from pamera-ui StandardPageLayout.
 */
export default function ProcessManifestListPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: projects = [], isLoading } = useOrgProjects(orgSlug);

  return (
    <SettingsPageWrapper>
      <StandardPageLayout
        breadcrumbs={<OrgSettingsBreadcrumbs currentPageLabel="Process manifest" />}
        title="Process manifest"
        description="Edit workflow, artifact types, and process template per project. Select a project to open its manifest."
      >
        {isLoading ? (
          <LoadingState label="Loading projects…" />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderOff />}
            title="No projects"
            description="There are no projects in this organization yet. Create a project to manage process manifests."
            bordered
          />
        ) : (
          <List disablePadding>
            {projects.map((project) => (
              <ListItemButton
                key={project.id}
                component={Link}
                to={orgSlug ? `/${orgSlug}/${project.slug}/manifest` : "#"}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  alignItems: "center",
                  textDecoration: "none",
                  color: "inherit",
                  "&:hover": { textDecoration: "none" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <AccountTree color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={project.name}
                  secondary={project.description ?? undefined}
                  primaryTypographyProps={{ fontWeight: 500 }}
                />
                <Box component="span" sx={{ display: "flex", alignItems: "center", ml: 1 }}>
                  <Edit fontSize="small" color="action" />
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </StandardPageLayout>
    </SettingsPageWrapper>
  );
}
