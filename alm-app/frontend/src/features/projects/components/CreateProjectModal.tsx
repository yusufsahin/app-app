import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../shared/components/ui/dialog";
import { Button } from "../../../shared/components/ui";
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
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
              <DialogDescription className="sr-only">
                Create a new project in this organization. Enter code, name, process template, and optional description.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <RhfTextField<CreateProjectFormData>
                name="code"
                label="Code"
                placeholder="e.g. ALM"
                fullWidth
                helperText="2-10 alphanumeric characters, uppercase"
                inputProps={{ maxLength: 10 }}
              />
              <RhfTextField<CreateProjectFormData>
                name="name"
                label="Project name"
                fullWidth
              />
              <RhfSelect<CreateProjectFormData>
                name="process_template_slug"
                control={control}
                label="Process template"
                options={templateOptions}
              />
              <RhfDescriptionField<CreateProjectFormData>
                name="description"
                control={control}
                mode="text"
                label="Description (optional)"
                allowModeSwitch
                rows={4}
              />
            </div>
            <DialogFooter className="mt-6 gap-2 px-0 pb-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
