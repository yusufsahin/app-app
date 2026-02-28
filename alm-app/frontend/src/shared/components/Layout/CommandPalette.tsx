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

export interface CommandPaletteGroup {
  group: string;
  items: CommandPaletteItem[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  /** When set, render grouped items (groups take precedence over flat items). */
  groups?: CommandPaletteGroup[];
  onSelect: (path: string) => void;
  title?: string;
  placeholder?: string;
  description?: string;
}

export function CommandPalette({
  open,
  onClose,
  items,
  groups,
  onSelect,
  title = "Quick navigation",
  placeholder = "Search or jump to…",
  description = "Search pages, projects, or go to Artifacts…",
}: CommandPaletteProps) {
  const handleSelect = (path: string) => {
    onSelect(path);
    onClose();
  };

  const listContent = groups && groups.length > 0
    ? groups.map((g) => (
        <CommandGroup key={g.group} heading={g.group}>
          {g.items.map((item) => (
            <CommandItem
              key={item.id}
              value={`${g.group} ${item.label}`}
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
      ))
    : (
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
      );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={title}
      description={description}
    >
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>No matches</CommandEmpty>
        {listContent}
      </CommandList>
    </CommandDialog>
  );
}
