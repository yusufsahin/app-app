import { Trash2 } from "lucide-react";
import { Button, Card, CardContent } from "../../../shared/components/ui";
import type { AiProviderConfig } from "../../../shared/api/aiApi";

interface Props {
  providers: AiProviderConfig[];
  onDelete: (id: string) => Promise<void>;
}

export function ProviderList({ providers, onDelete }: Props) {
  if (!providers.length) {
    return <p className="text-sm text-muted-foreground">No providers configured.</p>;
  }
  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <Card key={provider.id}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{provider.name}</p>
              <p className="text-xs text-muted-foreground">
                {provider.provider} / {provider.model}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void onDelete(provider.id)}>
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
