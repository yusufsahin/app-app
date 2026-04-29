import { Sparkles } from "lucide-react";
import { Button } from "../../../shared/components/ui";
import { useAiGenerate } from "../hooks/useAiGenerate";

interface AiGenerateButtonProps {
  orgSlug: string;
  projectId: string;
  artifactType: string;
  title: string;
  descriptionHint?: string;
  onGenerated: (payload: { description: string; acceptance_criteria: string[]; test_cases: string[] }) => void;
}

export function AiGenerateButton({
  orgSlug,
  projectId,
  artifactType,
  title,
  descriptionHint,
  onGenerated,
}: AiGenerateButtonProps) {
  const { generate, isPending } = useAiGenerate(orgSlug);

  const handleClick = async () => {
    const response = await generate({
      projectId,
      artifactType,
      title,
      descriptionHint,
    });
    onGenerated(response);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending || !title.trim()}>
      <Sparkles className="mr-2 size-4" />
      {isPending ? "Generating..." : "AI ile Doldur"}
    </Button>
  );
}
