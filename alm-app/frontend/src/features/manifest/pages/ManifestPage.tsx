import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Chip,
  Skeleton,
  Alert,
  Breadcrumbs,
  Link as MuiLink,
  Tabs,
  Tab,
  Snackbar,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { ArrowBack, AccountTree, Policy, Preview, Code, ViewModule, Save, DataObject, AccountTreeOutlined } from "@mui/icons-material";
import yaml from "js-yaml";
import { useOrgProjects } from "../../../shared/api/orgApi";

/** Get 1-based line number from JSON.parse position (e.g. "Unexpected token at position 42"). */
function jsonErrorLine(source: string, error: unknown): number | undefined {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/\bposition\s+(\d+)/i);
  if (!match) return undefined;
  const position = Math.max(0, parseInt(match[1] ?? "0", 10));
  let line = 1;
  for (let i = 0; i < position && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}
import {
  useProjectManifest,
  useUpdateProjectManifest,
  type ManifestResponse,
} from "../../../shared/api/manifestApi";
import type { ProblemDetail } from "../../../shared/api/types";
import { buildPreviewSchemaFromManifest } from "../../../shared/lib/manifestPreviewSchema";
import { MetadataDrivenForm } from "../../../shared/components/forms/MetadataDrivenForm";
import { ManifestEditor } from "../../../shared/components/ManifestEditor";
import { useManifestStore } from "../../../shared/stores/manifestStore";
import { WorkflowDesignerView } from "../components/WorkflowDesignerView";

export default function ManifestPage() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const navigate = useNavigate();
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);

  const {
    data: manifest,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectManifest(orgSlug, project?.id);
  const apiError = error as unknown as ProblemDetail | undefined;
  const is404 = isError && apiError?.status === 404;
  const is403 = isError && apiError?.status === 403;

  const {
    activeTab,
    sourceValue,
    sourceLanguage,
    snackMessage,
    snackOpen,
    setActiveTab,
    setSourceValue,
    setSourceLanguage,
    showSnack,
    resetEditorFromBundle,
    clearSnack,
  } = useManifestStore();

  const updateManifest = useUpdateProjectManifest(orgSlug, project?.id);
  const [editorErrorLine, setEditorErrorLine] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (manifest?.manifest_bundle != null) {
      resetEditorFromBundle(manifest.manifest_bundle);
    }
  }, [manifest?.manifest_bundle, resetEditorFromBundle]);

  const handleSourceLanguageChange = (_: React.MouseEvent<HTMLElement>, value: "json" | "yaml" | null) => {
    if (value === null) return;
    if (value === sourceLanguage) return;
    setEditorErrorLine(undefined);
    try {
      if (value === "yaml") {
        const parsed = JSON.parse(sourceValue) as object;
        setSourceValue(yaml.dump(parsed, { indent: 2, lineWidth: -1 }));
      } else {
        const parsed = yaml.load(sourceValue) as object;
        setSourceValue(JSON.stringify(parsed, null, 2));
      }
      setSourceLanguage(value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const yamlLine = e && typeof e === "object" && "mark" in e ? (e as { mark?: { line?: number } }).mark?.line : undefined;
      const oneBased = yamlLine != null ? yamlLine + 1 : (jsonErrorLine(sourceValue, e) ?? 1);
      setEditorErrorLine(oneBased);
      showSnack(yamlLine != null ? `Parse error at line ${oneBased}: ${msg}` : `Parse error: ${msg}`);
    }
  };

  const previewSchema = useMemo(
    () => (manifest?.manifest_bundle ? buildPreviewSchemaFromManifest(manifest.manifest_bundle) : null),
    [manifest?.manifest_bundle],
  );
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});

  const handleSourceChange = (value: string) => {
    setEditorErrorLine(undefined);
    setSourceValue(value);
  };

  const handleSaveManifest = () => {
    setEditorErrorLine(undefined);
    let bundle: unknown;
    try {
      if (sourceLanguage === "yaml") {
        bundle = yaml.load(sourceValue);
        if (typeof bundle === "string" || typeof bundle === "number" || bundle === null) {
          showSnack("YAML must parse to an object (workflows, artifact_types, policies).");
          return;
        }
      } else {
        bundle = JSON.parse(sourceValue);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const yamlLine = e && typeof e === "object" && "mark" in e ? (e as { mark?: { line?: number } }).mark?.line : undefined;
      const oneBased = yamlLine != null ? yamlLine + 1 : (jsonErrorLine(sourceValue, e) ?? 1);
      setEditorErrorLine(oneBased);
      showSnack(yamlLine != null ? `Parse error at line ${oneBased}: ${msg}` : (sourceLanguage === "yaml" ? "Invalid YAML. Fix syntax before saving." : `Invalid JSON at line ${oneBased}. Fix syntax before saving.`));
      return;
    }
    if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) {
      showSnack("Manifest must be an object (workflows, artifact_types, policies).");
      return;
    }
    updateManifest.mutate(bundle as ManifestResponse["manifest_bundle"], {
      onSuccess: () => {
        setEditorErrorLine(undefined);
        showSnack("Manifest saved.");
      },
      onError: (err: Error) => showSnack(err?.message ?? "Failed to save manifest."),
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink
          component={Link}
          to={orgSlug ? `/${orgSlug}` : "#"}
          underline="hover"
          color="inherit"
        >
          {orgSlug ?? "Org"}
        </MuiLink>
        {project && (
          <MuiLink
            component={Link}
            to={`/${orgSlug}/${projectSlug}`}
            underline="hover"
            color="inherit"
          >
            {project.name}
          </MuiLink>
        )}
        <Typography color="text.primary">Process manifest</Typography>
      </Breadcrumbs>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "..")}
        sx={{ mb: 3 }}
      >
        Back to project
      </Button>

      {!project && projectSlug ? (
        <Typography color="text.secondary">Project &quot;{projectSlug}&quot; not found.</Typography>
      ) : isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
        </Box>
      ) : is403 ? (
        <Alert severity="error">
          You don&apos;t have permission to view the manifest for this project.
        </Alert>
      ) : is404 ? (
        <Alert
          severity="warning"
          action={
            project?.id && orgSlug ? (
              <Button
                color="inherit"
                size="small"
                onClick={() =>
                  updateManifest.mutate(
                    {
                      workflows: [],
                      artifact_types: [],
                      link_types: [],
                    },
                    {
                      onSuccess: () => refetch(),
                      onError: () => {},
                    },
                  )
                }
                disabled={updateManifest.isPending}
              >
                {updateManifest.isPending ? "Initializing…" : "Initialize manifest"}
              </Button>
            ) : null
          }
        >
          This project has no process template assigned. Initialize a manifest to get started.
        </Alert>
      ) : isError ? (
        <Alert severity="warning">
          Could not load the manifest. Please try again later.
        </Alert>
      ) : manifest ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="h4" fontWeight={700}>
              Process Manifest
            </Typography>
            <Chip label={manifest.template_name} size="small" color="primary" />
            <Typography variant="body2" color="text.secondary">
              v{manifest.version}
            </Typography>
          </Box>

          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tab value="overview" label="Overview" icon={<ViewModule fontSize="small" />} iconPosition="start" />
            <Tab value="workflow" label="Workflow" icon={<AccountTreeOutlined fontSize="small" />} iconPosition="start" />
            <Tab value="preview" label="Form preview" icon={<Preview fontSize="small" />} iconPosition="start" />
            <Tab value="source" label="Source" icon={<Code fontSize="small" />} iconPosition="start" />
          </Tabs>

          {activeTab === "source" && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              {editorErrorLine != null && editorErrorLine >= 1 && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditorErrorLine(undefined)}>
                  Parse error at line {editorErrorLine}. Fix the syntax above and try again.
                </Alert>
              )}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
                <ToggleButtonGroup
                  value={sourceLanguage}
                  exclusive
                  onChange={handleSourceLanguageChange}
                  size="small"
                  aria-label="Source format"
                >
                  <ToggleButton value="json" aria-label="JSON">
                    <DataObject sx={{ mr: 0.5 }} fontSize="small" />
                    JSON
                  </ToggleButton>
                  <ToggleButton value="yaml" aria-label="YAML">
                    <Code sx={{ mr: 0.5 }} fontSize="small" />
                    YAML
                  </ToggleButton>
                </ToggleButtonGroup>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSaveManifest}
                  disabled={updateManifest.isPending}
                >
                  {updateManifest.isPending ? "Saving…" : "Save manifest"}
                </Button>
              </Box>
              <ManifestEditor
                value={sourceValue}
                onChange={handleSourceChange}
                language={sourceLanguage}
                readOnly={false}
                height={480}
                errorLine={editorErrorLine}
              />
            </Paper>
          )}

          {activeTab === "workflow" && (
            <WorkflowDesignerView
              workflows={(manifest.manifest_bundle?.workflows ?? []) as Array<{ id: string; name?: string; states?: Array<{ id: string; name?: string; category?: string }>; transitions?: Array<{ from: string; to: string }> }>}
              editable
              isSaving={updateManifest.isPending}
              onSaveWorkflow={(updatedWorkflow) => {
                const bundle = { ...manifest.manifest_bundle } as Record<string, unknown>;
                const workflows = Array.isArray(bundle.workflows) ? [...bundle.workflows] : [];
                const idx = workflows.findIndex((w: { id?: string }) => (w as { id?: string }).id === updatedWorkflow.id);
                if (idx >= 0) workflows[idx] = updatedWorkflow;
                else workflows.push(updatedWorkflow);
                updateManifest.mutate(
                  { ...bundle, workflows } as ManifestResponse["manifest_bundle"],
                  {
                    onSuccess: () => showSnack("Workflow saved."),
                    onError: (err: Error) => showSnack(err?.message ?? "Failed to save workflow."),
                  },
                );
              }}
            />
          )}

          {activeTab === "preview" && previewSchema && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography variant="overline" color="primary" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Preview fontSize="small" />
                Artifact form preview (from manifest)
              </Typography>
              <MetadataDrivenForm
                schema={previewSchema}
                values={previewValues}
                onChange={setPreviewValues}
                onSubmit={() => {}}
                submitLabel="Create (preview only)"
                disabled
                submitExternally
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                This is a live preview of the create-artifact form derived from the manifest. Submit is disabled.
              </Typography>
            </Paper>
          )}

          {activeTab === "overview" && (
            <>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="overline" color="primary" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <AccountTree fontSize="small" />
              Workflows
            </Typography>
            {manifest.manifest_bundle.workflows &&
            manifest.manifest_bundle.workflows.length > 0 ? (
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                {JSON.stringify(manifest.manifest_bundle.workflows, null, 2)}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No workflows defined.
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="overline" color="primary" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Policy fontSize="small" />
              Policies
            </Typography>
            {manifest.manifest_bundle.policies &&
            manifest.manifest_bundle.policies.length > 0 ? (
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                {JSON.stringify(manifest.manifest_bundle.policies, null, 2)}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No policies defined.
              </Typography>
            )}
          </Paper>
            </>
          )}
        </Box>
      ) : null}
      <Snackbar
        open={snackOpen}
        autoHideDuration={6000}
        onClose={clearSnack}
        message={snackMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Container>
  );
}
