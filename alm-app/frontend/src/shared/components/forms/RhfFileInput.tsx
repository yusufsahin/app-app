/**
 * Reusable file input wired to React Hook Form via Controller.
 * Form value: File | File[] | null. Use z.instanceof(File).nullable() or z.array(z.instanceof(File)) in Zod.
 */
import { Controller } from "react-hook-form";
import { Button, FormControl, FormHelperText, FormLabel, Typography } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfFileInputProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    multiple?: boolean;
    accept?: string;
    buttonLabel?: string;
    disabled?: boolean;
  };

export function RhfFileInput<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  multiple = false,
  accept,
  buttonLabel = "Choose file(s)",
  disabled,
  error,
  helperText,
}: RhfFileInputProps<TFieldValues>) {
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
        const files: File[] | File | null = multiple
          ? (Array.isArray(value) ? value : [])
          : (value as File | null);
        const display = multiple
          ? (files as File[]).map((f) => f.name).join(", ") || "No files chosen"
          : (files as File | null)?.name ?? "No file chosen";
        return (
          <FormControl fullWidth error={!!errorMessage} disabled={disabled} component="fieldset" variant="standard">
            {label != null && label !== "" && <FormLabel component="legend" sx={{ mb: 0.5 }}>{label}</FormLabel>}
            <Button
              variant="outlined"
              component="label"
              disabled={disabled}
              sx={{ alignSelf: "flex-start" }}
            >
              {buttonLabel}
              <input
                ref={ref}
                type="file"
                hidden
                multiple={multiple}
                accept={accept}
                onChange={(e) => {
                  const list = e.target.files;
                  if (!list?.length) return;
                  onChange((multiple ? Array.from(list) : list[0] ?? null) as File | File[] | null);
                }}
                onBlur={onBlur}
              />
            </Button>
            {display && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {display}
              </Typography>
            )}
            {displayText != null && displayText !== "" && (
              <FormHelperText sx={{ mt: 0.5 }}>{displayText}</FormHelperText>
            )}
          </FormControl>
        );
      }}
    />
  );
}
