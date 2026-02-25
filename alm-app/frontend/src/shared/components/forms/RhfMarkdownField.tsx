/**
 * Reusable Markdown field wired to React Hook Form via Controller.
 * Form value: raw markdown string. Use z.string() in Zod.
 * Optional live preview and toolbar to insert markdown syntax.
 */
import { useRef, useState } from "react";
import { Controller } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import {
  Box,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Tab,
  Tabs,
  TextField,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import Code from "@mui/icons-material/Code";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import FormatListNumbered from "@mui/icons-material/FormatListNumbered";
import Link from "@mui/icons-material/Link";
import Visibility from "@mui/icons-material/Visibility";
import Edit from "@mui/icons-material/Edit";
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
    <ToggleButtonGroup size="small" sx={{ flexWrap: "wrap", gap: 0, p: 0.5, borderBottom: 1, borderColor: "divider" }}>
      <IconButton
        size="small"
        onClick={() => handleWrap("**", "**", "bold text")}
        aria-label="Bold"
      >
        <FormatBold fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => handleWrap("*", "*", "italic text")}
        aria-label="Italic"
      >
        <FormatItalic fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => handleWrap("[", "](url)", "link text")}
        aria-label="Link"
      >
        <Link fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => handleWrap("`", "`", "code")}
        aria-label="Inline code"
      >
        <Code fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
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
      >
        <FormatListBulleted fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
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
      >
        <FormatListNumbered fontSize="small" />
      </IconButton>
    </ToggleButtonGroup>
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

interface MarkdownFieldInnerProps {
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

const MarkdownFieldInner = ({
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
    <FormControl fullWidth error={error} disabled={disabled} variant="standard">
      {label && (
        <FormLabel sx={{ mb: 0.5, display: "block" }}>{label}</FormLabel>
      )}
      <Box
        sx={{
          border: 1,
          borderColor: error ? "error.main" : "divider",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: disabled ? "action.hover" : "background.paper",
        }}
      >
        {showPreview && (
          <Tabs
            value={view}
            onChange={(_, v) => setView(v as ViewMode)}
            variant="fullWidth"
            sx={{ minHeight: 36, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab value="edit" icon={<Edit />} iconPosition="start" label="Edit" />
            <Tab value="preview" icon={<Visibility />} iconPosition="start" label="Preview" />
            <Tab value="split" icon={<Visibility />} iconPosition="start" label="Split" />
          </Tabs>
        )}
        {showToolbar && (!showPreview || view === "edit" || view === "split") && (
          <MarkdownToolbar textareaRef={textareaRef} onInsert={onChange} />
        )}
        <Box sx={{ display: "flex", flexDirection: view === "split" ? "row" : "column", minHeight }}>
          {(!showPreview || view === "edit" || view === "split") && (
                  <Box sx={{ flex: view === "split" ? 1 : undefined, display: "flex", flexDirection: "column" }}>
                    <TextField
                      inputRef={(el) => {
                        (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                        if (typeof ref === "function") ref(el);
                        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                      }}
                      value={raw}
                      onChange={(e) => onChange(e.target.value)}
                      onBlur={onBlur}
                      placeholder={placeholder}
                      disabled={disabled}
                      multiline
                      minRows={rows}
                      maxRows={view === "split" ? rows : undefined}
                      variant="standard"
                      InputProps={{
                        disableUnderline: true,
                        sx: {
                          minHeight: view === "split" ? minHeight / 2 : minHeight,
                          px: 1.5,
                          py: 1,
                          fontSize: "0.875rem",
                          fontFamily: "monospace",
                        },
                      }}
                      sx={{ flex: 1, "& .MuiInputBase-root": { alignItems: "flex-start" } }}
                    />
                  </Box>
          )}
          {showPreview && (view === "preview" || view === "split") && (
            <Box
              sx={{
                flex: 1,
                minHeight: view === "split" ? minHeight / 2 : minHeight,
                px: 1.5,
                py: 1,
                overflow: "auto",
                borderLeft: view === "split" ? 1 : 0,
                borderColor: "divider",
                "& h1": { fontSize: "1.5rem", mt: 1, mb: 0.5 },
                "& h2": { fontSize: "1.25rem", mt: 1, mb: 0.5 },
                "& h3": { fontSize: "1.1rem", mt: 0.5 },
                "& pre": { bgcolor: "action.hover", p: 1, borderRadius: 1, overflow: "auto" },
                "& code": { fontFamily: "monospace", fontSize: "0.85em" },
                "& ul, & ol": { pl: 2 },
                "& table": { borderCollapse: "collapse", "& td, & th": { border: "1px solid", borderColor: "divider", px: 1, py: 0.5 } },
              }}
            >
              {raw.trim() ? (
                <ReactMarkdown>{raw}</ReactMarkdown>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  Nothing to preview
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>
      {helperText && (
        <FormHelperText sx={{ mt: 0.5 }}>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
};
