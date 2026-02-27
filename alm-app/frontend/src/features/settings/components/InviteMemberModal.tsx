import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../shared/components/ui/dialog";
import { Button } from "../../../shared/components/ui";
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
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              {inviteMutation.isError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Failed to send invitation. Please try again.
                </p>
              )}
              <RhfTextField<InviteFormData>
                name="email"
                label="Email Address"
                type="email"
                fullWidth
              />
              <RhfAutocomplete<InviteFormData, string>
                name="role_ids"
                control={control}
                label="Roles"
                options={roleOptions}
                multiple
              />
            </div>
            <DialogFooter className="mt-6 gap-2 px-0 pb-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={inviteMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? <Loader2 className="size-5 animate-spin" /> : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
