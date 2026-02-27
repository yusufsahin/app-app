import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../shared/components/ui/dialog";
import { Button } from "../../../shared/components/ui";
import { RhfSelect, RhfTextField } from "../../../shared/components/forms";
import { useCreateAdminUser } from "../../../shared/api/adminApi";
import { useOrgRoles } from "../../../shared/api/orgApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  display_name: z.string().optional(),
  role_slug: z.string().min(1, "Select a role"),
});

type FormData = z.infer<typeof schema>;

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  orgSlug?: string;
}

export default function CreateUserModal({ open, onClose, orgSlug }: CreateUserModalProps) {
  const { data: roles = [] } = useOrgRoles(orgSlug);
  const createMutation = useCreateAdminUser();
  const showNotification = useNotificationStore((s) => s.showNotification);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", display_name: "", role_slug: "member" },
  });
  const { control, handleSubmit, reset } = form;
  const roleOptions = roles.map((r) => ({ value: r.slug, label: r.name }));

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    try {
      await createMutation.mutateAsync({
        email: data.email,
        password: data.password,
        display_name: data.display_name || undefined,
        role_slug: data.role_slug,
      });
      showNotification("User created successfully");
      handleClose();
    } catch (err: unknown) {
      const problem = err as { detail?: string; message?: string };
      showNotification(
        problem.detail ?? problem.message ?? "Failed to create user",
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
              <DialogTitle>Create User</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              {createMutation.isError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Failed to create user. Please try again.
                </p>
              )}
              <RhfTextField<FormData>
                name="email"
                label="Email"
                type="email"
                fullWidth
                inputProps={{ autoComplete: "email" }}
              />
              <RhfTextField<FormData>
                name="password"
                label="Password"
                type="password"
                fullWidth
                inputProps={{ autoComplete: "new-password" }}
              />
              <RhfTextField<FormData>
                name="display_name"
                label="Display name (optional)"
                fullWidth
              />
              <RhfSelect<FormData>
                name="role_slug"
                control={control}
                label="Role"
                options={roleOptions}
              />
            </div>
            <DialogFooter className="mt-6 gap-2 px-0 pb-0">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="size-5 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
