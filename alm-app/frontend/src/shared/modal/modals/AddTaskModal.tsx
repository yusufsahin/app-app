import { useState, useEffect } from "react";
import { Button } from "../../components/ui";
import { MetadataDrivenForm } from "../../components/forms";
import type { AddTaskModalProps } from "../modalTypes";

type Props = AddTaskModalProps & { onClose: () => void };

export function AddTaskModal({
  taskFormSchema,
  initialValues,
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
          submitLabel="Add"
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
            Add
          </Button>
        )}
      </div>
    </>
  );
}
