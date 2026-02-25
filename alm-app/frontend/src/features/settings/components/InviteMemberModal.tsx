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
  Chip,
  Box,
} from "@mui/material";
import { RhfAutocomplete, RhfTextField } from "../../../shared/components/forms";
import { useInviteOrgMember, useOrgRoles } from "../../../shared/api/orgApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role_ids: z.array(z.string()).min(1, "Select at least one role"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  orgSlug?: string;
}

export default function InviteMemberModal({ open, onClose, orgSlug }: InviteMemberModalProps) {
  const { data: roles = [] } = useOrgRoles(orgSlug);
  const inviteMutation = useInviteOrgMember(orgSlug);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role_ids: [] },
  });
  const { control, handleSubmit, reset } = form;
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

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
      <FormProvider {...form}>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogTitle fontWeight={600}>Invite Member</DialogTitle>
          <DialogContent>
            {inviteMutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Failed to send invitation. Please try again.
              </Alert>
            )}
            <RhfTextField<InviteFormData>
              name="email"
              label="Email Address"
              type="email"
              fullWidth
              sx={{ mt: 1, mb: 2.5 }}
            />
            <RhfAutocomplete<InviteFormData, string>
              name="role_ids"
              control={control}
              label="Roles"
              options={roleOptions}
              multiple
              autocompleteProps={{
                renderTags: (tagValue, getTagProps) =>
                  tagValue.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        label={option.label}
                        size="small"
                        color="primary"
                        variant="outlined"
                        {...tagProps}
                      />
                    );
                  }),
              }}
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
      </FormProvider>
    </Dialog>
  );
}
