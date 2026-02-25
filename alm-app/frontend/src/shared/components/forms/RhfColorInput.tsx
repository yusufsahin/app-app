/**
 * Reusable color input wired to React Hook Form via Controller.
 * Form value: string (e.g. hex #ffffff). Use z.string().regex(/^#[0-9A-Fa-f]{6}$/) in Zod.
 */
import { Controller } from "react-hook-form";
import { Box, FormControl, FormLabel, TextField } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfColorInputProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    showSwatch?: boolean;
  };

export function RhfColorInput<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  showSwatch = true,
  error,
  helperText,
}: RhfColorInputProps<TFieldValues>) {
  const { control, errorMessage, displayText } = useRhfField<TFieldValues>(name, {
    control: controlProp,
    error,
    helperText,
  });

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur, ref } }) => {
        const str = value == null ? "#000000" : String(value);
        return (
          <FormControl fullWidth error={!!errorMessage} component="fieldset" variant="standard">
            {label != null && label !== "" && <FormLabel component="legend" sx={{ mb: 0.5 }}>{label}</FormLabel>}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              {showSwatch && (
                <Box
                  component="input"
                  type="color"
                  value={str.startsWith("#") ? str : `#${str}`}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlur}
                  sx={{
                    width: 40,
                    height: 40,
                    padding: 0,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    cursor: "pointer",
                  }}
                />
              )}
              <TextField
                size="small"
                value={str}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                inputRef={ref}
                placeholder="#000000"
                error={!!errorMessage}
                helperText={displayText}
                inputProps={{ "aria-label": typeof label === "string" ? label : "Color" }}
                sx={{ minWidth: 120 }}
              />
            </Box>
          </FormControl>
        );
      }}
    />
  );
}
