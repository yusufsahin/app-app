/**
 * Reusable DateTimePicker wired to React Hook Form via Controller.
 * Form value: Date | null (use z.date().nullable() or z.coerce.date().nullable() in Zod).
 * Requires LocalizationProvider (e.g. in app providers) with AdapterDayjs.
 */
import { Controller } from "react-hook-form";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";
import dayjs, { type Dayjs } from "dayjs";

function toDayjs(v: Date | string | null): Dayjs | null {
  if (v == null) return null;
  return dayjs(typeof v === "string" ? v : v);
}

function fromDayjs(v: Dayjs | null, asString: boolean): Date | string | null {
  if (v == null) return null;
  return asString ? v.toISOString() : v.toDate();
}

type RhfDateTimePickerProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: string;
    valueAsString?: boolean;
    slotProps?: {
      textField?: { error?: boolean; helperText?: string; onBlur?: () => void; inputRef?: React.Ref<unknown> };
    };
  };

export function RhfDateTimePicker<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  error,
  helperText,
  valueAsString = false,
  slotProps,
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
      render={({ field: { value, onChange, onBlur, ref } }) => {
        const dayjsVal = toDayjs(value as Date | string | null);
        return (
          <DateTimePicker
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
