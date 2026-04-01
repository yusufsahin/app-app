import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Badge, Button, Command, CommandEmpty, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger, cn } from "../../../shared/components/ui";

interface TagOption {
  id: string;
  name: string;
}

interface TabularTagPickerCellProps {
  value: string[];
  options: TagOption[];
  disabled?: boolean;
  onCommit: (nextValue: string[]) => Promise<void> | void;
}

export function TabularTagPickerCell({
  value,
  options,
  disabled = false,
  onCommit,
}: TabularTagPickerCellProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(option.id)),
    [options, selectedSet],
  );

  const toggle = async (tagId: string) => {
    if (disabled || pending) return;
    const nextValue = selectedSet.has(tagId)
      ? value.filter((item) => item !== tagId)
      : [...value, tagId];

    setPending(true);
    try {
      await onCommit(nextValue);
    } finally {
      setPending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || pending}
          className="h-auto min-h-8 w-full justify-between px-1 py-1 text-left hover:bg-transparent"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((tag) => (
                <Badge key={tag.id} variant="outline" className="px-1 py-0 text-[0.65rem] font-normal">
                  {tag.name}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">No tags</span>
            )}
          </span>
          <ChevronDown className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onClick={(event) => event.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search tags..." />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            {options.map((option) => {
              const selected = selectedSet.has(option.id);
              return (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.id}`}
                  onSelect={() => {
                    void toggle(option.id);
                  }}
                >
                  <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
                  <span>{option.name}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
