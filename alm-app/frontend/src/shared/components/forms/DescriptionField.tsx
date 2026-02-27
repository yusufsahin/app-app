/**
 * Reusable Description field: plain text, rich text (WYSIWYG), or markdown.
 * Controlled component (value + onChange). Use in metadata-driven forms or wrap with Controller for RHF.
 */
import { useRef, useState } from "react";
import type { DescriptionInputMode } from "../../types/formSchema";
import { Button, Label } from "../ui";
import { cn } from "../ui/utils";
import { MarkdownFieldInner } from "./RhfMarkdownField";
import { RichTextEditorInner } from "./RhfRichTextField";

export interface DescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  mode: DescriptionInputMode;
  label?: React.ReactNode;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  minHeight?: number;
  rows?: number;
  showToolbar?: boolean;
  showPreview?: boolean;
  allowModeSwitch?: boolean;
}

const textareaClassName = cn(
  "placeholder:text-muted-foreground border-input flex w-full min-w-0 rounded-md border px-3 py-2 text-base bg-input-background transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
);

export function DescriptionField({
  value,
  onChange,
  onBlur,
  mode: modeProp,
  label,
  placeholder,
  error = false,
  helperText,
  disabled = false,
  minHeight = 200,
  rows = 6,
  showToolbar = true,
  showPreview = true,
  allowModeSwitch = false,
}: DescriptionFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastExternalValueRef = useRef<string | undefined>(undefined);
  const [localMode, setLocalMode] = useState<DescriptionInputMode>(modeProp);
  const mode = allowModeSwitch ? localMode : modeProp;

  const modeSelector = allowModeSwitch && (
    <div className="mb-2 flex items-center gap-2">
      {label != null && label !== "" && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
      <div
        className="inline-flex rounded-md border border-border [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:border-l-0"
        role="group"
        aria-label="Description format"
      >
        {(["text", "richtext", "markdown"] as const).map((m) => (
          <Button
            key={m}
            type="button"
            variant={mode === m ? "default" : "ghost"}
            size="sm"
            className="rounded-none first:rounded-l-md last:rounded-r-md"
            onClick={() => setLocalMode(m)}
            aria-label={m === "text" ? "Plain text" : m === "richtext" ? "Rich text" : "Markdown"}
          >
            {m === "text" ? "Text" : m === "richtext" ? "Rich text" : "Markdown"}
          </Button>
        ))}
      </div>
    </div>
  );

  if (mode === "richtext") {
    return (
      <div>
        {modeSelector}
        <RichTextEditorInner
          value={value ?? ""}
          onChange={onChange}
          onBlur={onBlur ?? (() => {})}
          inputRef={() => {}}
          label={allowModeSwitch ? undefined : label}
          placeholder={placeholder ?? "Write something…"}
          minHeight={minHeight}
          showToolbar={showToolbar}
          disabled={disabled}
          error={error}
          helperText={helperText}
          lastExternalValueRef={lastExternalValueRef}
        />
      </div>
    );
  }

  if (mode === "markdown") {
    return (
      <div>
        {modeSelector}
        <MarkdownFieldInner
          value={value ?? ""}
          onChange={onChange}
          onBlur={onBlur ?? (() => {})}
          ref={() => {}}
          textareaRef={textareaRef}
          label={allowModeSwitch ? undefined : label}
          placeholder={placeholder ?? "Write markdown…"}
          minHeight={minHeight}
          rows={rows}
          showToolbar={showToolbar}
          showPreview={showPreview}
          defaultView="edit"
          disabled={disabled}
          error={error}
          helperText={helperText}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {modeSelector}
      {!allowModeSwitch && label != null && label !== "" && (
        <Label htmlFor="description-text">{label}</Label>
      )}
      <textarea
        id="description-text"
        className={textareaClassName}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        aria-invalid={error}
        aria-describedby={helperText ? "description-helper" : undefined}
        style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}
      />
      {helperText != null && helperText !== "" && (
        <p
          id="description-helper"
          className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
