/**
 * Reusable ToggleButtonGroup wired to React Hook Form via Controller.
 * Form value: string (exclusive) or string[] (multiple). Use z.string() or z.array(z.string()) in Zod.
 */
import { Controller } from "react-hook-form";
import { FormControl, FormHelperText, FormLabel, ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfToggleOption<T = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

type RhfToggleButtonGroupProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfToggleOption[];
    multiple?: boolean;
    exclusive?: boolean;
    size?: "small" | "medium" | "large";
    fullWidth?: boolean;
  };

export function RhfToggleButtonGroup<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  options,
  multiple = false,
  exclusive,
  size = "medium",
  fullWidth,
  error,
  helperText,
}: RhfToggleButtonGroupProps<TFieldValues>) {
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
        const val = value ?? (multiple ? [] : "");
        return (
          <FormControl error={!!errorMessage} component="fieldset" variant="standard" fullWidth={fullWidth}>
            {label != null && label !== "" && <FormLabel component="legend" sx={{ mb: 0.5 }}>{label}</FormLabel>}
            <ToggleButtonGroup
              value={val}
              onChange={(_, newValue) => {
                if (newValue != null) onChange(newValue);
              }}
              onBlur={onBlur}
              ref={ref}
              exclusive={exclusive ?? !multiple}
              size={size}
              fullWidth={fullWidth}
              aria-label={typeof label === "string" ? label : undefined}
            >
              {options.map((opt) => (
                <ToggleButton key={String(opt.value)} value={opt.value} disabled={opt.disabled} aria-label={String(opt.value)}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {displayText != null && displayText !== "" && (
              <FormHelperText sx={{ mt: 0.5 }}>{displayText}</FormHelperText>
            )}
          </FormControl>
        );
      }}
    />
  );
}
