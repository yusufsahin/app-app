import { useParams } from "react-router-dom";
import { SettingsPageWrapper } from "../../settings/components/SettingsPageWrapper";
import { useDeleteAiProvider, useAiProviders, useUpsertAiProvider } from "../../../shared/api/aiApi";
import { AddProviderForm, type ProviderFormValue } from "../components/AddProviderForm";
import { ProviderList } from "../components/ProviderList";

export default function AiSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const slug = orgSlug ?? "";
  const providers = useAiProviders(slug);
  const createProvider = useUpsertAiProvider(slug);
  const deleteProvider = useDeleteAiProvider(slug);

  const handleCreate = async (value: ProviderFormValue) => {
    await createProvider.mutateAsync(value);
  };

  return (
    <SettingsPageWrapper>
      <h1 className="mb-4 text-2xl font-semibold">AI Providers</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Configured providers</h2>
          <ProviderList
            providers={providers.data ?? []}
            onDelete={async (id) => {
              await deleteProvider.mutateAsync(id);
            }}
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Add provider</h2>
          <AddProviderForm onSubmit={handleCreate} />
        </div>
      </div>
    </SettingsPageWrapper>
  );
}
