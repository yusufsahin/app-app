/**
 * Reusable file input wired to React Hook Form via Controller.
 * Form value: File | File[] | null. Use z.instanceof(File).nullable() or z.array(z.instanceof(File)) in Zod.
 */
import { Controller } from "react-hook-form";
import { Button, Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfFileInputProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    multiple?: boolean;
    accept?: string;
    buttonLabel?: string;
    disabled?: boolean;
  };

export function RhfFileInput<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  multiple = false,
  accept,
  buttonLabel = "Choose file(s)",
  disabled,
  error,
  helperText,
}: RhfFileInputProps<TFieldValues>) {
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
        const files: File[] | File | null = multiple
          ? (Array.isArray(value) ? value : [])
          : (value as File | null);
        const display = multiple
          ? (files as File[]).map((f) => f.name).join(", ") || "No files chosen"
          : (files as File | null)?.name ?? "No file chosen";
        return (
          <FormItem>
            {label != null && label !== "" && <Label>{label}</Label>}
            <FormControl>
              <div className="space-y-1">
                <Button variant="outline" asChild disabled={disabled} className="inline-flex">
                  <label className="cursor-pointer">
                    {buttonLabel}
                    <input
                      ref={ref}
                      type="file"
                      className="hidden"
                      multiple={multiple}
                      accept={accept}
                      onChange={(e) => {
                        const list = e.target.files;
                        if (!list?.length) return;
                        onChange((multiple ? Array.from(list) : list[0] ?? null) as File | File[] | null);
                      }}
                      onBlur={onBlur}
                      disabled={disabled}
                    />
                  </label>
                </Button>
                {display && <p className="text-sm text-muted-foreground">{display}</p>}
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
