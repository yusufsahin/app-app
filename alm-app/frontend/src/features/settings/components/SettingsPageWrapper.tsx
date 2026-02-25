import { Box, Container } from "@mui/material";
import { SettingsSubNav } from "./SettingsSubNav";

interface SettingsPageWrapperProps {
  children: React.ReactNode;
}

/**
 * Wraps settings sub-pages with left sub-navigation and content area.
 * Use on Members, Roles, Privileges, Access audit, and optionally Overview.
 */
export function SettingsPageWrapper({ children }: SettingsPageWrapperProps) {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start" }}>
        <SettingsSubNav />
        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      </Box>
    </Container>
  );
}
