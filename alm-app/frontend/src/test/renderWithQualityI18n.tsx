import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { qualityEn } from "../i18n/locales/en/quality";

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  resources: { en: { quality: qualityEn } },
  ns: ["quality"],
  defaultNS: "quality",
  interpolation: { escapeValue: false },
});

export function renderWithQualityI18n(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
      </QueryClientProvider>
    ),
  });
}
