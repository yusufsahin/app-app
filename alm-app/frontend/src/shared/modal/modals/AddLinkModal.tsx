import { useForm, FormProvider } from "react-hook-form";
import { Button, Box } from "@mui/material";
import { RhfSelect } from "../../components/forms";
import type { AddLinkModalProps } from "../modalTypes";

type Props = AddLinkModalProps & { onClose: () => void };

type FormValues = { linkType: string; artifactId: string };

export function AddLinkModal({ artifactOptions, onCreateLink, onClose }: Props) {
  const form = useForm<FormValues>({
    defaultValues: { linkType: "related", artifactId: "" },
  });

  const onSubmit = (data: FormValues) => {
    if (!data.artifactId) return;
    onCreateLink(data.linkType, data.artifactId);
    onClose();
  };

  return (
    <FormProvider {...form}>
      <Box component="form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <RhfSelect<FormValues>
          name="linkType"
          control={form.control}
          label="Link type"
          options={[
            { value: "related", label: "Related" },
            { value: "parent", label: "Parent" },
            { value: "child", label: "Child" },
            { value: "blocks", label: "Blocks" },
            { value: "duplicate", label: "Duplicate" },
          ]}
          selectProps={{ size: "small", fullWidth: true }}
        />
        <RhfSelect<FormValues>
          name="artifactId"
          control={form.control}
          label="Artifact to link to"
          placeholder="Select an artifact"
          options={artifactOptions}
          selectProps={{ size: "small", fullWidth: true }}
        />
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!form.watch("artifactId")}
          >
            Add link
          </Button>
        </Box>
      </Box>
    </FormProvider>
  );
}
