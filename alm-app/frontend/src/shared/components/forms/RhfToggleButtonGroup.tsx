/**
 * Reusable ToggleButtonGroup wired to React Hook Form via Controller.
 * Form value: string (exclusive) or string[] (multiple). Use z.string() or z.array(z.string()) in Zod.
 */
import { Controller } from "react-hook-form";
import { Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfToggleOption<T = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

type RhfToggleButtonGroupProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfToggleOption[];
    multiple?: boolean;
    exclusive?: boolean;
    size?: "small" | "medium" | "large";
    fullWidth?: boolean;
  };

export function RhfToggleButtonGroup<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  options,
  multiple = false,
  exclusive: _exclusive,
  fullWidth,
  error,
  helperText,
}: RhfToggleButtonGroupProps<TFieldValues>) {
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
        const val = value ?? (multiple ? [] : "");
        const selected: string[] = multiple
          ? (Array.isArray(val) ? (val as string[]) : [])
          : val == null || val === "" ? [] : [String(val)];
        const toggle = (optValue: string) => {
          if (multiple) {
            const arr = selected;
            const next = arr.includes(optValue)
              ? arr.filter((x) => x !== optValue)
              : [...arr, optValue];
            onChange(next);
          } else {
            onChange(selected.includes(optValue) ? "" : optValue);
          }
        };
        return (
          <FormItem>
            {label != null && label !== "" && <Label>{label}</Label>}
            <FormControl>
              <div
                ref={ref}
                onBlur={onBlur}
                className={cn("flex flex-wrap gap-1", fullWidth && "w-full")}
                role="group"
                aria-label={typeof label === "string" ? label : undefined}
              >
                {options.map((opt) => {
                  const isSelected = selected.includes(String(opt.value));
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => toggle(String(opt.value))}
                      disabled={opt.disabled}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-muted",
                      )}
                      aria-pressed={isSelected}
                    >
                      {opt.label}
                    </button>
                  );
                })}
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
