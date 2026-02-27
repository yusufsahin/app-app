/**
 * Reusable Markdown field wired to React Hook Form via Controller.
 * Form value: raw markdown string. Use z.string() in Zod.
 * Optional live preview and toolbar to insert markdown syntax.
 */
import { useRef, useState } from "react";
import { Controller } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import { Bold, Italic, Code, List, ListOrdered, Link2, Eye, Pencil } from "lucide-react";
import { Label } from "../ui";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

type ViewMode = "edit" | "preview" | "split";

type RhfMarkdownFieldProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    placeholder?: string;
    minHeight?: number;
    rows?: number;
    showToolbar?: boolean;
    showPreview?: boolean;
    defaultView?: ViewMode;
    disabled?: boolean;
  };

function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  before: string,
  after: string = "",
  placeholder?: string,
) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const insert = selected ? `${before}${selected}${after}` : (placeholder ?? `${before}${after}`);
  const next = value.slice(0, start) + insert + value.slice(end);
  textarea.value = next;
  textarea.selectionStart = textarea.selectionEnd = start + insert.length;
  textarea.focus();
  return next;
}

function MarkdownToolbar({
  textareaRef,
  onInsert,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (value: string) => void;
}) {
  const handleWrap = (before: string, after: string = "", placeholder?: string) => {
    const next = insertAtCursor(textareaRef.current, before, after, placeholder);
    if (next !== undefined) onInsert(next);
  };

  return (
    <div className="flex flex-wrap gap-0 border-b border-border p-1">
      <button
        type="button"
        onClick={() => handleWrap("**", "**", "bold text")}
        aria-label="Bold"
        className="rounded p-1.5 hover:bg-muted"
      >
        <Bold className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => handleWrap("*", "*", "italic text")}
        aria-label="Italic"
        className="rounded p-1.5 hover:bg-muted"
      >
        <Italic className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => handleWrap("[", "](url)", "link text")}
        aria-label="Link"
        className="rounded p-1.5 hover:bg-muted"
      >
        <Link2 className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => handleWrap("`", "`", "code")}
        aria-label="Inline code"
        className="rounded p-1.5 hover:bg-muted"
      >
        <Code className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          const ta = textareaRef.current;
          if (!ta) return;
          const start = ta.selectionStart;
          const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
          const before = ta.value.slice(0, lineStart);
          const after = ta.value.slice(lineStart);
          const bullet = before.trimEnd() === "" ? "- " : "\n- ";
          const next = before + bullet + after;
          ta.value = next;
          ta.selectionStart = ta.selectionEnd = lineStart + bullet.length;
          ta.focus();
          onInsert(next);
        }}
        aria-label="Bullet list"
        className="rounded p-1.5 hover:bg-muted"
      >
        <List className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          const ta = textareaRef.current;
          if (!ta) return;
          const start = ta.selectionStart;
          const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
          const before = ta.value.slice(0, lineStart);
          const after = ta.value.slice(lineStart);
          const num = before.trimEnd() === "" ? "1. " : "\n1. ";
          const next = before + num + after;
          ta.value = next;
          ta.selectionStart = ta.selectionEnd = lineStart + num.length;
          ta.focus();
          onInsert(next);
        }}
        aria-label="Numbered list"
        className="rounded p-1.5 hover:bg-muted"
      >
        <ListOrdered className="size-4" />
      </button>
    </div>
  );
}

export function RhfMarkdownField<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  placeholder = "Write markdown…",
  minHeight = 200,
  rows = 10,
  showToolbar = true,
  showPreview = true,
  defaultView = "edit",
  disabled = false,
  error,
  helperText,
}: RhfMarkdownFieldProps<TFieldValues>) {
  const { control, errorMessage, displayText } = useRhfField<TFieldValues>(name, {
    control: controlProp,
    error,
    helperText,
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur, ref } }) => (
        <MarkdownFieldInner
          value={(value ?? "") as string}
          onChange={onChange}
          onBlur={onBlur}
          ref={ref}
          textareaRef={textareaRef}
          label={label}
          placeholder={placeholder}
          minHeight={minHeight}
          rows={rows}
          showToolbar={showToolbar}
          showPreview={showPreview}
          defaultView={defaultView}
          disabled={disabled}
          error={!!errorMessage}
          helperText={displayText}
        />
      )}
    />
  );
}

export interface MarkdownFieldInnerProps {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  ref: React.Ref<unknown>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  label?: React.ReactNode;
  placeholder?: string;
  minHeight?: number;
  rows?: number;
  showToolbar?: boolean;
  showPreview?: boolean;
  defaultView?: ViewMode;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

export const MarkdownFieldInner = ({
  value: raw,
  onChange,
  onBlur,
  ref,
  textareaRef,
  label,
  placeholder = "Write markdown…",
  minHeight = 200,
  rows = 10,
  showToolbar = true,
  showPreview = true,
  defaultView = "edit",
  disabled = false,
  error = false,
  helperText,
}: MarkdownFieldInnerProps) => {
  const [view, setView] = useState<ViewMode>(defaultView);

  return (
    <FormItem>
      {label && <Label className="mb-1 block">{label}</Label>}
      <FormControl>
        <div
          className={cn(
            "overflow-hidden rounded-md border bg-background",
            error && "border-destructive",
            disabled && "bg-muted/50",
          )}
        >
          {showPreview && (
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList className="h-9 w-full justify-start rounded-none border-b border-border bg-transparent">
                <TabsTrigger value="edit" className="gap-1.5">
                  <Pencil className="size-4" /> Edit
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="size-4" /> Preview
                </TabsTrigger>
                <TabsTrigger value="split" className="gap-1.5">
                  <Eye className="size-4" /> Split
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {showToolbar && (!showPreview || view === "edit" || view === "split") && (
            <MarkdownToolbar textareaRef={textareaRef} onInsert={onChange} />
          )}
          <div className={cn("flex", view === "split" ? "flex-row" : "flex-col")} style={{ minHeight }}>
            {(!showPreview || view === "edit" || view === "split") && (
              <div className={cn("flex flex-col", view === "split" && "flex-1")}>
                <textarea
                  ref={(el) => {
                    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                    if (typeof ref === "function") ref(el);
                    else if (ref && typeof ref === "object") (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                  }}
                  value={raw}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlur}
                  placeholder={placeholder}
                  disabled={disabled}
                  rows={view === "split" ? Math.max(4, rows / 2) : rows}
                  className="min-h-[200px] flex-1 resize-y rounded-none border-0 bg-transparent px-3 py-2 font-mono text-sm outline-none disabled:opacity-50"
                />
              </div>
            )}
            {showPreview && (view === "preview" || view === "split") && (
              <div
                className={cn(
                  "overflow-auto px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none",
                  view === "split" && "min-h-[200px] flex-1 border-l border-border",
                )}
                style={{ minHeight: view === "split" ? minHeight / 2 : minHeight }}
              >
                {raw.trim() ? (
                  <ReactMarkdown>{raw}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground">Nothing to preview</p>
                )}
              </div>
            )}
          </div>
        </div>
      </FormControl>
      {helperText && <FormMessage>{helperText}</FormMessage>}
    </FormItem>
  );
};
