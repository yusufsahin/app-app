import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/components/ui";
import { RhfTextField } from "../../../shared/components/forms";

const formSchema = z.object({
  title: z.string(),
  description: z.string(),
  environment: z.string(),
});

export type StartSuiteRunFormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
  suiteTitle: string;
  defaultTitle: string;
  isSubmitting: boolean;
  onConfirm: (values: { title: string; description: string; environment?: string }) => void;
};

export function StartSuiteRunDialog({
  open,
  onClose,
  suiteTitle,
  defaultTitle,
  isSubmitting,
  onConfirm,
}: Props) {
  const { t } = useTranslation("quality");
  const form = useForm<StartSuiteRunFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", environment: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ title: "", description: "", environment: "" });
  }, [open, form, suiteTitle, defaultTitle]);

  const resolvedDefault = defaultTitle || `${suiteTitle} — ${dayjs().format("YYYY-MM-DD HH:mm")}`;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md" aria-describedby="start-suite-run-desc">
        <DialogHeader>
          <DialogTitle>{t("campaignExecution.startRunDialogTitle")}</DialogTitle>
          <DialogDescription id="start-suite-run-desc">
            {t("campaignExecution.startRunDialogDescription", { suite: suiteTitle })}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            id="start-suite-run-form"
            className="space-y-3"
            onSubmit={form.handleSubmit((raw) => {
              const title = (raw.title ?? "").trim() || resolvedDefault;
              const environment = (raw.environment ?? "").trim();
              onConfirm({
                title,
                description: (raw.description ?? "").trim(),
                ...(environment ? { environment } : {}),
              });
            })}
          >
            <RhfTextField<StartSuiteRunFormValues>
              name="title"
              label={t("campaignExecution.runNameLabel")}
              placeholder={resolvedDefault}
              helperText={t("campaignExecution.runNameHelper")}
            />
            <RhfTextField<StartSuiteRunFormValues>
              name="description"
              label={t("campaignExecution.runDescriptionLabel")}
              placeholder={t("campaignExecution.runDescriptionPlaceholder")}
            />
            <RhfTextField<StartSuiteRunFormValues>
              name="environment"
              label={t("campaignExecution.runEnvironmentLabel")}
              placeholder={t("campaignExecution.runEnvironmentPlaceholder")}
            />
          </form>
        </FormProvider>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="start-suite-run-form" disabled={isSubmitting}>
            {t("campaignExecution.startRunConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
