import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui";

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
  const handleSelect = (path: string) => {
    onSelect(path);
    onClose();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={title}
      description="Search pages…"
    >
      <CommandInput placeholder="Search pages…" />
      <CommandList>
        <CommandEmpty>No matches</CommandEmpty>
        <CommandGroup heading={title}>
          {items.map((item) => (
            <CommandItem
              key={item.id}
              value={item.label}
              onSelect={() => handleSelect(item.path)}
            >
              {item.icon != null ? (
                <span className="mr-2 flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
