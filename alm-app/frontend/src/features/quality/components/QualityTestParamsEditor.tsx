import { useTranslation } from "react-i18next";
import { Button, Input } from "../../../shared/components/ui";
import type { ParamDef, ParamRow, TestParamsDocument } from "../lib/testParams";
import { normalizeTestParams, validateTestParams } from "../lib/testParams";

export type QualityTestParamsEditorProps = {
  value: TestParamsDocument;
  onChange: (next: TestParamsDocument) => void;
  disabled?: boolean;
};

function emptyDoc(): TestParamsDocument {
  return { defs: [], rows: [] };
}

export function QualityTestParamsEditor({ value, onChange, disabled }: QualityTestParamsEditorProps) {
  const { t } = useTranslation("quality");
  const doc = normalizeTestParams(value.defs.length || value.rows?.length ? value : emptyDoc());
  const rows = doc.rows ?? [];
  const validation = validateTestParams(doc);

  const setDoc = (next: TestParamsDocument) => onChange(normalizeTestParams(next));

  const addDef = () => {
    const name = `param${doc.defs.length + 1}`;
    setDoc({ ...doc, defs: [...doc.defs, { name, label: "", default: "" }] });
  };

  const updateDef = (index: number, patch: Partial<ParamDef>) => {
    const prev = doc.defs[index];
    if (!prev) return;
    const merged = { ...prev, ...patch };
    const defs = doc.defs.map((d, i) => (i === index ? merged : d));
    let nextRows = rows;
    if (patch.name !== undefined && patch.name !== prev.name && prev.name) {
      nextRows = rows.map((r) => {
        const { [prev.name]: prevCell, ...rest } = r.values;
        return { ...r, values: { ...rest, [patch.name as string]: prevCell ?? "" } };
      });
    }
    setDoc({ ...doc, defs, rows: nextRows.length > 0 ? nextRows : undefined });
  };

  const removeDef = (index: number) => {
    const name = doc.defs[index]?.name;
    const defs = doc.defs.filter((_, i) => i !== index);
    const nextRows = rows.map((r) => {
      if (!name) return r;
      const { [name]: _, ...rest } = r.values;
      return { ...r, values: rest };
    });
    setDoc({ defs, rows: nextRows.length > 0 ? nextRows : undefined });
  };

  const addRow = () => {
    const values: Record<string, string> = {};
    for (const d of doc.defs) values[d.name] = "";
    setDoc({
      ...doc,
      rows: [...rows, { id: crypto.randomUUID(), name: `config_${rows.length + 1}`, label: "", values, status: "active" }],
    });
  };

  const updateRow = (rowIndex: number, patch: Partial<ParamRow>) => {
    const next = rows.map((r, i) => (i === rowIndex ? { ...r, ...patch } : r));
    setDoc({ ...doc, rows: next });
  };

  const updateRowCell = (rowIndex: number, key: string, val: string) => {
    const next = rows.map((r, i) =>
      i === rowIndex ? { ...r, values: { ...r.values, [key]: val } } : r,
    );
    setDoc({ ...doc, rows: next });
  };

  const removeRow = (rowIndex: number) => {
    const next = rows.filter((_, i) => i !== rowIndex);
    setDoc({ ...doc, rows: next.length > 0 ? next : undefined });
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/20 p-3" data-testid="quality-test-params-editor">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("params.sectionTitle")}</h3>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addDef} data-testid="quality-param-add-def">
          {t("params.addParam")}
        </Button>
      </div>

      {doc.defs.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("params.emptyHint")}</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-medium uppercase text-muted-foreground">
            <span>{t("params.columns.name")}</span>
            <span>{t("params.columns.label")}</span>
            <span>{t("params.columns.default")}</span>
            <span className="w-8" />
          </div>
          {doc.defs.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <Input
                value={d.name}
                disabled={disabled}
                onChange={(e) => updateDef(i, { name: e.target.value })}
                placeholder="name"
                data-testid={`quality-param-name-${i}`}
              />
              <Input
                value={d.label ?? ""}
                disabled={disabled}
                onChange={(e) => updateDef(i, { label: e.target.value })}
                placeholder={t("params.placeholders.label")}
                data-testid={`quality-param-label-${i}`}
              />
              <Input
                value={d.default ?? ""}
                disabled={disabled}
                onChange={(e) => updateDef(i, { default: e.target.value })}
                placeholder={t("params.placeholders.default")}
                data-testid={`quality-param-default-${i}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 px-2"
                disabled={disabled}
                onClick={() => removeDef(i)}
                data-testid={`quality-param-remove-${i}`}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {doc.defs.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t("params.datasetTitle")}</span>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRow} data-testid="quality-param-add-row">
              {t("params.addRow")}
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("params.datasetEmpty")}</p>
          ) : (
            <div className="space-y-3 overflow-x-auto">
              {rows.map((row, ri) => (
                <div key={ri} className="rounded border border-border bg-background p-2">
                  <div className="mb-2 flex items-center gap-2">
                    <Input
                      className="h-8 max-w-[10rem] text-xs font-mono"
                      value={row.name ?? ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(ri, { name: e.target.value })}
                      placeholder={t("params.rowNamePlaceholder")}
                      data-testid={`quality-param-row-name-${ri}`}
                    />
                    <Input
                      className="h-8 max-w-xs text-xs"
                      value={row.label ?? ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(ri, { label: e.target.value })}
                      placeholder={t("params.rowLabelPlaceholder")}
                      data-testid={`quality-param-row-label-${ri}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      disabled={disabled}
                      onClick={() => removeRow(ri)}
                      data-testid={`quality-param-row-remove-${ri}`}
                    >
                      {t("params.removeRow")}
                    </Button>
                  </div>
                  <p className="mb-2 text-[10px] text-muted-foreground">
                    {t("params.configurationId")}: <span className="font-mono">{row.id}</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {doc.defs.map((d, di) => (
                      <div key={di} className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">{d.name}</label>
                        <Input
                          className="h-8 text-xs"
                          value={row.values[d.name] ?? ""}
                          disabled={disabled}
                          onChange={(e) => updateRowCell(ri, d.name, e.target.value)}
                          data-testid={`quality-param-row-${ri}-cell-${d.name}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {validation.hasErrors ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {validation.paramErrors.map((error, index) => (
            <p key={`param-${index}`}>{error}</p>
          ))}
          {validation.rowErrors.map((error, index) => (
            <p key={`row-${index}`}>{error}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
