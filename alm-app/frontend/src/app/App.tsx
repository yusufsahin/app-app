import { Box, CssBaseline } from "@mui/material";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

export function App() {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />
      <RouterProvider router={router} />
    </Box>
  );
}
