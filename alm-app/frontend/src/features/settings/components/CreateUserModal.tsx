import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogTitle fontWeight={600}>Create User</DialogTitle>
          <DialogContent>
            {createMutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Failed to create user. Please try again.
              </Alert>
            )}
            <RhfTextField<FormData>
              name="email"
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              autoComplete="email"
            />
            <RhfTextField<FormData>
              name="password"
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              autoComplete="new-password"
            />
            <RhfTextField<FormData>
              name="display_name"
              label="Display name (optional)"
              fullWidth
              margin="normal"
            />
            <RhfSelect<FormData>
              name="role_slug"
              control={control}
              label="Role"
              options={roleOptions}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending}
              startIcon={createMutation.isPending ? <CircularProgress size={16} /> : null}
            >
              Create
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
