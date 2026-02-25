import { createTheme } from "@mui/material/styles";

/**
 * Design tokens and typography scale for consistent UX.
 * - Page title: h4 (semantic h1 in layout for a11y where needed)
 * - Section title: h5 or h6
 * - Card/subsection: h6
 * - Spacing: 8px base (theme.spacing(1)); page sections use 2–3, modal actions use 2
 */
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1565c0",
      light: "#5e92f3",
      dark: "#003c8f",
    },
    secondary: {
      main: "#00897b",
      light: "#4ebaaa",
      dark: "#005b4f",
    },
    background: {
      default: "#f5f5f5",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: "2rem" },
    h2: { fontWeight: 700, fontSize: "1.75rem" },
    h3: { fontWeight: 600, fontSize: "1.5rem" },
    h4: { fontWeight: 600, fontSize: "1.375rem" },
    h5: { fontWeight: 600, fontSize: "1.125rem" },
    h6: { fontWeight: 600, fontSize: "1rem" },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
        },
      },
    },
  },
});
