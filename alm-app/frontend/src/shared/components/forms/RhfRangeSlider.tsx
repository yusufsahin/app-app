/**
 * Reusable range slider (two thumbs) wired to React Hook Form via Controller.
 * Form value: [number, number]. Use z.tuple([z.number(), z.number()]) in Zod.
 */
import { Controller } from "react-hook-form";
import { Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfRangeSliderProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    min?: number;
    max?: number;
    step?: number;
  };

export function RhfRangeSlider<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  min = 0,
  max = 100,
  step = 1,
  error,
  helperText,
}: RhfRangeSliderProps<TFieldValues>) {
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
        const range = (Array.isArray(value) ? value : [min, max]) as [number, number];
        const [a, b] = [
          Math.min(Math.max(range[0] ?? min, min), max),
          Math.min(Math.max(range[1] ?? max, min), max),
        ];
        return (
          <FormItem>
            {label != null && label !== "" && <Label>{label}</Label>}
            <FormControl>
              <div ref={ref} className="flex items-center gap-2 pt-1 pb-0.5">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={a}
                  onChange={(e) => onChange([Number(e.target.value), b])}
                  onBlur={onBlur}
                  className="flex-1"
                />
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={b}
                  onChange={(e) => onChange([a, Number(e.target.value)])}
                  onBlur={onBlur}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">{a} – {b}</span>
              </div>
            </FormControl>
            {(displayText != null && displayText !== "") || errorMessage ? (
              <FormMessage>{errorMessage ?? displayText}</FormMessage>
            ) : null}
          </FormItem>
        );
      }}
    />
  );
}
