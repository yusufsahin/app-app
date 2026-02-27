import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Box,
  Typography,
  Alert,
  TextField,
  Divider,
  Tabs,
  Tab,
} from "@mui/material";
import { Person as PersonIcon, Save } from "@mui/icons-material";
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
      <Alert severity="error">
        You don&apos;t have permission to view the process manifest for this project. The create
        form cannot be loaded.
      </Alert>
    );
  }
  if (formSchemaError) {
    return (
      <Alert severity="warning">
        Could not load the form. Please try again or check your permission to view the process
        manifest.
      </Alert>
    );
  }
  if (!formSchema) {
    return <Typography color="text.secondary">Loading form schema…</Typography>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Toolbar – Azure DevOps style */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 1,
          px: 0,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "grey.50",
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} color="inherit" size="small">
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<Save />}
          onClick={() => onCreate(formValues)}
          disabled={isPending}
        >
          Save
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0, px: 0 }}>
        {/* Type + Title block */}
        <Box sx={{ pt: 2, pb: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: 0.5 }}
          >
            NEW {typeLabel.toUpperCase()} *
          </Typography>
          {formErrors.artifact_type && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
              {formErrors.artifact_type}
            </Typography>
          )}
          <TextField
            fullWidth
            placeholder="Enter title"
            value={(formValues.title as string) ?? ""}
            onChange={(e) => updateField("title", e.target.value)}
            error={!!formErrors.title}
            helperText={formErrors.title}
            sx={{
              mt: 1,
              "& .MuiOutlinedInput-root": {
                bgcolor: "background.paper",
                fontSize: "1.125rem",
              },
            }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
            <PersonIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">
              {assigneeLabel}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Tabs: Details (and future Links, Attachments) */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            minHeight: 40,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 500 },
            "& .Mui-selected": { color: "primary.main" },
          }}
        >
          <Tab label="Details" value={DETAILS_TAB} />
        </Tabs>

        {activeTab === DETAILS_TAB && detailsSchema && (
          <Box sx={{ py: 2 }}>
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
          </Box>
        )}
      </Box>
    </Box>
  );
}
