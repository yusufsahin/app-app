/**
 * Reusable Select wired to React Hook Form via Controller.
 * Use inside a form wrapped with FormProvider, or pass control explicitly.
 */
import { Controller } from "react-hook-form";
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  type SelectProps,
} from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfSelectOption<T = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

type RhfSelectProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfSelectOption[];
    placeholder?: string;
    selectProps?: Omit<SelectProps, "value" | "onChange" | "onBlur" | "label" | "error">;
  };

export function RhfSelect<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  options,
  placeholder,
  error,
  helperText,
  selectProps,
}: RhfSelectProps<TFieldValues>) {
  const { control, errorMessage, displayText } = useRhfField<TFieldValues>(name, {
    control: controlProp,
    error,
    helperText,
  });

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur, ref } }) => (
        <FormControl fullWidth error={!!errorMessage} variant={selectProps?.variant ?? "outlined"}>
          {label != null && label !== "" && (
            <InputLabel id={`${String(name)}-label`}>{label}</InputLabel>
          )}
          <Select
            {...selectProps}
            labelId={label != null && label !== "" ? `${String(name)}-label` : undefined}
            label={label}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            ref={ref}
            displayEmpty={!!placeholder}
            renderValue={(v) => {
              if ((v === "" || v == null) && placeholder) return placeholder;
              const opt = options.find((o) => o.value === v);
              return opt ? opt.label : String(v);
            }}
          >
            {placeholder != null && placeholder !== "" && (
              <MenuItem value="" disabled>
                {placeholder}
              </MenuItem>
            )}
            {options.map((opt) => (
              <MenuItem key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
          {displayText != null && displayText !== "" && (
            <FormHelperText>{displayText}</FormHelperText>
          )}
        </FormControl>
      )}
    />
  );
}
