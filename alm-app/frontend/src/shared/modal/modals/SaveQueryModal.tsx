import { useForm, FormProvider } from "react-hook-form";
import { Button } from "../../components/ui";
import { RhfTextField, RhfSelect } from "../../components/forms";
import type { SaveQueryModalProps } from "../modalTypes";

type Props = SaveQueryModalProps & { onClose: () => void };

type FormValues = { name: string; visibility: "private" | "project" };

export function SaveQueryModal({
  initialName = "",
  initialVisibility = "private",
  onSave,
  onClose,
}: Props) {
  const form = useForm<FormValues>({
    defaultValues: { name: initialName, visibility: initialVisibility as "private" | "project" },
  });

  const onSubmit = (data: FormValues) => {
    const name = data.name.trim();
    if (!name) return;
    onSave(name, data.visibility);
    onClose();
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <RhfTextField<FormValues>
          name="name"
          label="Query name"
          fullWidth
          placeholder="e.g. My open bugs"
        />
        <RhfSelect<FormValues>
          name="visibility"
          control={form.control}
          label="Visibility"
          options={[
            { value: "private", label: "Private (only me)" },
            { value: "project", label: "Project (all members)" },
          ]}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Save
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
