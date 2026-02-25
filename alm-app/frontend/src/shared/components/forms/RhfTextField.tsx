/**
 * Reusable TextField wired to React Hook Form (register).
 * Use for text, email, password, number. For controlled/unusual inputs use Controller-based components.
 */
import { useFormContext } from "react-hook-form";
import { TextField, type TextFieldProps } from "@mui/material";

type RhfTextFieldProps<TFieldValues extends import("react-hook-form").FieldValues> = Omit<
  TextFieldProps,
  "name" | "error"
> & {
  name: import("react-hook-form").FieldPath<TFieldValues>;
};

export function RhfTextField<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  ...textFieldProps
}: RhfTextFieldProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFieldValues>();
  const error = errors[name];
  const errMsg = error?.message as string | undefined;

  return (
    <TextField
      {...register(name)}
      {...textFieldProps}
      error={!!error}
      helperText={errMsg ?? textFieldProps.helperText ?? undefined}
    />
  );
}
