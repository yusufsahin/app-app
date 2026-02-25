/**
 * Reusable checkbox group wired to React Hook Form via Controller.
 * Form value: string[] (selected option values). Use z.array(z.string()) in Zod.
 */
import { Controller } from "react-hook-form";
import { Checkbox, FormControl, FormControlLabel, FormGroup, FormHelperText, FormLabel } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfCheckboxGroupOption<T = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

type RhfCheckboxGroupProps<TFieldValues extends import("react-hook-form").FieldValues, T = string> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfCheckboxGroupOption<T>[];
    row?: boolean;
  };

export function RhfCheckboxGroup<TFieldValues extends import("react-hook-form").FieldValues, T = string>({
  name,
  control: controlProp,
  label,
  options,
  row = false,
  error,
  helperText,
}: RhfCheckboxGroupProps<TFieldValues, T>) {
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
        const selected = (Array.isArray(value) ? value : []) as T[];
        const toggle = (v: T) => {
          const next = selected.includes(v)
            ? selected.filter((x) => x !== v)
            : [...selected, v];
          onChange(next);
        };
        return (
          <FormControl error={!!errorMessage} component="fieldset" variant="standard">
            {label != null && label !== "" && <FormLabel component="legend" sx={{ mb: 0.5 }}>{label}</FormLabel>}
            <FormGroup row={row} ref={ref}>
              {options.map((opt) => (
                <FormControlLabel
                  key={String(opt.value)}
                  control={
                    <Checkbox
                      checked={selected.includes(opt.value as T)}
                      onChange={() => toggle(opt.value as T)}
                      onBlur={onBlur}
                      disabled={opt.disabled}
                    />
                  }
                  label={opt.label}
                />
              ))}
            </FormGroup>
            {displayText != null && displayText !== "" && (
              <FormHelperText sx={{ mt: 0.5 }}>{displayText}</FormHelperText>
            )}
          </FormControl>
        );
      }}
    />
  );
}
