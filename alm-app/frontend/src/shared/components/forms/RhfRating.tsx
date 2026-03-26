/**
 * Reusable Rating (stars) wired to React Hook Form via Controller.
 * Form value: number (e.g. 0–5). Use z.number().min(0).max(5) in Zod.
 */
import { Controller } from "react-hook-form";
import { Star } from "lucide-react";
import { Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfRatingProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    max?: number;
  };

export function RhfRating<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  max = 5,
  error,
  helperText,
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
      render={({ field: { value, onChange, onBlur, ref } }) => {
        const v = typeof value === "number" ? value : 0;
        return (
          <FormItem>
            {label != null && label !== "" && <Label>{label}</Label>}
            <FormControl>
              <div className="flex gap-0.5" ref={ref} onBlur={onBlur} role="group" aria-label={typeof label === "string" ? label : "Rating"}>
                {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    className="rounded p-0.5 text-muted-foreground hover:text-amber-500 focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  >
                    <Star className={`size-6 ${v >= star ? "fill-amber-500 text-amber-500" : ""}`} />
                  </button>
                ))}
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
