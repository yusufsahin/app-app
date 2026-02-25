import { useState, useEffect } from "react";
import { Button, Box, Typography } from "@mui/material";
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
        <Typography color="text.secondary">Loading form…</Typography>
      )}
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        {taskFormSchema && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!(values.title as string)?.trim() || isPending}
          >
            Save
          </Button>
        )}
      </Box>
    </>
  );
}
