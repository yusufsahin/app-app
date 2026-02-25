/**
 * Reusable form fields: React Hook Form + Zod + MUI.
 *
 * Usage:
 * 1. Wrap your form with FormProvider from react-hook-form and pass the result of useForm().
 * 2. Use zodResolver(schema) in useForm({ resolver: zodResolver(schema), defaultValues }).
 * 3. Use these components inside the form; they read control/errors from context when used inside FormProvider.
 *
 * Example:
 *   const form = useForm({ resolver: zodResolver(mySchema), defaultValues: { ... } });
 *   return (
 *     <FormProvider {...form}>
 *       <form onSubmit={form.handleSubmit(onSubmit)}>
 *         <RhfTextField name="email" label="Email" fullWidth />
 *         <RhfSelect name="role" control={form.control} label="Role" options={roles} />
 *         <RhfCheckbox name="agree" label="I agree" />
 *         <RhfDateTimePicker name="startsAt" label="Start" />
 *       </form>
 *     </FormProvider>
 *   );
 */

export { RhfTextField } from "./RhfTextField";
export { RhfCheckbox } from "./RhfCheckbox";
export { RhfSwitch } from "./RhfSwitch";
export { RhfRadioGroup, type RhfRadioOption } from "./RhfRadioGroup";
export { RhfSelect, type RhfSelectOption } from "./RhfSelect";
export { RhfMultiSelect } from "./RhfMultiSelect";
export { RhfAutocomplete, type RhfAutocompleteOption } from "./RhfAutocomplete";
export { RhfDateTimePicker } from "./RhfDateTimePicker";
export { RhfDatePicker } from "./RhfDatePicker";
export { RhfTimePicker } from "./RhfTimePicker";
export { RhfSlider } from "./RhfSlider";
export { RhfRangeSlider } from "./RhfRangeSlider";
export { RhfRating } from "./RhfRating";
export { RhfNumberInput } from "./RhfNumberInput";
export { RhfToggleButtonGroup, type RhfToggleOption } from "./RhfToggleButtonGroup";
export { RhfCheckboxGroup, type RhfCheckboxGroupOption } from "./RhfCheckboxGroup";
export { RhfFileInput } from "./RhfFileInput";
export { RhfColorInput } from "./RhfColorInput";
export { RhfRichTextField } from "./RhfRichTextField";
export { RhfMarkdownField } from "./RhfMarkdownField";
export { useRhfField } from "./useRhfField";
export type { RhfFieldProps, RhfFieldWithErrorProps, RhfControllerFieldProps } from "./rhf-types";
export type { UseRhfFieldOptions, UseRhfFieldReturn } from "./useRhfField";
