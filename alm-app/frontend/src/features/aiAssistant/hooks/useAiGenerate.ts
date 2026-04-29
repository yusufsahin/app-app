import { useAiGenerate as useGenerateMutation } from "../../../shared/api/aiApi";

interface GenerateInput {
  projectId: string;
  artifactType: string;
  title: string;
  descriptionHint?: string;
  providerConfigId?: string;
}

export function useAiGenerate(orgSlug: string) {
  const mutation = useGenerateMutation(orgSlug);
  return {
    ...mutation,
    generate: async (input: GenerateInput) =>
      mutation.mutateAsync({
        project_id: input.projectId,
        artifact_type: input.artifactType,
        title: input.title,
        description_hint: input.descriptionHint,
        provider_config_id: input.providerConfigId,
      }),
  };
}
