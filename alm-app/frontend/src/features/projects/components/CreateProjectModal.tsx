import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
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

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { code: "", name: "", description: "", process_template_slug: "basic" },
  });

  const selectedTemplate = watch("process_template_slug");

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
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle fontWeight={600}>New Project</DialogTitle>

        <DialogContent>
          <TextField
            {...register("code")}
            label="Code"
            placeholder="e.g. ALM"
            fullWidth
            error={!!errors.code}
            helperText={
              errors.code?.message ??
              "2-10 alphanumeric characters, uppercase"
            }
            sx={{ mt: 1, mb: 2 }}
            inputProps={{ maxLength: 10 }}
          />
          <TextField
            {...register("name")}
            label="Project name"
            fullWidth
            error={!!errors.name}
            helperText={errors.name?.message}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Process template</InputLabel>
            <Select
              value={selectedTemplate ?? "basic"}
              label="Process template"
              onChange={(e) => setValue("process_template_slug", e.target.value as string)}
            >
              {(templates ?? [{ id: "basic", slug: "basic", name: "Basic", is_builtin: true }]).map((t) => (
                <MenuItem key={t.id} value={t.slug}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            {...register("description")}
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            error={!!errors.description}
            helperText={errors.description?.message}
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
    </Dialog>
  );
}
