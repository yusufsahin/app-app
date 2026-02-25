/**
 * Reusable multi-select dropdown (Select with multiple) wired to React Hook Form via Controller.
 * Form value: T[]. Use z.array(z.string()).min(1) etc. in Zod.
 */
import { Controller } from "react-hook-form";
import {
  Checkbox,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  type SelectProps,
} from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import type { RhfSelectOption } from "./RhfSelect";
import { useRhfField } from "./useRhfField";

type RhfMultiSelectProps<TFieldValues extends import("react-hook-form").FieldValues, T = string> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfSelectOption<T>[];
    placeholder?: string;
    selectProps?: Omit<SelectProps, "value" | "onChange" | "onBlur" | "label" | "error" | "multiple">;
  };

export function RhfMultiSelect<TFieldValues extends import("react-hook-form").FieldValues, T = string>({
  name,
  control: controlProp,
  label,
  options,
  placeholder,
  error,
  helperText,
  selectProps,
}: RhfMultiSelectProps<TFieldValues, T>) {
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
        return (
          <FormControl fullWidth error={!!errorMessage} variant={selectProps?.variant ?? "outlined"}>
            {label && <InputLabel id={`${String(name)}-label`}>{label}</InputLabel>}
            <Select
              {...selectProps}
              multiple
              labelId={label ? `${String(name)}-label` : undefined}
              label={label}
              value={selected}
              onChange={(_, v) => onChange(v)}
              onBlur={onBlur}
              ref={ref}
              displayEmpty={!!placeholder}
              renderValue={(v) => {
                const arr: T[] = (v ?? []) as T[];
                if (arr.length === 0 && placeholder) return placeholder;
                const labels = options
                  .filter((o) => arr.some((a) => a === o.value || String(a) === String(o.value)))
                  .map((o) => o.label);
                return labels.join(", ");
              }}
            >
              {options.map((opt) => (
                <MenuItem key={String(opt.value)} value={opt.value as unknown as string} disabled={opt.disabled}>
                  <Checkbox checked={selected.includes(opt.value as T)} />
                  <ListItemText primary={opt.label} />
                </MenuItem>
              ))}
            </Select>
            {displayText != null && displayText !== "" && (
              <FormHelperText>{displayText}</FormHelperText>
            )}
          </FormControl>
        );
      }}
    />
  );
}
