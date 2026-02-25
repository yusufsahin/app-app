import { useState, useEffect } from "react";
import { Button, Box, Typography, Alert } from "@mui/material";
import { MetadataDrivenForm } from "../../components/forms";
import type { CreateArtifactModalProps } from "../modalTypes";

type Props = CreateArtifactModalProps & { onClose: () => void };

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
  useEffect(() => {
    setFormValues(initialFormValues);
  }, [initialFormValues]);

  return (
    <>
      {formSchema ? (
        <MetadataDrivenForm
          schema={formSchema}
          values={formValues}
          onChange={(v) => {
            setFormValues(v);
            onFormChange(v);
            onFormErrors({});
          }}
          onSubmit={onCreate}
          submitLabel="Create"
          disabled={isPending}
          submitExternally
          errors={formErrors}
          parentArtifacts={parentArtifacts}
          artifactTypeParentMap={artifactTypeParentMap}
          userOptions={userOptions}
        />
      ) : formSchema403 ? (
        <Alert severity="error">
          You don&apos;t have permission to view the process manifest for this project. The create
          form cannot be loaded.
        </Alert>
      ) : formSchemaError ? (
        <Alert severity="warning">
          Could not load the form. Please try again or check your permission to view the process
          manifest.
        </Alert>
      ) : (
        <Typography color="text.secondary">Loading form schema…</Typography>
      )}
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        {formSchema && (
          <Button variant="contained" onClick={onCreate} disabled={isPending}>
            Create
          </Button>
        )}
      </Box>
    </>
  );
}
