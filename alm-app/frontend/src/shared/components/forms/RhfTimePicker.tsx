/**
 * Reusable TimePicker (time only) wired to React Hook Form via Controller.
 * Form value: Date | null (use z.date().nullable() or z.coerce.date().nullable() in Zod; time part is used).
 * Requires LocalizationProvider with AdapterDayjs.
 */
import { Controller } from "react-hook-form";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { type Dayjs } from "dayjs";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

function toDayjs(v: Date | string | null): Dayjs | null {
  if (v == null) return null;
  return dayjs(typeof v === "string" ? v : v);
}

function fromDayjs(v: Dayjs | null, asString: boolean): Date | string | null {
  if (v == null) return null;
  return asString ? v.toISOString() : v.toDate();
}

type RhfTimePickerProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: string;
    valueAsString?: boolean;
    slotProps?: { textField?: Record<string, unknown> };
  };

export function RhfTimePicker<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  error,
  helperText,
  valueAsString = false,
  slotProps,
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
      render={({ field: { value, onChange, onBlur, ref } }) => {
        const dayjsVal = toDayjs(value as Date | string | null);
        return (
          <TimePicker
            label={label}
            value={dayjsVal}
            onChange={(v) => onChange(fromDayjs(v, valueAsString))}
            onClose={onBlur}
            slotProps={{
              ...slotProps,
              textField: {
                ...(slotProps?.textField ?? {}),
                error: !!errorMessage,
                helperText: displayText,
                onBlur,
                inputRef: ref,
              } as Record<string, unknown>,
            }}
          />
        );
      }}
    />
  );
}
