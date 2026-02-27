/**
 * Reusable multi-select dropdown wired to React Hook Form via Controller.
 * Form value: T[]. Use z.array(z.string()).min(1) etc. in Zod.
 */
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Button, Checkbox, Label } from "../ui";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import type { RhfSelectOption } from "./RhfSelect";
import { useRhfField } from "./useRhfField";

type RhfMultiSelectProps<TFieldValues extends import("react-hook-form").FieldValues, T = string> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfSelectOption<T>[];
    placeholder?: string;
  };

export function RhfMultiSelect<TFieldValues extends import("react-hook-form").FieldValues, T = string>({
  name,
  control: controlProp,
  label,
  options,
  placeholder,
  error,
  helperText,
}: RhfMultiSelectProps<TFieldValues, T>) {
  const { control, errorMessage, displayText } = useRhfField<TFieldValues>(name, {
    control: controlProp,
    error,
    helperText,
  });
  const [open, setOpen] = useState(false);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur, ref } }) => {
        const selected = (Array.isArray(value) ? value : []) as T[];
        const toggle = (optValue: T) => {
          const next = selected.includes(optValue)
            ? selected.filter((x) => x !== optValue)
            : [...selected, optValue];
          onChange(next);
        };
        const labels = options
          .filter((o) => selected.includes(o.value as T))
          .map((o) => (typeof o.label === "string" ? o.label : String(o.value)));
        const display = labels.length === 0 && placeholder ? placeholder : labels.join(", ");
        return (
          <FormItem>
            {label != null && label !== "" && <Label>{label}</Label>}
            <FormControl>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                    ref={ref}
                    onBlur={onBlur}
                  >
                    <span className="truncate">{display}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                  <div className="max-h-60 overflow-auto">
                    {options.map((opt) => (
                      <label
                        key={String(opt.value)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                          opt.disabled && "opacity-50",
                        )}
                      >
                        <Checkbox
                          checked={selected.includes(opt.value as T)}
                          onCheckedChange={() => toggle(opt.value as T)}
                          disabled={opt.disabled}
                        />
                        {typeof opt.label === "string" ? opt.label : opt.label}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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
