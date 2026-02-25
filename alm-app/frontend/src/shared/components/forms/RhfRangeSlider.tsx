/**
 * Reusable range slider (two thumbs) wired to React Hook Form via Controller.
 * Form value: [number, number]. Use z.tuple([z.number(), z.number()]) in Zod.
 */
import { Controller } from "react-hook-form";
import { FormControl, FormHelperText, FormLabel, Slider, type SliderProps } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfRangeSliderProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    min?: number;
    max?: number;
    step?: number;
    valueLabelDisplay?: "auto" | "on" | "off";
    marks?: boolean | Array<{ value: number; label?: React.ReactNode }>;
    sliderProps?: Omit<SliderProps, "value" | "onChange" | "onBlur" | "min" | "max" | "step" | "marks" | "valueLabelDisplay">;
  };

export function RhfRangeSlider<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  min = 0,
  max = 100,
  step = 1,
  valueLabelDisplay = "auto",
  marks: marksProp,
  error,
  helperText,
  sliderProps,
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
        const clamped: [number, number] = [
          Math.min(Math.max(range[0] ?? min, min), max),
          Math.min(Math.max(range[1] ?? max, min), max),
        ];
        return (
        <FormControl fullWidth error={!!errorMessage} sx={{ pt: 1, pb: 0.5 }}>
          {label != null && label !== "" && <FormLabel sx={{ mb: 0.5 }}>{label}</FormLabel>}
            <Slider
              {...sliderProps}
              value={clamped}
              onChange={(_, v) => onChange(v as [number, number])}
              onBlur={onBlur}
              ref={ref}
              min={min}
              max={max}
              step={step}
              valueLabelDisplay={valueLabelDisplay}
              marks={marksProp}
              valueLabelFormat={(v) => v}
            />
            {displayText != null && displayText !== "" && (
              <FormHelperText sx={{ mt: 0.5 }}>{displayText}</FormHelperText>
            )}
          </FormControl>
        );
      }}
    />
  );
}
