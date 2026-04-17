import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";

export interface ReportSqlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Total editor height in pixels. */
  height?: number;
}

/**
 * Monaco SQL editor (syntax highlighting, word wrap). Theme follows app light/dark.
 */
export function ReportSqlEditor({
  value,
  onChange,
  readOnly = false,
  height = 280,
}: ReportSqlEditorProps) {
  const { t } = useTranslation("reports");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const monacoTheme = mounted && resolvedTheme === "dark" ? "vs-dark" : "light";

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Editor
        height={height}
        theme={monacoTheme}
        language="sql"
        value={value}
        onChange={readOnly ? undefined : (v: string | undefined) => onChange?.(v ?? "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          fontSize: 12,
          tabSize: 2,
          automaticLayout: true,
          folding: true,
        }}
        loading={
          <div
            style={{ height }}
            className="flex items-center justify-center bg-muted/50 text-sm text-muted-foreground"
          >
            {t("new.editorLoading")}
          </div>
        }
      />
    </div>
  );
}
