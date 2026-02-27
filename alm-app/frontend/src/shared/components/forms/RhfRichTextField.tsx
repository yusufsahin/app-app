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
import {
  Box,
  FormControl,
  FormHelperText,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import FormatListNumbered from "@mui/icons-material/FormatListNumbered";
import TableChart from "@mui/icons-material/TableChart";
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
    <ToggleButtonGroup size="small" sx={{ flexWrap: "wrap", gap: 0, p: 0.5, borderBottom: 1, borderColor: "divider" }}>
      <ToggleButton
        value="bold"
        selected={editor.isActive("bold")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <FormatBold />
      </ToggleButton>
      <ToggleButton
        value="italic"
        selected={editor.isActive("italic")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <FormatItalic />
      </ToggleButton>
      <ToggleButton
        value="bulletList"
        selected={editor.isActive("bulletList")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
      >
        <FormatListBulleted />
      </ToggleButton>
      <ToggleButton
        value="orderedList"
        selected={editor.isActive("orderedList")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Numbered list"
      >
        <FormatListNumbered />
      </ToggleButton>
      <ToggleButton
        value="table"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        aria-label="Insert table"
      >
        <TableChart />
      </ToggleButton>
    </ToggleButtonGroup>
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

  if (!editor) return <Typography color="text.secondary">Loading editor…</Typography>;

  return (
    <FormControl fullWidth error={error} disabled={disabled} variant="standard">
      {label && (
        <FormLabel sx={{ mb: 0.5, display: "block" }}>{label}</FormLabel>
      )}
      <Box
        ref={inputRef as React.RefObject<HTMLDivElement>}
        sx={{
          border: 1,
          borderColor: error ? "error.main" : "divider",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: disabled ? "action.hover" : "background.paper",
          "& .ProseMirror": {
            outline: "none",
            minHeight,
            px: 1.5,
            py: 1,
            "& p.is-editor-empty:first-child::before": {
              content: "attr(data-placeholder)",
              color: "text.disabled",
              float: "left",
              height: 0,
              pointerEvents: "none",
            },
            "& table": {
              borderCollapse: "collapse",
              width: "100%",
              "& td, & th": {
                border: "1px solid",
                borderColor: "divider",
                px: 1,
                py: 0.5,
              },
              "& th": {
                bgcolor: "action.hover",
                fontWeight: 600,
              },
            },
          },
        }}
      >
        {showToolbar && <Toolbar editor={editor} />}
        <EditorContent editor={editor} />
      </Box>
      {helperText && (
        <FormHelperText sx={{ mt: 0.5 }}>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
}
