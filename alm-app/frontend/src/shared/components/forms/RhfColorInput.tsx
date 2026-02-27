/**
 * Reusable color input wired to React Hook Form via Controller.
 * Form value: string (e.g. hex #ffffff). Use z.string().regex(/^#[0-9A-Fa-f]{6}$/) in Zod.
 */
import { Controller } from "react-hook-form";
import { Input, Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfColorInputProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    showSwatch?: boolean;
  };

export function RhfColorInput<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  showSwatch = true,
  error,
  helperText,
}: RhfColorInputProps<TFieldValues>) {
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
        const str = value == null ? "#000000" : String(value);
        return (
          <FormItem>
            {label != null && label !== "" && <Label>{label}</Label>}
            <FormControl>
              <div className="flex flex-wrap items-center gap-2">
                {showSwatch && (
                  <input
                    type="color"
                    value={str.startsWith("#") ? str : `#${str}`}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    className="h-10 w-10 cursor-pointer rounded-md border border-input p-0"
                    aria-label={typeof label === "string" ? label : "Color"}
                  />
                )}
                <Input
                  value={str}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlur}
                  ref={ref}
                  placeholder="#000000"
                  className="min-w-[120px]"
                  aria-invalid={!!errorMessage}
                />
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
