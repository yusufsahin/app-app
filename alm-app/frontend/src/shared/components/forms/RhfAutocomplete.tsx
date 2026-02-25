/**
 * Reusable Autocomplete wired to React Hook Form via Controller.
 * Supports single or multiple selection. Form value: T | T[] (e.g. string or string[]).
 */
import { Controller } from "react-hook-form";
import { Autocomplete, TextField, type AutocompleteProps } from "@mui/material";
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
    autocompleteProps?: Omit<
      AutocompleteProps<RhfAutocompleteOption<T>, boolean, boolean, boolean>,
      "options" | "value" | "onChange" | "onBlur" | "renderInput" | "getOptionLabel" | "isOptionEqualToValue"
    >;
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
  autocompleteProps,
}: RhfAutocompleteBaseProps<TFieldValues, T>) {
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
        const rawValue = value as T | T[] | null | undefined;
        const selectedOptions = multiple
          ? (Array.isArray(rawValue) ? rawValue : [])
              .map((v) => options.find((o) => o.value === v))
              .filter(Boolean) as RhfAutocompleteOption<T>[]
          : rawValue == null || rawValue === ""
            ? null
            : options.find((o) => o.value === rawValue) ?? (freeSolo ? { value: rawValue, label: String(rawValue) } as RhfAutocompleteOption<T> : null);

        return (
          <Autocomplete<RhfAutocompleteOption<T>, boolean, boolean, boolean>
            {...autocompleteProps}
            multiple={multiple}
            freeSolo={freeSolo}
            options={options}
            getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.label)}
            isOptionEqualToValue={(opt, v) => opt.value === (typeof v === "object" && v && "value" in v ? v.value : v)}
            value={selectedOptions as RhfAutocompleteOption<T> | RhfAutocompleteOption<T>[] | null}
            onChange={(_, newValue) => {
              if (multiple) {
                const arr = Array.isArray(newValue) ? newValue : [];
                onChange(arr.map((o) => (o && typeof o === "object" && "value" in o ? o.value : o)));
              } else {
                const v = newValue as RhfAutocompleteOption<T> | string | null;
                onChange(v == null ? null : typeof v === "object" && "value" in v ? v.value : v);
              }
            }}
            onBlur={onBlur}
            ref={ref}
            renderInput={(params) => (
              <TextField
                {...params}
                label={label}
                placeholder={placeholder}
                error={!!errorMessage}
                helperText={displayText}
              />
            )}
          />
        );
      }}
    />
  );
}
