/**
 * Reusable number input wired to React Hook Form via Controller.
 * Form value: number (not string). Use z.number().min().max() in Zod.
 */
import { Controller } from "react-hook-form";
import { TextField, type TextFieldProps } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfNumberInputProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    min?: number;
    max?: number;
    step?: number;
    textFieldProps?: Omit<TextFieldProps, "value" | "onChange" | "onBlur" | "error" | "helperText" | "type">;
  };

export function RhfNumberInput<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  min,
  max,
  step,
  error,
  helperText,
  textFieldProps,
}: RhfNumberInputProps<TFieldValues>) {
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
        <TextField
          {...textFieldProps}
          type="number"
          label={label}
          value={value === undefined || value === null ? "" : value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
          onBlur={onBlur}
          inputRef={ref}
          error={!!errorMessage}
          helperText={displayText}
          InputProps={textFieldProps?.InputProps}
          inputProps={{
            ...textFieldProps?.inputProps,
            min,
            max,
            step,
          }}
        />
      )}
    />
  );
}
