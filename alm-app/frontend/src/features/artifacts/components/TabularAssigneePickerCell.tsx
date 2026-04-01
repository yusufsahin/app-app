import { useMemo, useState } from "react";
import { Check, ChevronDown, UserRoundX } from "lucide-react";
import { Button, Command, CommandEmpty, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger, cn } from "../../../shared/components/ui";

interface AssigneeOption {
  user_id: string;
  display_name?: string;
  email?: string;
}

interface TabularAssigneePickerCellProps {
  value: string | null;
  options: AssigneeOption[];
  disabled?: boolean;
  onCommit: (nextValue: string | null) => Promise<void> | void;
}

function memberLabel(option: AssigneeOption): string {
  return option.display_name || option.email || option.user_id;
}

export function TabularAssigneePickerCell({
  value,
  options,
  disabled = false,
  onCommit,
}: TabularAssigneePickerCellProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const selected = useMemo(
    () => options.find((option) => option.user_id === value) ?? null,
    [options, value],
  );

  const commit = async (nextValue: string | null) => {
    if (disabled || pending) return;
    setPending(true);
    try {
      await onCommit(nextValue);
      setOpen(false);
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
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? memberLabel(selected) : "Unassigned"}
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
          <CommandInput placeholder="Search assignee..." />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandItem
              value="unassigned none"
              onSelect={() => {
                void commit(null);
              }}
            >
              <UserRoundX className="size-4" />
              <span>Unassigned</span>
              <Check className={cn("ml-auto size-4", value == null ? "opacity-100" : "opacity-0")} />
            </CommandItem>
            {options.map((option) => {
              const selectedMember = option.user_id === value;
              return (
                <CommandItem
                  key={option.user_id}
                  value={`${memberLabel(option)} ${option.email ?? ""} ${option.user_id}`}
                  onSelect={() => {
                    void commit(option.user_id);
                  }}
                >
                  <Check className={cn("size-4", selectedMember ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{memberLabel(option)}</span>
                    {option.email ? <span className="truncate text-xs text-muted-foreground">{option.email}</span> : null}
                  </div>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
