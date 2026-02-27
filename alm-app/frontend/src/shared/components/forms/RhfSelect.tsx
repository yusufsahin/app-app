/**
 * Select wired to React Hook Form via Controller. Radix UI + Tailwind.
 */
import { Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui";
import { Label } from "../ui";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfSelectOption<T = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

type RhfSelectProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfSelectOption[];
    placeholder?: string;
    selectProps?: {
      size?: "sm" | "default";
      variant?: string;
      className?: string;
      sx?: unknown;
      displayEmpty?: boolean;
      [key: string]: unknown;
    };
  };

export function RhfSelect<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  options,
  placeholder,
  error,
  helperText,
  selectProps,
}: RhfSelectProps<TFieldValues>) {
  const { control, errorMessage, displayText } = useRhfField<TFieldValues>(name, {
    control: controlProp,
    error,
    helperText,
  });

  const size = selectProps?.size ?? "default";

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur, ref } }) => (
        <div className="w-full space-y-1.5">
          {label != null && label !== "" && (
            <Label id={`${String(name)}-label`}>{label}</Label>
          )}
          <Select
            value={value === undefined || value === null || value === "" ? "__empty__" : String(value)}
            onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}
            onOpenChange={(open) => {
              if (!open) onBlur();
            }}
          >
            <SelectTrigger
              ref={ref}
              size={size}
              className={cn("w-full", selectProps?.className)}
              aria-labelledby={label != null && label !== "" ? `${String(name)}-label` : undefined}
              aria-invalid={!!errorMessage}
            >
              <SelectValue placeholder={placeholder ?? "Select…"} />
            </SelectTrigger>
            <SelectContent>
              {placeholder != null && placeholder !== "" && (
                <SelectItem value="__empty__">{placeholder}</SelectItem>
              )}
              {options.map((opt) => {
                const val = opt.value === "" || opt.value === undefined || opt.value === null ? "__empty__" : String(opt.value);
                return (
                  <SelectItem
                    key={val}
                    value={val}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {displayText != null && displayText !== "" && (
            <p
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
