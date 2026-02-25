import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { Search } from "@mui/icons-material";

export interface CommandPaletteItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  onSelect: (path: string) => void;
  title?: string;
}

export function CommandPalette({
  open,
  onClose,
  items,
  onSelect,
  title = "Quick navigation",
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    setQuery("");
    setSelectedIndex(0);
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex((i) => (filtered.length ? Math.min(i, filtered.length - 1) : 0));
  }, [filtered.length]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const child = el.children[selectedIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      return;
    }
    if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      onSelect(filtered[selectedIndex].path);
      onClose();
    }
  };

  const handleSelect = (path: string) => {
    onSelect(path);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, mt: 8, maxHeight: "70vh" },
      }}
      TransitionProps={{ onEntered: () => inputRef.current?.focus() }}
    >
      <DialogContent sx={{ p: 0, "&:first-of-type": { py: 0 } }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="Search pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          variant="outlined"
          size="small"
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: "action.active" }} fontSize="small" />,
            sx: { px: 1.5, py: 1, "& fieldset": { border: "none" } },
          }}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1, display: "block" }}>
          {title}
        </Typography>
        <List ref={listRef} dense sx={{ py: 0, maxHeight: 320, overflow: "auto" }}>
          {filtered.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
              No matches
            </Typography>
          ) : (
            filtered.map((item, i) => (
              <ListItemButton
                key={item.id}
                selected={i === selectedIndex}
                onClick={() => handleSelect(item.path)}
                onMouseEnter={() => setSelectedIndex(i)}
                sx={{
                  "&.Mui-selected": { bgcolor: "action.selected" },
                }}
              >
                {item.icon && <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>}
                <ListItemText primary={item.label} primaryTypographyProps={{ variant: "body2" }} />
              </ListItemButton>
            ))
          )}
        </List>
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: "block", borderTop: 1, borderColor: "divider" }}>
          ↑↓ to move · Enter to select · Esc to close
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
