/**
 * Reusable rich text / WYSIWYG editor with table support, wired to React Hook Form via Controller.
 * Form value: HTML string. Use z.string() in Zod.
 * Built with TipTap (StarterKit + Table extensions).
 */
import { useRef, useEffect, useMemo } from "react";
import { Controller } from "react-hook-form";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Bold, Italic, List, ListOrdered, Table2 } from "lucide-react";
import { Label } from "../ui";
import { FormItem, FormControl, FormMessage } from "../ui/form";
import { cn } from "../ui/utils";
import type { RhfControllerFieldProps } from "./rhf-types";
import { useRhfField } from "./useRhfField";

function getExtensions(placeholderText: string) {
  return [
    StarterKit,
    Placeholder.configure({ placeholder: placeholderText }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}

type RhfRichTextFieldProps<TFieldValues extends import("react-hook-form").FieldValues> =
  RhfControllerFieldProps<TFieldValues> & {
    label?: React.ReactNode;
    placeholder?: string;
    minHeight?: number;
    showToolbar?: boolean;
    disabled?: boolean;
  };

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap gap-0 border-b border-border p-1">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
        className={cn("rounded p-1.5", editor.isActive("bold") && "bg-muted")}
      >
        <Bold className="size-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
        className={cn("rounded p-1.5", editor.isActive("italic") && "bg-muted")}
      >
        <Italic className="size-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
        className={cn("rounded p-1.5", editor.isActive("bulletList") && "bg-muted")}
      >
        <List className="size-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Numbered list"
        className={cn("rounded p-1.5", editor.isActive("orderedList") && "bg-muted")}
      >
        <ListOrdered className="size-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        aria-label="Insert table"
        className="rounded p-1.5 hover:bg-muted"
      >
        <Table2 className="size-4" />
      </button>
    </div>
  );
}

export function RhfRichTextField<TFieldValues extends import("react-hook-form").FieldValues>({
  name,
  control: controlProp,
  label,
  placeholder,
  minHeight = 200,
  showToolbar = true,
  disabled = false,
  error,
  helperText,
}: RhfRichTextFieldProps<TFieldValues>) {
  const { control, errorMessage, displayText } = useRhfField<TFieldValues>(name, {
    control: controlProp,
    error,
    helperText,
  });
  const lastExternalValue = useRef<string | undefined>(undefined);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur, ref } }) => (
        <RichTextEditorInner
          value={value as string | undefined}
          onChange={onChange}
          onBlur={onBlur}
          inputRef={ref}
          label={label}
          placeholder={placeholder}
          minHeight={minHeight}
          showToolbar={showToolbar}
          disabled={disabled}
          error={!!errorMessage}
          helperText={displayText}
          lastExternalValueRef={lastExternalValue}
        />
      )}
    />
  );
}

export interface RichTextEditorInnerProps {
  value: string | undefined;
  onChange: (html: string) => void;
  onBlur: () => void;
  inputRef: React.Ref<unknown>;
  label?: React.ReactNode;
  placeholder?: string;
  minHeight?: number;
  showToolbar?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  lastExternalValueRef: React.MutableRefObject<string | undefined>;
}

export function RichTextEditorInner({
  value,
  onChange,
  onBlur,
  inputRef,
  label,
  placeholder,
  minHeight = 200,
  showToolbar = true,
  disabled = false,
  error = false,
  helperText,
  lastExternalValueRef,
}: RichTextEditorInnerProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial content only, value changes handled by editor
  const initialContent = useMemo(() => value ?? "<p></p>", []);
  const placeholderText = placeholder ?? "Write something…";
  const editor = useEditor(
    {
      extensions: getExtensions(placeholderText),
      content: initialContent,
      editable: !disabled,
      editorProps: {
        attributes: {
          "aria-label": typeof label === "string" ? label : "Rich text",
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
    },
    [disabled],
  );

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const external = value ?? "<p></p>";
    if (lastExternalValueRef.current !== value && external !== currentHtml) {
      lastExternalValueRef.current = value;
      editor.commands.setContent(external, { emitUpdate: false });
    }
  }, [editor, value, lastExternalValueRef]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    const el = editor?.view.dom;
    if (!el) return;
    el.addEventListener("blur", onBlur);
    return () => el.removeEventListener("blur", onBlur);
  }, [editor, onBlur]);

  if (!editor) return <p className="text-muted-foreground">Loading editor…</p>;

  return (
    <FormItem>
      {label && <Label className="mb-1 block">{label}</Label>}
      <FormControl>
        <div
          ref={inputRef as React.RefObject<HTMLDivElement>}
          className={cn(
            "overflow-hidden rounded-md border bg-background",
            error && "border-destructive",
            disabled && "bg-muted/50",
            "[&_.ProseMirror]:min-h-[var(--editor-min-height,200px)] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:outline-none",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:bg-muted [&_.ProseMirror_th]:px-2 [&_.ProseMirror_th]:py-1 [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:px-2 [&_.ProseMirror_td]:py-1",
          )}
          style={{ ["--editor-min-height" as string]: `${minHeight}px` }}
        >
          {showToolbar && <Toolbar editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </FormControl>
      {helperText && <FormMessage>{helperText}</FormMessage>}
    </FormItem>
  );
}
