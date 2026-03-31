import { useTranslation } from "react-i18next";
import { ListPlus, PlayCircle } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../shared/components/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  onAddTests: () => void;
  onRun: () => void;
  runDisabled: boolean;
};

export function CampaignSuiteCommandDialog({ open, onClose, onAddTests, onRun, runDisabled }: Props) {
  const { t } = useTranslation("quality");

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={t("campaignExecution.commandPaletteTitle")}
      description={t("campaignExecution.commandPaletteDescription")}
    >
      <CommandInput placeholder={t("campaignExecution.commandPalettePlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("campaignExecution.commandPaletteEmpty")}</CommandEmpty>
        <CommandGroup heading={t("campaignExecution.commandPaletteGroup")}>
          <CommandItem
            value="add-tests"
            onSelect={() => {
              onAddTests();
              onClose();
            }}
          >
            <ListPlus className="mr-2 size-4" />
            {t("campaignExecution.addTests")}
          </CommandItem>
          <CommandItem
            value="run-suite"
            disabled={runDisabled}
            onSelect={() => {
              if (runDisabled) return;
              onRun();
              onClose();
            }}
          >
            <PlayCircle className="mr-2 size-4" />
            {t("campaignExecution.runSuite")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
