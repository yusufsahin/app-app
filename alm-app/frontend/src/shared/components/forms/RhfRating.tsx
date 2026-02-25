/**
 * Reusable Rating (stars) wired to React Hook Form via Controller.
 * Form value: number (e.g. 0–5). Use z.number().min(0).max(5) in Zod.
 */
import { Controller } from "react-hook-form";
import { FormControl, FormHelperText, FormLabel, Rating, type RatingProps } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfRatingProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    max?: number;
    precision?: 0.5 | 1;
    size?: "small" | "medium" | "large";
    ratingProps?: Omit<RatingProps, "value" | "onChange" | "onBlur" | "max" | "precision" | "size">;
  };

export function RhfRating<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  max = 5,
  precision = 1,
  size = "medium",
  error,
  helperText,
  ratingProps,
}: RhfRatingProps<TFieldValues>) {
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
          {label != null && label !== "" && <FormLabel component="legend" sx={{ mb: 0.5 }}>{label}</FormLabel>}
          <Rating
            {...ratingProps}
            name={String(name)}
            value={typeof value === "number" ? value : 0}
            onChange={(_, newValue) => onChange(newValue ?? 0)}
            onBlur={onBlur}
            ref={ref}
            max={max}
            precision={precision}
            size={size}
          />
          {displayText != null && displayText !== "" && (
            <FormHelperText>{displayText}</FormHelperText>
          )}
        </FormControl>
      )}
    />
  );
}
