/**
 * Switch wired to React Hook Form via Controller. Radix UI + Tailwind.
 */
import { Controller } from "react-hook-form";
import { Switch, Label } from "../ui";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfSwitchProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    switchProps?: {
      className?: string;
      disabled?: boolean;
      [key: string]: unknown;
    };
  };

export function RhfSwitch<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  error,
  helperText,
  switchProps,
}: RhfSwitchProps<TFieldValues>) {
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
            <Switch
              id={String(name)}
              ref={ref}
              checked={!!value}
              onCheckedChange={(checked) => onChange(!!checked)}
              onBlur={onBlur}
              aria-invalid={!!errorMessage}
              aria-describedby={displayText ? `${String(name)}-helper` : undefined}
              {...switchProps}
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
