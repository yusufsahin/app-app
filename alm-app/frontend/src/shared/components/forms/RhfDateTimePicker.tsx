/**
 * DateTimePicker wired to React Hook Form via Controller.
 * Form value: Date | string | null. Uses native input type="datetime-local" + dayjs.
 */
import { Controller } from "react-hook-form";
import dayjs from "dayjs";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";
import { Input } from "../ui";
import { Label } from "../ui";
import { cn } from "../ui/utils";

function formatForInput(v: Date | string | null): string {
  if (v == null) return "";
  const d = typeof v === "string" ? dayjs(v) : dayjs(v);
  return d.isValid() ? d.format("YYYY-MM-DDTHH:mm") : "";
}

function parseFromInput(
  value: string,
  valueAsString: boolean,
): Date | string | null {
  if (!value || value.trim() === "") return null;
  const d = dayjs(value);
  if (!d.isValid()) return null;
  return valueAsString ? d.toISOString() : d.toDate();
}

type RhfDateTimePickerProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: string;
    valueAsString?: boolean;
    slotProps?: { textField?: Record<string, unknown> };
    disabled?: boolean;
  };

export function RhfDateTimePicker<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  error,
  helperText,
  valueAsString = false,
  disabled,
}: RhfDateTimePickerProps<TFieldValues>) {
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
        <div className="w-full space-y-1.5">
          {label != null && label !== "" && (
            <Label htmlFor={String(name)}>{label}</Label>
          )}
          <Input
            id={String(name)}
            ref={ref}
            type="datetime-local"
            value={formatForInput(value as Date | string | null)}
            onChange={(e) =>
              onChange(parseFromInput(e.target.value, valueAsString))
            }
            onBlur={onBlur}
            disabled={disabled}
            aria-invalid={!!errorMessage}
            aria-describedby={displayText ? `${String(name)}-helper` : undefined}
            className="w-full"
          />
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
