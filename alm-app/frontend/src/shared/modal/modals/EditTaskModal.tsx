import { useState, useEffect } from "react";
import { Button } from "../../components/ui";
import { MetadataDrivenForm } from "../../components/forms";
import type { EditTaskModalProps } from "../modalTypes";

type Props = EditTaskModalProps & { onClose: () => void };

export function EditTaskModal({
  taskFormSchema,
  task,
  values: initialValues,
  onChange,
  onSubmit,
  isPending,
  userOptions,
  onClose,
}: Props) {
  const [values, setValues] = useState(initialValues);
  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  if (!task) return null;

  const handleSubmit = () => {
    onSubmit(values);
  };

  return (
    <>
      {taskFormSchema ? (
        <MetadataDrivenForm
          schema={taskFormSchema}
          values={values}
          onChange={(v) => {
            setValues(v);
            onChange(v);
          }}
          onSubmit={handleSubmit}
          submitLabel="Save"
          disabled={isPending}
          submitExternally
          userOptions={userOptions}
        />
      ) : (
        <p className="text-muted-foreground">Loading form…</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        {taskFormSchema && (
          <Button
            onClick={handleSubmit}
            disabled={!(values.title as string)?.trim() || isPending}
          >
            Save
          </Button>
        )}
      </div>
    </>
  );
}
