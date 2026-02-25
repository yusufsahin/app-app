/**
 * Reusable RadioGroup wired to React Hook Form via Controller.
 * Use inside a form wrapped with FormProvider, or pass control explicitly.
 */
import { Controller } from "react-hook-form";
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  type RadioGroupProps,
} from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfRadioOption<T = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

type RhfRadioGroupProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfRadioOption[];
    row?: boolean;
    radioGroupProps?: Omit<RadioGroupProps, "value" | "onChange" | "onBlur">;
  };

export function RhfRadioGroup<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  options,
  row = false,
  error,
  helperText,
  radioGroupProps,
}: RhfRadioGroupProps<TFieldValues>) {
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
        <FormControl error={!!errorMessage} component="fieldset" variant="standard">
          {label != null && label !== "" && <FormLabel component="legend">{label}</FormLabel>}
          <RadioGroup
            {...radioGroupProps}
            row={row}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            ref={ref}
          >
            {options.map((opt) => (
              <FormControlLabel
                key={String(opt.value)}
                value={opt.value}
                control={<Radio />}
                label={opt.label}
                disabled={opt.disabled}
              />
            ))}
          </RadioGroup>
          {displayText != null && displayText !== "" && (
            <FormHelperText>{displayText}</FormHelperText>
          )}
        </FormControl>
      )}
    />
  );
}
