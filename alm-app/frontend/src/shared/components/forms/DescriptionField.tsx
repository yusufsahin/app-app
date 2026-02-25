/**
 * Reusable Description field: plain text, rich text (WYSIWYG), or markdown.
 * Controlled component (value + onChange). Use in metadata-driven forms or wrap with Controller for RHF.
 */
import { useRef, useState } from "react";
import { Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { DescriptionInputMode } from "../../types/formSchema";
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
  /** Show toolbar for markdown/richtext. Default true. */
  showToolbar?: boolean;
  /** Show preview tabs for markdown. Default true when mode is markdown. */
  showPreview?: boolean;
  /** When true, show Text | Rich text | Markdown switcher so user can change mode. Default false. */
  allowModeSwitch?: boolean;
}

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
    <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
      {label && (
        <Typography component="span" variant="body2" color="text.secondary">
          {label}
        </Typography>
      )}
      <ToggleButtonGroup
        size="small"
        value={mode}
        exclusive
        onChange={(_, v) => v != null && setLocalMode(v)}
        aria-label="Description format"
      >
        <ToggleButton value="text" aria-label="Plain text">Text</ToggleButton>
        <ToggleButton value="richtext" aria-label="Rich text">Rich text</ToggleButton>
        <ToggleButton value="markdown" aria-label="Markdown">Markdown</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );

  if (mode === "richtext") {
    return (
      <Box>
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
      </Box>
    );
  }

  if (mode === "markdown") {
    return (
      <Box>
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
      </Box>
    );
  }

  return (
    <Box>
      {modeSelector}
      <TextField
        fullWidth
        label={allowModeSwitch ? undefined : label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        error={error}
        helperText={helperText}
        disabled={disabled}
        multiline
        minRows={rows}
        variant="outlined"
      />
    </Box>
  );
}
