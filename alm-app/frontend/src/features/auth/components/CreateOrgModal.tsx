import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../shared/components/ui/dialog";
import { Button } from "../../../shared/components/ui";
import { RhfTextField } from "../../../shared/components/forms";
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

  const form = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: "" },
  });
  const { handleSubmit, reset } = form;

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
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>New Organization</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <RhfTextField<CreateOrgFormData>
                name="name"
                label="Organization name"
                placeholder="e.g. Acme Corp"
                fullWidth
              />
            </div>
            <DialogFooter className="mt-6 gap-2 px-0 pb-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
                Cancel
              </Button>
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
