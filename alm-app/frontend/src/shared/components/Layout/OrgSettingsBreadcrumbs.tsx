import { Link, useParams } from "react-router-dom";
import { Box, Breadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { useTenantStore } from "../../stores/tenantStore";

export interface OrgSettingsBreadcrumbsProps {
  /** Current page label (e.g. "Members", "Access audit", "Overview") */
  currentPageLabel: string;
}

/**
 * Breadcrumbs for organization-level settings: Org > Organization settings > [Page].
 */
export function OrgSettingsBreadcrumbs({ currentPageLabel }: OrgSettingsBreadcrumbsProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const currentTenant = useTenantStore((s) => s.currentTenant);
  const orgDisplayName = currentTenant?.name ?? orgSlug ?? "Organization";
  const orgPath = orgSlug ? `/${orgSlug}` : "#";
  const settingsPath = orgSlug ? `/${orgSlug}/settings` : "#";

  return (
    <Box sx={{ mb: 2 }}>
      <Breadcrumbs>
        <MuiLink component={Link} to={orgPath} underline="hover" color="inherit">
          {orgDisplayName}
        </MuiLink>
        <MuiLink component={Link} to={settingsPath} underline="hover" color="inherit">
          Organization settings
        </MuiLink>
        <Typography color="text.primary">{currentPageLabel}</Typography>
      </Breadcrumbs>
    </Box>
  );
}
