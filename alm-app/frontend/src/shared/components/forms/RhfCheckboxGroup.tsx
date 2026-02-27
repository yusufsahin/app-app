/**
 * Reusable checkbox group wired to React Hook Form via Controller.
 * Form value: string[] (selected option values). Use z.array(z.string()) in Zod.
 */
import { Controller } from "react-hook-form";
import { Checkbox, Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfCheckboxGroupOption<T = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

type RhfCheckboxGroupProps<TFieldValues extends import("react-hook-form").FieldValues, T = string> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfCheckboxGroupOption<T>[];
    row?: boolean;
  };

export function RhfCheckboxGroup<TFieldValues extends import("react-hook-form").FieldValues, T = string>({
  name,
  control: controlProp,
  label,
  options,
  row = false,
  error,
  helperText,
}: RhfCheckboxGroupProps<TFieldValues, T>) {
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
        const selected = (Array.isArray(value) ? value : []) as T[];
        const toggle = (v: T) => {
          const next = selected.includes(v)
            ? selected.filter((x) => x !== v)
            : [...selected, v];
          onChange(next);
        };
        return (
          <FormItem>
            {label != null && label !== "" && <Label>{label}</Label>}
            <FormControl>
              <div ref={ref} className={cn("flex flex-col gap-2", row && "flex-row flex-wrap")}>
                {options.map((opt) => (
                  <label key={String(opt.value)} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={selected.includes(opt.value as T)}
                      onCheckedChange={() => toggle(opt.value as T)}
                      onBlur={onBlur}
                      disabled={opt.disabled}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
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
