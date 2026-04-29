import { useState } from "react";
import { Button, Card, CardContent, Input, Label } from "../../../shared/components/ui";

export interface ProviderFormValue {
  name: string;
  provider: string;
  model: string;
  api_key?: string;
  base_url?: string;
  is_default: boolean;
  is_enabled: boolean;
}

interface Props {
  onSubmit: (value: ProviderFormValue) => Promise<void>;
}

export function AddProviderForm({ onSubmit }: Props) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="space-y-1">
          <Label htmlFor="ai-name">Name</Label>
          <Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-provider">Provider</Label>
          <Input id="ai-provider" value={provider} onChange={(e) => setProvider(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-model">Model</Label>
          <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-api-key">API key</Label>
          <Input id="ai-api-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-base-url">Base URL</Label>
          <Input id="ai-base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <Button
            variant={isDefault ? "default" : "outline"}
            size="sm"
            onClick={() => setIsDefault((v) => !v)}
          >
            {isDefault ? "Default" : "Set default"}
          </Button>
          <Button
            variant={isEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEnabled((v) => !v)}
          >
            {isEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        <Button
          onClick={() =>
            void onSubmit({
              name,
              provider,
              model,
              api_key: apiKey || undefined,
              base_url: baseUrl || undefined,
              is_default: isDefault,
              is_enabled: isEnabled,
            })
          }
          disabled={!name.trim() || !provider.trim() || !model.trim()}
        >
          Add Provider
        </Button>
      </CardContent>
    </Card>
  );
}
