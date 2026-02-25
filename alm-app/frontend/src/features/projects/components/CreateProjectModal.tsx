import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from "@mui/material";
import { RhfDescriptionField, RhfSelect, RhfTextField } from "../../../shared/components/forms";
import { useCreateOrgProject } from "../../../shared/api/orgApi";
import { useProcessTemplates } from "../../../shared/api/processTemplateApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

const createProjectSchema = z.object({
  code: z
    .string()
    .min(2, "Code must be 2-10 characters")
    .max(10, "Code must be 2-10 characters")
    .regex(
      /^[A-Za-z0-9]+$/,
      "Code must be alphanumeric only",
    )
    .transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  process_template_slug: z.string().min(1),
});

type CreateProjectFormData = z.input<typeof createProjectSchema> & {
  process_template_slug: string;
};

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  orgSlug?: string;
}

export default function CreateProjectModal({ open, onClose, orgSlug }: CreateProjectModalProps) {
  const createMutation = useCreateOrgProject(orgSlug);
  const { data: templates } = useProcessTemplates();
  const showNotification = useNotificationStore((s) => s.showNotification);

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { code: "", name: "", description: "", process_template_slug: "basic" },
  });
  const { control, handleSubmit, reset } = form;
  const templateOptions = (templates ?? [{ id: "basic", slug: "basic", name: "Basic", is_builtin: true }]).map(
    (t) => ({ value: t.slug, label: t.name }),
  );

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: CreateProjectFormData) => {
    if (!orgSlug) return;
    try {
      await createMutation.mutateAsync({
        code: data.code,
        name: data.name,
        description: data.description,
        process_template_slug: data.process_template_slug || "basic",
      });
      showNotification("Project created successfully");
      handleClose();
    } catch (err: unknown) {
      const problem = err as { detail?: string; message?: string };
      showNotification(
        problem.detail ?? problem.message ?? "Failed to create project",
        "error",
      );
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogTitle fontWeight={600}>New Project</DialogTitle>
          <DialogContent>
            <RhfTextField<CreateProjectFormData>
              name="code"
              label="Code"
              placeholder="e.g. ALM"
              fullWidth
              helperText="2-10 alphanumeric characters, uppercase"
              sx={{ mt: 1, mb: 2 }}
              inputProps={{ maxLength: 10 }}
            />
            <RhfTextField<CreateProjectFormData>
              name="name"
              label="Project name"
              fullWidth
              sx={{ mb: 2 }}
            />
            <Box sx={{ mb: 2 }}>
              <RhfSelect<CreateProjectFormData>
                name="process_template_slug"
                control={control}
                label="Process template"
                options={templateOptions}
              />
            </Box>
            <RhfDescriptionField<CreateProjectFormData>
              name="description"
              control={control}
              mode="text"
              label="Description (optional)"
              allowModeSwitch
              rows={4}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "Create"
              )}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
