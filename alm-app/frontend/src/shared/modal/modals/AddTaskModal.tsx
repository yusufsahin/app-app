import { useState, useEffect } from "react";
import { Button, Box, Typography } from "@mui/material";
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
            Add
          </Button>
        )}
      </Box>
    </>
  );
}
