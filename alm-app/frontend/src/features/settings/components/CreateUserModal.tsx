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
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", display_name: "", role_slug: "member" },
  });
  const roleSlug = watch("role_slug");

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
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle fontWeight={600}>Create User</DialogTitle>
        <DialogContent>
          {createMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to create user. Please try again.
            </Alert>
          )}
          <TextField
            {...register("email")}
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            error={!!errors.email}
            helperText={errors.email?.message}
            autoComplete="email"
          />
          <TextField
            {...register("password")}
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            error={!!errors.password}
            helperText={errors.password?.message}
            autoComplete="new-password"
          />
          <TextField
            {...register("display_name")}
            label="Display name (optional)"
            fullWidth
            margin="normal"
          />
          <FormControl fullWidth margin="normal" error={!!errors.role_slug}>
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={roleSlug ?? "member"}
              onChange={(e) => setValue("role_slug", e.target.value)}
            >
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.slug}>
                  {r.name}
                </MenuItem>
              ))}
            </Select>
            {errors.role_slug && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {errors.role_slug.message}
              </Alert>
            )}
          </FormControl>
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
    </Dialog>
  );
}
