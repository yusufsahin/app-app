/**
 * Description field wired to React Hook Form: text, rich text (WYSIWYG), or markdown.
 * Use with FormProvider; control is optional when inside a form.
 */
import { Controller } from "react-hook-form";
import type { DescriptionInputMode } from "../../types/formSchema";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";
import { DescriptionField } from "./DescriptionField";

export type RhfDescriptionFieldProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    mode: DescriptionInputMode;
    label?: React.ReactNode;
    placeholder?: string;
    minHeight?: number;
    rows?: number;
    showToolbar?: boolean;
    showPreview?: boolean;
    disabled?: boolean;
    /** When true, user can switch between text / rich text / markdown. Default false. */
    allowModeSwitch?: boolean;
  };

export function RhfDescriptionField<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  mode,
  label,
  placeholder,
  minHeight,
  rows,
  showToolbar,
  showPreview,
  disabled = false,
  allowModeSwitch = false,
  error,
  helperText,
}: RhfDescriptionFieldProps<TFieldValues>) {
  const { control, errorMessage, displayText } = useRhfField<TFieldValues>(name, {
    control: controlProp,
    error,
    helperText,
  });

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur } }) => (
        <DescriptionField
          value={(value ?? "") as string}
          onChange={onChange}
          onBlur={onBlur}
          mode={mode}
          label={label}
          placeholder={placeholder}
          error={!!errorMessage}
          helperText={displayText}
          disabled={disabled}
          minHeight={minHeight}
          rows={rows}
          showToolbar={showToolbar}
          showPreview={showPreview}
          allowModeSwitch={allowModeSwitch}
        />
      )}
    />
  );
}
