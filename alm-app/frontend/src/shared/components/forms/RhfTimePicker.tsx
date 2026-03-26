/**
 * TimePicker (time only) wired to React Hook Form via Controller.
 * Form value: Date | string | null (time part is used). Uses native input type="time" + dayjs.
 */
import { Controller } from "react-hook-form";
import dayjs from "dayjs";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";
import { Input } from "../ui";
import { Label } from "../ui";
import { cn } from "../ui/utils";

function formatTimeForInput(v: Date | string | null): string {
  if (v == null) return "";
  const d = typeof v === "string" ? dayjs(v) : dayjs(v);
  return d.isValid() ? d.format("HH:mm") : "";
}

function parseTimeFromInput(
  value: string,
  valueAsString: boolean,
  existingDate?: Date | string | null,
): Date | string | null {
  if (!value || value.trim() === "") return null;
  const parts = value.split(":");
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const base = existingDate
    ? dayjs(existingDate)
    : dayjs().startOf("day");
  const d = base.hour(hours).minute(minutes).second(0).millisecond(0);
  return valueAsString ? d.toISOString() : d.toDate();
}

type RhfTimePickerProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: string;
    valueAsString?: boolean;
    slotProps?: { textField?: Record<string, unknown> };
    disabled?: boolean;
  };

export function RhfTimePicker<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  error,
  helperText,
  valueAsString = false,
  disabled,
}: RhfTimePickerProps<TFieldValues>) {
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
            type="time"
            value={formatTimeForInput(value as Date | string | null)}
            onChange={(e) =>
              onChange(
                parseTimeFromInput(
                  e.target.value,
                  valueAsString,
                  value as Date | string | null,
                ),
              )
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
