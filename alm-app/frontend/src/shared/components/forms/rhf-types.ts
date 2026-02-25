/**
 * Shared types for React Hook Form + MUI reusable field components.
 * Use with zodResolver and useForm for type-safe forms.
 */
import type { Control, FieldPath, FieldValues } from "react-hook-form";

/** Base props for any RHF-controlled field: control + name. */
export interface RhfFieldProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
}

/** Props for fields that show a single error/helper text from form state. */
export interface RhfFieldWithErrorProps<TFieldValues extends FieldValues = FieldValues>
  extends RhfFieldProps<TFieldValues> {
  /** Error message from formState.errors[name]?.message */
  error?: string;
  /** Helper text shown below the field (e.g. description or error). */
  helperText?: string;
}

/**
 * Props for Controller-based fields with optional control (from FormProvider when omitted).
 * Use: RhfControllerFieldProps<TFieldValues> & { label?: ReactNode; ... }
 */
export type RhfControllerFieldProps<TFieldValues extends FieldValues = FieldValues> = Omit<
  RhfFieldWithErrorProps<TFieldValues>,
  "control"
> & {
  control?: RhfFieldWithErrorProps<TFieldValues>["control"];
};
