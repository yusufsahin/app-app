/**
 * Checkbox wired to React Hook Form via Controller. Radix UI + Tailwind.
 */
import { Controller } from "react-hook-form";
import { Checkbox, Label } from "../ui";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfCheckboxProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    checkboxProps?: {
      size?: "small" | "medium";
      className?: string;
      "aria-label"?: string;
      [key: string]: unknown;
    };
  };

export function RhfCheckbox<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  error,
  helperText,
  checkboxProps,
}: RhfCheckboxProps<TFieldValues>) {
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id={String(name)}
              ref={ref}
              checked={!!value}
              onCheckedChange={(checked) => onChange(!!checked)}
              onBlur={onBlur}
              aria-invalid={!!errorMessage}
              aria-describedby={displayText ? `${String(name)}-helper` : undefined}
              {...checkboxProps}
            />
            {label != null && label !== "" && (
              <Label
                htmlFor={String(name)}
                className="cursor-pointer font-normal"
              >
                {label}
              </Label>
            )}
          </div>
          {displayText != null && displayText !== "" && (
            <p
              id={`${String(name)}-helper`}
              className={cn(
                "text-sm",
                errorMessage ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {displayText}
            </p>
          )}
        </div>
      )}
    />
  );
}
