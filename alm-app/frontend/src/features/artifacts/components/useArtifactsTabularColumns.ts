import { useMemo } from "react";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { TenantMember } from "../../../shared/api/orgApi";
import type { ProjectTag } from "../../../shared/api/projectTagApi";
import type { FormSchemaDto } from "../../../shared/types/formSchema";
import type { ListSchemaDto } from "../../../shared/types/listSchema";
import { schemaToGridColumns } from "../../../shared/components/lists/schemaToGridColumns";
import { mapLookupItems } from "../../../shared/components/lists/lookupResolvers";
import type { TabularColumnModel } from "../../../shared/components/lists/types";
import { getArtifactCellValue } from "../utils";

interface UseArtifactsTabularColumnsOptions {
  listSchema?: ListSchemaDto | null;
  formSchema?: FormSchemaDto | null;
  members?: TenantMember[] | null;
  projectTags?: ProjectTag[];
}

export function useArtifactsTabularColumns({
  listSchema,
  formSchema,
  members,
  projectTags = [],
}: UseArtifactsTabularColumnsOptions): TabularColumnModel<Artifact>[] {
  return useMemo(
    () =>
      schemaToGridColumns<Artifact>({
        listSchema,
        formSchema,
        getCellValue: getArtifactCellValue,
        getContextValue: (row, key) => {
          if (key === "artifact_type") return row.artifact_type;
          if (key in row) return row[key as keyof Artifact];
          return row.custom_fields?.[key];
        },
        pinnedColumnKeys: ["artifact_key", "title"],
        lookupSources: {
          user: [
            { value: "", label: "Unassigned" },
            ...mapLookupItems(
              members,
              (member) => member.user_id,
              (member) => member.display_name || member.email || member.user_id,
            ),
          ],
          tag: mapLookupItems(
            projectTags,
            (tag) => tag.id,
            (tag) => tag.name,
          ),
        },
        overrides: {
          assignee_id: {
            toCommitValue: (value) => (value ? String(value) : null),
            validate: (value) => {
              if (!value) return null;
              const allowedUserIds = new Set((members ?? []).map((member) => member.user_id));
              return allowedUserIds.has(String(value)) ? null : "Assignee must be a valid project member.";
            },
          },
          tags: {
            getRawValue: (row) => row.tags?.map((tag) => tag.id) ?? [],
            toCommitValue: (value) => (Array.isArray(value) ? value.map((item) => String(item)) : []),
            validate: (value) => {
              if (!Array.isArray(value)) return null;
              const allowedTagIds = new Set(projectTags.map((tag) => tag.id));
              const unknownValues = value.filter((item) => !allowedTagIds.has(String(item)));
              return unknownValues.length > 0 ? "Tags must match existing project tags." : null;
            },
          },
        },
      }),
    [formSchema, listSchema, members, projectTags],
  );
}
