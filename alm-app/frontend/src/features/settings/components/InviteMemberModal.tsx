import { useForm, Controller } from "react-hook-form";
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
  Autocomplete,
  Chip,
  Box,
} from "@mui/material";
import { useInviteMember, useTenantRoles, type TenantRoleDetail } from "../../../shared/api/tenantApi";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role_ids: z.array(z.string()).min(1, "Select at least one role"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InviteMemberModal({ open, onClose }: InviteMemberModalProps) {
  const tenantId = useTenantStore((s) => s.currentTenant?.id);
  const { data: roles = [] } = useTenantRoles(tenantId);
  const inviteMutation = useInviteMember();
  const showNotification = useNotificationStore((s) => s.showNotification);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role_ids: [] },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: InviteFormData) => {
    try {
      await inviteMutation.mutateAsync(data);
      showNotification("Invitation sent successfully");
      handleClose();
    } catch (err: unknown) {
      const problem = err as { detail?: string; message?: string };
      showNotification(
        problem.detail ?? problem.message ?? "Failed to send invitation",
        "error",
      );
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle fontWeight={600}>Invite Member</DialogTitle>

        <DialogContent>
          {inviteMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to send invitation. Please try again.
            </Alert>
          )}

          <TextField
            {...register("email")}
            label="Email Address"
            type="email"
            fullWidth
            error={!!errors.email}
            helperText={errors.email?.message}
            sx={{ mt: 1, mb: 2.5 }}
            autoFocus
          />

          <Controller
            name="role_ids"
            control={control}
            render={({ field: { onChange, value } }) => (
              <Autocomplete
                multiple
                options={roles}
                getOptionLabel={(option: TenantRoleDetail) => option.name}
                value={roles.filter((r) => value.includes(r.id))}
                onChange={(_, selected) => onChange(selected.map((r) => r.id))}
                renderTags={(tagValue, getTagProps) =>
                  tagValue.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        label={option.name}
                        size="small"
                        color="primary"
                        variant="outlined"
                        {...tagProps}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Roles"
                    error={!!errors.role_ids}
                    helperText={errors.role_ids?.message}
                  />
                )}
              />
            )}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={inviteMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              "Send Invitation"
            )}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
