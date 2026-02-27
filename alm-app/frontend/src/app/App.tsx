import { Box, CssBaseline, InitColorSchemeScript } from "@mui/material";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

export function App() {
  return (
    <>
      <InitColorSchemeScript defaultMode="system" />
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <CssBaseline enableColorScheme />
        <RouterProvider router={router} />
      </Box>
    </>
  );
}
