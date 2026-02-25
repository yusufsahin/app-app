/**
 * Reusable Slider wired to React Hook Form via Controller.
 * Form value: number. Use z.number().min().max() in Zod.
 */
import { Controller } from "react-hook-form";
import { FormControl, FormHelperText, FormLabel, Slider, type SliderProps } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfSliderProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    min?: number;
    max?: number;
    step?: number;
    valueLabelDisplay?: "auto" | "on" | "off";
    marks?: boolean | Array<{ value: number; label?: React.ReactNode }>;
    sliderProps?: Omit<SliderProps, "value" | "onChange" | "onBlur" | "min" | "max" | "step" | "marks" | "valueLabelDisplay">;
  };

export function RhfSlider<TFieldValues extends import("react-hook-form").FieldValues>({
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
        <FormControl fullWidth error={!!errorMessage} sx={{ pt: 1, pb: 0.5 }}>
          {label != null && label !== "" && <FormLabel sx={{ mb: 0.5 }}>{label}</FormLabel>}
          <Slider
            {...sliderProps}
            value={value ?? min}
            onChange={(_, v) => onChange(v)}
            onBlur={onBlur}
            ref={ref}
            min={min}
            max={max}
            step={step}
            valueLabelDisplay={valueLabelDisplay}
            marks={marksProp}
          />
          {displayText != null && displayText !== "" && (
            <FormHelperText sx={{ mt: 0.5 }}>{displayText}</FormHelperText>
          )}
        </FormControl>
      )}
    />
  );
}
