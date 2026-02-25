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
} from "@mui/material";
import { useCreateTenant } from "../../../shared/api/tenantApi";

const createOrgSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
});

type CreateOrgFormData = z.infer<typeof createOrgSchema>;

interface CreateOrgModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (tenant: { id: string; name: string; slug: string }) => void;
  token?: string;
}

export default function CreateOrgModal({
  open,
  onClose,
  onSuccess,
  token,
}: CreateOrgModalProps) {
  const createMutation = useCreateTenant(token);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: "" },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: CreateOrgFormData) => {
    try {
      const tenant = await createMutation.mutateAsync({ name: data.name });
      handleClose();
      onSuccess(tenant);
    } catch {
      // Error shown via mutation
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle fontWeight={600}>New Organization</DialogTitle>

        <DialogContent>
          <TextField
            {...register("name")}
            label="Organization name"
            placeholder="e.g. Acme Corp"
            fullWidth
            error={!!errors.name}
            helperText={errors.name?.message}
            sx={{ mt: 1 }}
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
