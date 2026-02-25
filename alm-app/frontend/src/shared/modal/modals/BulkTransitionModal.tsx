import {
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Typography,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";
import { MetadataDrivenForm } from "../../components/forms";
import type { BulkTransitionModalProps } from "../modalTypes";

type Props = BulkTransitionModalProps & { onClose: () => void };

export function BulkTransitionModal({
  commonTriggers,
  currentTrigger,
  onSelectTrigger,
  stateOptions,
  transitionSchema,
  transitionValues,
  onTransitionFormChange,
  lastResult,
  errorsExpanded,
  onToggleErrors,
  onConfirm,
  isPending,
  confirmDisabled,
  invalidCount = 0,
  onCloseComplete,
  onClose,
}: Props) {
  const currentState = (transitionValues.state as string) ?? "";
  const handleClose = () => {
    onCloseComplete?.();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm({
      trigger: currentTrigger,
      state: currentState,
      state_reason: (transitionValues.state_reason as string) ?? "",
      resolution: (transitionValues.resolution as string) ?? "",
    });
  };

  return (
    <>
      {lastResult ? (
        <>
          <Typography color={lastResult.error_count > 0 ? "warning.main" : "success.main"} sx={{ mb: 1 }}>
            {lastResult.success_count} succeeded, {lastResult.error_count} failed.
          </Typography>
          {lastResult.errors.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Button size="small" onClick={onToggleErrors}>
                {errorsExpanded ? "Hide" : "Show"} failed items
              </Button>
              <Collapse in={errorsExpanded}>
                <List dense sx={{ bgcolor: "action.hover" }}>
                  {lastResult.errors.slice(0, 20).map((err, i) => {
                    const colonIdx = err.indexOf(": ");
                    const message = colonIdx > 0 ? err.slice(colonIdx + 2) : err;
                    return (
                      <ListItem key={i}>
                        <ListItemText primary={message} primaryTypographyProps={{ variant: "body2" }} />
                      </ListItem>
                    );
                  })}
                  {lastResult.errors.length > 20 && (
                    <ListItem>
                      <ListItemText
                        primary={`... and ${lastResult.errors.length - 20} more`}
                        primaryTypographyProps={{ variant: "body2" }}
                      />
                    </ListItem>
                  )}
                </List>
              </Collapse>
            </Box>
          )}
        </>
      ) : (
        <>
          {commonTriggers.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Common actions (apply to all selected)
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {commonTriggers.map((item) => (
                  <Chip
                    key={item.trigger}
                    label={item.label ?? item.to_state}
                    onClick={() => onSelectTrigger(item.trigger)}
                    variant={currentTrigger === item.trigger ? "filled" : "outlined"}
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          )}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>New state</InputLabel>
            <Select
              value={currentState}
              label="New state"
              onChange={(e) => onTransitionFormChange({ ...transitionValues, state: e.target.value })}
            >
              {stateOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {invalidCount > 0 && currentState && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {invalidCount} item(s) cannot transition to this state
              </Typography>
            )}
          </FormControl>
          {transitionSchema ? (
            <MetadataDrivenForm
              schema={transitionSchema}
              values={transitionValues}
              onChange={onTransitionFormChange}
              onSubmit={() => {}}
              submitLabel="Transition"
              disabled={isPending}
              submitExternally
            />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                size="small"
                fullWidth
                label="State reason (optional)"
                value={(transitionValues.state_reason as string) ?? ""}
                onChange={(e) =>
                  onTransitionFormChange({ ...transitionValues, state_reason: e.target.value })
                }
              />
              <TextField
                size="small"
                fullWidth
                label="Resolution (optional)"
                value={(transitionValues.resolution as string) ?? ""}
                onChange={(e) =>
                  onTransitionFormChange({ ...transitionValues, resolution: e.target.value })
                }
              />
            </Box>
          )}
        </>
      )}
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        {!lastResult && (
          <Button variant="contained" onClick={handleConfirm} disabled={confirmDisabled || isPending}>
            Transition
          </Button>
        )}
        {lastResult && (
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        )}
      </Box>
    </>
  );
}
