import { useState, useEffect, useMemo } from "react";
import { Save, User } from "lucide-react";
import { Button, Input } from "../../components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { MetadataDrivenForm } from "../../components/forms";
import type { CreateArtifactModalProps } from "../modalTypes";
import type { FormSchemaDto } from "../../types/formSchema";

type Props = CreateArtifactModalProps & { onClose: () => void };

const DETAILS_TAB = "details";

export function CreateArtifactModal({
  formSchema,
  formValues: initialFormValues,
  formErrors,
  onFormChange,
  onFormErrors,
  onCreate,
  isPending,
  parentArtifacts,
  userOptions,
  artifactTypeParentMap,
  formSchemaError,
  formSchema403,
  onClose,
}: Props) {
  const [formValues, setFormValues] = useState(initialFormValues);
  const [activeTab, setActiveTab] = useState(DETAILS_TAB);

  useEffect(() => {
    setFormValues(initialFormValues);
  }, [initialFormValues]);

  const updateField = (key: string, value: unknown) => {
    const next = { ...formValues, [key]: value };
    setFormValues(next);
    onFormChange(next);
    onFormErrors({ ...formErrors, [key]: "" });
  };

  const typeLabel = useMemo(() => {
    if (!formSchema?.artifact_type_options) return "Artifact";
    const id = (formValues.artifact_type as string) ?? "";
    return formSchema.artifact_type_options.find((o) => o.id === id)?.label ?? (id || "Artifact");
  }, [formSchema?.artifact_type_options, formValues.artifact_type]);

  const detailsSchema = useMemo((): FormSchemaDto | null => {
    if (!formSchema) return null;
    const detailsFields = formSchema.fields.filter(
      (f) => f.key !== "title" && f.key !== "artifact_type",
    );
    return { ...formSchema, fields: detailsFields };
  }, [formSchema]);

  const assigneeLabel = useMemo(() => {
    const id = (formValues.assignee_id as string) ?? "";
    if (!id) return "No one selected";
    return userOptions.find((u) => u.id === id)?.label ?? id;
  }, [formValues.assignee_id, userOptions]);

  if (formSchema403) {
    return (
      <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        You don&apos;t have permission to view the process manifest for this project. The create
        form cannot be loaded.
      </div>
    );
  }
  if (formSchemaError) {
    return (
      <div role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        Could not load the form. Please try again or check your permission to view the process
        manifest.
      </div>
    );
  }
  if (!formSchema) {
    return <p className="text-muted-foreground">Loading form schema…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border bg-muted/30 px-0 py-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onCreate(formValues)} disabled={isPending}>
          <Save className="mr-1.5 size-4" />
          Save
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-0">
        <div className="pt-4 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            NEW {typeLabel.toUpperCase()} *
          </span>
          {formErrors.artifact_type && (
            <p className="mt-1 text-xs text-destructive">{formErrors.artifact_type}</p>
          )}
          <div className="mt-2">
            <Input
              className="text-lg"
              placeholder="Enter title"
              value={(formValues.title as string) ?? ""}
              onChange={(e) => updateField("title", e.target.value)}
              aria-invalid={!!formErrors.title}
            />
            {formErrors.title && <p className="mt-1 text-xs text-destructive">{formErrors.title}</p>}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{assigneeLabel}</span>
          </div>
        </div>

        <hr className="my-4 border-border" />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="h-10 border-b border-border bg-transparent">
            <TabsTrigger value={DETAILS_TAB}>Details</TabsTrigger>
          </TabsList>

          {activeTab === DETAILS_TAB && detailsSchema && (
            <TabsContent value={DETAILS_TAB} className="py-4">
              <MetadataDrivenForm
                schema={detailsSchema}
                values={formValues}
                onChange={(v) => {
                  setFormValues(v);
                  onFormChange(v);
                  onFormErrors({});
                }}
                onSubmit={() => onCreate(formValues)}
                submitLabel="Create"
                disabled={isPending}
                submitExternally
                errors={formErrors}
                parentArtifacts={parentArtifacts}
                artifactTypeParentMap={artifactTypeParentMap}
                userOptions={userOptions}
                disableNativeRequired
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
