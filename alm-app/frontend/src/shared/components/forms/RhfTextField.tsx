/**
 * TextField wired to React Hook Form (register). Radix UI + Tailwind.
 */
import type { ComponentProps } from "react";
import { useFormContext } from "react-hook-form";
import { Input, Label } from "../ui";
import { cn } from "../ui/utils";

type RhfTextFieldProps<TFieldValues extends import("react-hook-form").FieldValues> = {
  name: import("react-hook-form").FieldPath<TFieldValues>;
  label?: React.ReactNode;
  placeholder?: string;
  fullWidth?: boolean;
  size?: "small" | "medium";
  disabled?: boolean;
  helperText?: string;
  className?: string;
  /** Native input type (text, email, password, etc.) */
  type?: ComponentProps<"input">["type"];
  /** Spread onto the native input (e.g. aria-label, autoFocus) */
  inputProps?: ComponentProps<"input">;
  /** MUI compatibility: prefix/suffix slots */
  InputProps?: {
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
  };
  /** MUI compatibility: slotProps.input.startAdornment/endAdornment map to InputProps */
  slotProps?: {
    input?: {
      startAdornment?: React.ReactNode;
      endAdornment?: React.ReactNode;
    };
  };
  /** MUI compatibility: ignored, use className */
  sx?: unknown;
  autoComplete?: string;
  autoFocus?: boolean;
};

export function RhfTextField<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  label,
  placeholder,
  fullWidth = true,
  size = "medium",
  disabled,
  helperText,
  className,
  type,
  inputProps,
  InputProps: inputSlotsProp,
  slotProps,
  sx: _sx,
  autoComplete,
  autoFocus,
}: RhfTextFieldProps<TFieldValues>) {
  const inputSlots = {
    startAdornment: inputSlotsProp?.startAdornment ?? slotProps?.input?.startAdornment,
    endAdornment: inputSlotsProp?.endAdornment ?? slotProps?.input?.endAdornment,
  };
  const {
    register,
    formState: { errors },
  } = useFormContext<TFieldValues>();
  const error = errors[name];
  const errMsg = (error?.message as string) ?? undefined;
  const displayText = errMsg ?? helperText;

  const hasStart = !!inputSlots?.startAdornment;
  const hasEnd = !!inputSlots?.endAdornment;

  return (
    <div className={cn("space-y-1.5", fullWidth && "w-full", className)}>
      {label != null && label !== "" && (
        <Label htmlFor={String(name)}>{label}</Label>
      )}
      <div className="relative flex w-full items-center">
        {hasStart && (
          <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
            {inputSlots.startAdornment}
          </span>
        )}
        {hasEnd && (
          <span className="absolute right-3 flex items-center text-muted-foreground">
            {inputSlots.endAdornment}
          </span>
        )}
        <Input
          id={String(name)}
          type={type}
          className={cn(
            size === "small" && "h-8 text-sm",
            hasStart && "pl-9",
            hasEnd && "pr-9",
          )}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={displayText ? `${String(name)}-helper` : undefined}
          {...register(name)}
          {...inputProps}
        />
      </div>
      {displayText != null && displayText !== "" && (
        <p
          id={`${String(name)}-helper`}
          className={cn(
            "text-sm",
            errMsg ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {displayText}
        </p>
      )}
    </div>
  );
}
