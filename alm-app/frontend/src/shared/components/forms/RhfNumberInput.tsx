/**
 * Reusable number input wired to React Hook Form via Controller.
 * Form value: number (not string). Use z.number().min().max() in Zod.
 */
import { Controller } from "react-hook-form";
import { Input, Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfNumberInputProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    min?: number;
    max?: number;
    step?: number;
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
        <FormItem>
          {label != null && label !== "" && <Label>{label}</Label>}
          <FormControl>
            <Input
              type="number"
              value={value === undefined || value === null ? "" : value}
              onChange={(e) => {
                const v = e.target.value;
                onChange(v === "" ? undefined : Number(v));
              }}
              onBlur={onBlur}
              ref={ref}
              min={min}
              max={max}
              step={step}
              aria-invalid={!!errorMessage}
            />
          </FormControl>
          {(displayText != null && displayText !== "") || errorMessage ? (
            <FormMessage>{errorMessage ?? displayText}</FormMessage>
          ) : null}
        </FormItem>
      )}
    />
  );
}
