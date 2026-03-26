/**
 * Monaco-based JSON/YAML manifest editor.
 */
import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

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
    <div className="overflow-hidden rounded-md border border-border [&_.manifest-editor-error-line]:bg-destructive/20 [&_.manifest-editor-error-glyph]:ml-1 [&_.manifest-editor-error-glyph]:w-1 [&_.manifest-editor-error-glyph]:bg-destructive">
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
          <div style={{ height }} className="flex items-center justify-center bg-muted/50">
            Loading editor…
          </div>
        }
      />
    </div>
  );
}
