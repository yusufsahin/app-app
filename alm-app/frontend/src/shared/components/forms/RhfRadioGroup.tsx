/**
 * Reusable RadioGroup wired to React Hook Form via Controller.
 * Use inside a form wrapped with FormProvider, or pass control explicitly.
 */
import { Controller } from "react-hook-form";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

export interface RhfRadioOption<T = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

type RhfRadioGroupProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    options: RhfRadioOption[];
    row?: boolean;
  };

export function RhfRadioGroup<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  options,
  row = false,
  error,
  helperText,
}: RhfRadioGroupProps<TFieldValues>) {
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
        <FormItem>
          {label != null && label !== "" && <Label>{label}</Label>}
          <FormControl>
            <RadioGroupPrimitive.Root
              value={value ?? ""}
              onValueChange={onChange}
              onBlur={onBlur}
              ref={ref}
              className={cn("flex gap-4", row && "flex-row")}
              aria-invalid={!!errorMessage}
            >
              {options.map((opt) => (
                <div key={String(opt.value)} className="flex items-center gap-2">
                  <RadioGroupPrimitive.Item
                    value={String(opt.value)}
                    id={`${String(name)}-${String(opt.value)}`}
                    disabled={opt.disabled}
                    className="size-4 rounded-full border border-primary text-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:ring-2 data-[state=checked]:ring-primary/20"
                  />
                  <Label
                    htmlFor={`${String(name)}-${String(opt.value)}`}
                    className="cursor-pointer font-normal"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroupPrimitive.Root>
          </FormControl>
          {(displayText != null && displayText !== "") || errorMessage ? (
            <FormMessage>{errorMessage ?? displayText}</FormMessage>
          ) : null}
        </FormItem>
      )}
    />
  );
}
