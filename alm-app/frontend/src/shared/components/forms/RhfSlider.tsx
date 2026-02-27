/**
 * Reusable Slider wired to React Hook Form via Controller.
 * Form value: number. Use z.number().min().max() in Zod.
 */
import { Controller } from "react-hook-form";
import { Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfSliderProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    min?: number;
    max?: number;
    step?: number;
  };

export function RhfSlider<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  min = 0,
  max = 100,
  step = 1,
  error,
  helperText,
}: RhfSliderProps<TFieldValues>) {
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
            <div className="pt-1 pb-0.5">
              <input
                type="range"
                ref={ref}
                min={min}
                max={max}
                step={step}
                value={value ?? min}
                onChange={(e) => onChange(Number(e.target.value))}
                onBlur={onBlur}
                className="w-full"
                aria-invalid={!!errorMessage}
              />
              <span className="text-sm text-muted-foreground">{value ?? min}</span>
            </div>
          </FormControl>
          {(displayText != null && displayText !== "") || errorMessage ? (
            <FormMessage>{errorMessage ?? displayText}</FormMessage>
          ) : null}
        </FormItem>
      )}
    />
  );
}
