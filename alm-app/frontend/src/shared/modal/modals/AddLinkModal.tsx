import { useForm, FormProvider, useWatch } from "react-hook-form";
import { Button } from "../../components/ui";
import { RhfSelect } from "../../components/forms";
import type { AddLinkModalProps } from "../modalTypes";

type Props = AddLinkModalProps & { onClose: () => void };

type FormValues = { linkType: string; artifactId: string };

const BUILTIN_LINK_TYPES: Array<{ value: string; label: string; category?: string; allowedTargetTypes?: string[] }> = [
  { value: "related", label: "Related", category: "related" },
  { value: "impacts", label: "Impacts", category: "planning" },
  { value: "blocks", label: "Blocks", category: "planning" },
];

export function AddLinkModal({ artifactOptions, linkTypeOptions, onCreateLink, onClose }: Props) {
  const typeOptions =
    linkTypeOptions && linkTypeOptions.length > 0 ? linkTypeOptions : BUILTIN_LINK_TYPES;
  const form = useForm<FormValues>({
    defaultValues: { linkType: typeOptions[0]?.value ?? "related", artifactId: "" },
  });
  const selectedLinkType = useWatch({ control: form.control, name: "linkType" }) ?? typeOptions[0]?.value ?? "related";
  const artifactId = useWatch({ control: form.control, name: "artifactId" }) ?? "";
  const selectedType = typeOptions.find((option) => option.value === selectedLinkType);
  const filteredArtifactOptions = artifactOptions.filter((option) => {
    const allowed = selectedType?.allowedTargetTypes;
    if (!allowed || allowed.length === 0) return true;
    return !!option.artifactType && allowed.includes(option.artifactType);
  });

  const onSubmit = (data: FormValues) => {
    if (!data.artifactId) return;
    onCreateLink(data.linkType, data.artifactId);
    onClose();
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <RhfSelect<FormValues>
          name="linkType"
          control={form.control}
          label="Relationship type"
          options={typeOptions}
          selectProps={{ size: "sm" }}
        />
        <RhfSelect<FormValues>
          name="artifactId"
          control={form.control}
          label="Artifact to relate"
          placeholder="Select an artifact"
          options={filteredArtifactOptions}
          selectProps={{ size: "sm" }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!artifactId}
          >
            Add link
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
