/**
 * Shared hook for RHF Controller-based fields.
 * Resolves control from FormProvider when not passed, and merges error/helperText from form state.
 */
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useFormContext } from "react-hook-form";

export interface UseRhfFieldOptions<TFieldValues extends FieldValues> {
  control?: Control<TFieldValues>;
  error?: string;
  helperText?: string;
}

export interface UseRhfFieldReturn<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  errorMessage: string | undefined;
  /** Resolved text for FormHelperText: errorMessage ?? helperText */
  displayText: string | undefined;
}

export function useRhfField<TFieldValues extends FieldValues>(
  name: FieldPath<TFieldValues>,
  options?: UseRhfFieldOptions<TFieldValues>,
): UseRhfFieldReturn<TFieldValues> {
  const formContext = useFormContext<TFieldValues>();
  const control = (options?.control ?? formContext.control) as Control<TFieldValues>;
  const errorMessage = (options?.error ?? formContext.formState.errors[name]?.message) as string | undefined;
  const displayText = errorMessage ?? options?.helperText;
  return { control, errorMessage, displayText };
}
