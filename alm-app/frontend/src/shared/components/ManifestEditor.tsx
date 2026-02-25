/**
 * Monaco-based JSON/YAML manifest editor.
 */
import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Box } from "@mui/material";

export interface ManifestEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "json" | "yaml";
  readOnly?: boolean;
  height?: number;
  /** 1-based line number to highlight as error (e.g. parse error). Cleared when 0 or undefined. */
  errorLine?: number;
}

export function ManifestEditor({
  value,
  onChange,
  language = "json",
  readOnly = false,
  height = 480,
  errorLine,
}: ManifestEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  const onEditorMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;
  };

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    // Clear previous decorations
    if (decorationIdsRef.current.length > 0) {
      ed.deltaDecorations(decorationIdsRef.current, []);
      decorationIdsRef.current = [];
    }

    if (errorLine == null || errorLine < 1) return;

    const model = ed.getModel();
    if (!model) return;
    const lineCount = model.getLineCount();
    const line = Math.min(errorLine, lineCount);
    const newIds = ed.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
          options: {
            isWholeLine: true,
            className: "manifest-editor-error-line",
            glyphMarginClassName: "manifest-editor-error-glyph",
          },
        },
      ],
    );
    decorationIdsRef.current = newIds;
    ed.revealLineInCenter(line);
    return () => {
      if (decorationIdsRef.current.length > 0) {
        ed.deltaDecorations(decorationIdsRef.current, []);
        decorationIdsRef.current = [];
      }
    };
  }, [errorLine]);

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      <Box
        sx={{
          "& .manifest-editor-error-line": {
            backgroundColor: "error.light",
            opacity: 0.2,
          },
          "& .manifest-editor-error-glyph": {
            backgroundColor: "error.main",
            width: "4px !important",
            marginLeft: "4px",
          },
        }}
      >
        <Editor
          height={height}
          language={language}
          value={value}
          onChange={onChange ? (v: string | undefined) => v != null && onChange(v) : undefined}
          onMount={onEditorMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            lineNumbers: "on",
            folding: true,
            glyphMargin: true,
          }}
          loading={
            <Box
              sx={{
                height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "action.hover",
              }}
            >
              Loading editor…
            </Box>
          }
        />
      </Box>
    </Box>
  );
}
