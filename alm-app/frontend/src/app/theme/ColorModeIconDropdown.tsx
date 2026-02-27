import * as React from "react";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import IconButton, { type IconButtonOwnProps } from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useColorScheme } from "@mui/material/styles";

export default function ColorModeIconDropdown(buttonProps: IconButtonOwnProps) {
  const colorScheme = useColorScheme();
  const { mode, setMode } = colorScheme ?? {};
  const { ...rest } = buttonProps;
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleMode = (targetMode: "system" | "light" | "dark") => () => {
    setMode?.(targetMode);
    handleClose();
  };

  const resolvedMode = (mode === "system" ? undefined : mode) as "light" | "dark" | undefined;
  const icon =
    resolvedMode === "dark" ? (
      <DarkModeRoundedIcon fontSize="small" />
    ) : (
      <LightModeRoundedIcon fontSize="small" />
    );

  if (typeof setMode !== "function") {
    return null;
  }

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{
          verticalAlign: "bottom",
          display: "inline-flex",
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: (theme) => (theme.vars ? theme.vars.shape.borderRadius : 8),
          border: "1px solid",
          borderColor: "divider",
        }}
        aria-label="Toggle color mode"
        {...rest}
      >
        {icon}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 160, mt: 1.5 } } }}
      >
        <MenuItem onClick={handleMode("system")}>System</MenuItem>
        <MenuItem onClick={handleMode("light")}>Light</MenuItem>
        <MenuItem onClick={handleMode("dark")}>Dark</MenuItem>
      </Menu>
    </>
  );
}
