import { useForm, FormProvider, useWatch } from "react-hook-form";
import { Button } from "../../components/ui";
import { RhfSelect } from "../../components/forms";
import type { AddLinkModalProps } from "../modalTypes";

type Props = AddLinkModalProps & { onClose: () => void };

type FormValues = { linkType: string; artifactId: string };

const BUILTIN_LINK_TYPES: Array<{ value: string; label: string }> = [
  { value: "related", label: "Related" },
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "blocks", label: "Blocks" },
  { value: "duplicate", label: "Duplicate" },
];

export function AddLinkModal({ artifactOptions, linkTypeOptions, onCreateLink, onClose }: Props) {
  const typeOptions =
    linkTypeOptions && linkTypeOptions.length > 0 ? linkTypeOptions : BUILTIN_LINK_TYPES;
  const form = useForm<FormValues>({
    defaultValues: { linkType: typeOptions[0]?.value ?? "related", artifactId: "" },
  });
  const artifactId = useWatch({ control: form.control, name: "artifactId" }) ?? "";

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
          label="Link type"
          options={typeOptions}
          selectProps={{ size: "sm" }}
        />
        <RhfSelect<FormValues>
          name="artifactId"
          control={form.control}
          label="Artifact to link to"
          placeholder="Select an artifact"
          options={artifactOptions}
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
