/**
 * Reusable Autocomplete wired to React Hook Form via Controller.
 * Supports single or multiple selection. Form value: T | T[] (e.g. string or string[]).
 */
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Input, Label } from "../ui";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfAutocompleteOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

type RhfAutocompleteBaseProps<TFieldValues extends import("react-hook-form").FieldValues, T = string> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: string;
    options: RhfAutocompleteOption<T>[];
    placeholder?: string;
    multiple?: boolean;
    freeSolo?: boolean;
  };

export function RhfAutocomplete<TFieldValues extends import("react-hook-form").FieldValues, T = string>({
  name,
  control: controlProp,
  label,
  options,
  placeholder,
  multiple = false,
  freeSolo = false,
  error,
  helperText,
}: RhfAutocompleteBaseProps<TFieldValues, T>) {
  const { control, errorMessage, displayText } = useRhfField<TFieldValues>(name, {
    control: controlProp,
    error,
    helperText,
  });
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur, ref } }) => {
        const rawValue = value as T | T[] | null | undefined;
        const selectedOptions = multiple
          ? (Array.isArray(rawValue) ? rawValue : []).map(
              (v) => options.find((o) => o.value === v),
            ).filter(Boolean) as RhfAutocompleteOption<T>[]
          : rawValue == null || rawValue === ""
            ? null
            : options.find((o) => o.value === rawValue) ??
              (freeSolo ? ({ value: rawValue, label: String(rawValue) } as RhfAutocompleteOption<T>) : null);
        const filtered = !inputValue.trim()
          ? options
          : options.filter((o) => o.label.toLowerCase().includes(inputValue.toLowerCase()));
        const displayLabel = multiple
          ? (selectedOptions as RhfAutocompleteOption<T>[]).map((o) => o.label).join(", ")
          : selectedOptions ? (selectedOptions as RhfAutocompleteOption<T>).label : "";

        return (
          <FormItem>
            {label != null && label !== "" && <Label>{label}</Label>}
            <FormControl>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <div ref={ref}>
                    <Input
                      value={open ? inputValue : displayLabel}
                      onChange={(e) => setInputValue(e.target.value)}
                      onFocus={() => setOpen(true)}
                      onBlur={onBlur}
                      placeholder={placeholder}
                      aria-invalid={!!errorMessage}
                      className="w-full"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="max-h-60 overflow-auto">
                    {filtered.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        disabled={opt.disabled}
                        className={cn(
                          "w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted",
                          (multiple ? (selectedOptions as RhfAutocompleteOption<T>[]).some((o) => o.value === opt.value) : (selectedOptions as RhfAutocompleteOption<T> | null)?.value === opt.value) &&
                            "bg-muted",
                        )}
                        onClick={() => {
                          if (multiple) {
                            const arr = selectedOptions as RhfAutocompleteOption<T>[];
                            const next = arr.some((o) => o.value === opt.value)
                              ? arr.filter((o) => o.value !== opt.value)
                              : [...arr, opt];
                            onChange(next.map((o) => o.value));
                          } else {
                            onChange(opt.value);
                            setOpen(false);
                            setInputValue("");
                          }
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {filtered.length === 0 && freeSolo && inputValue.trim() && (
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          onChange(inputValue.trim());
                          setOpen(false);
                          setInputValue("");
                        }}
                      >
                        Add &quot;{inputValue.trim()}&quot;
                      </button>
                    )}
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
