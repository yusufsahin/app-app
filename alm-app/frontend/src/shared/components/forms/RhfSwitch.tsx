/**
 * Reusable Switch wired to React Hook Form via Controller.
 * Use inside a form wrapped with FormProvider, or pass control explicitly.
 */
import { Controller } from "react-hook-form";
import { FormControlLabel, FormHelperText, Switch, type SwitchProps } from "@mui/material";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type RhfSwitchProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    switchProps?: Omit<SwitchProps, "checked" | "onChange" | "onBlur" | "inputRef">;
  };

export function RhfSwitch<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  error,
  helperText,
  switchProps,
}: RhfSwitchProps<TFieldValues>) {
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
        <>
          <FormControlLabel
            control={
              <Switch
                {...switchProps}
                checked={!!value}
                onChange={(e) => onChange(e.target.checked)}
                onBlur={onBlur}
                inputRef={ref}
              />
            }
            label={label}
          />
          {displayText != null && displayText !== "" && (
            <FormHelperText error={!!errorMessage}>{displayText}</FormHelperText>
          )}
        </>
      )}
    />
  );
}
