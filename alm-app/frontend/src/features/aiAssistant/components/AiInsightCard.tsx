import type { AiInsight } from "../../../shared/api/aiApi";
import { Badge, Card, CardContent } from "../../../shared/components/ui";

interface Props {
  insight: AiInsight;
}

export function AiInsightCard({ insight }: Props) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{insight.title}</p>
          <Badge variant="outline">{insight.severity}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{insight.body}</p>
      </CardContent>
    </Card>
  );
}
