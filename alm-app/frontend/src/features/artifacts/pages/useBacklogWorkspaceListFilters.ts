import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import type { SetURLSearchParams } from "react-router-dom";
import { filterParamsToListStatePatch } from "../../../shared/api/savedQueryApi";
import type { SavedQuery } from "../../../shared/api/savedQueryApi";
import type {
  ArtifactListState,
  ArtifactSortBy,
  ArtifactSortOrder,
} from "../../../shared/stores/artifactStore";
import type { BacklogWorkspaceVariant } from "./BacklogWorkspacePage";
import type { ToolbarFilterValues } from "../components/ArtifactsToolbar";

interface UseBacklogWorkspaceListFiltersArgs {
  variant: BacklogWorkspaceVariant;
  validTreeIds: Set<string>;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  savedQueries: SavedQuery[];
  clearSelection: () => void;
  setListState: (patch: Partial<ArtifactListState>) => void;
  searchInput: string;
  releaseFilter: string;
  cycleFilter: string;
  areaNodeFilter: string;
  tagFilter: string;
  sortBy: ArtifactSortBy;
  sortOrder: ArtifactSortOrder;
  showDeleted: boolean;
  stateFilter: string;
  typeFilter: string;
  treeFilter: string;
}

export function useBacklogWorkspaceListFilters({
  variant,
  validTreeIds,
  searchParams,
  setSearchParams,
  savedQueries,
  clearSelection,
  setListState,
  searchInput,
  releaseFilter,
  cycleFilter,
  areaNodeFilter,
  tagFilter,
  sortBy,
  sortOrder,
  showDeleted,
  stateFilter,
  typeFilter,
  treeFilter,
}: UseBacklogWorkspaceListFiltersArgs) {
  const qFromUrl = searchParams.get("q") ?? "";
  const typeFromUrl = searchParams.get("type") ?? "";
  const stateFromUrl = searchParams.get("state") ?? "";
  const cycleFilterFromUrl = searchParams.get("cycle_id") ?? "";
  const releaseFilterFromUrl = searchParams.get("release_id") ?? "";
  const areaNodeIdFromUrl = searchParams.get("area_node_id") ?? "";

  const treeFromUrlValid = useMemo(() => {
    const raw = searchParams.get("tree");
    if (raw === "all") return "";
    if (raw === null || raw === "") {
      if (variant === "default" && validTreeIds.has("requirement")) return "requirement";
      return "";
    }
    if (validTreeIds.has(raw)) return raw;
    return variant === "default" && validTreeIds.has("requirement") ? "requirement" : "";
  }, [searchParams, validTreeIds, variant]);

  const toolbarForm = useForm<ToolbarFilterValues>({
    defaultValues: {
      searchInput,
      savedQueryId: "",
      releaseFilter,
      cycleFilter,
      areaNodeFilter,
      tagFilter,
      sortBy,
      sortOrder,
      showDeleted,
    },
  });
  const toolbarValues = toolbarForm.watch();

  const handleClearArtifactFilters = useCallback(() => {
    setListState({
      stateFilter: "",
      typeFilter: "",
      treeFilter: variant === "default" ? "requirement" : variant === "quality" ? "quality" : "",
      searchInput: "",
      searchQuery: "",
      cycleFilter: "",
      releaseFilter: "",
      areaNodeFilter: "",
      tagFilter: "",
      page: 0,
    });
  }, [variant, setListState]);

  useEffect(() => {
    if (toolbarValues.savedQueryId) {
      const q = savedQueries.find((s) => s.id === toolbarValues.savedQueryId);
      if (q) {
        const patch = filterParamsToListStatePatch(q.filter_params);
        setListState(patch);
        toolbarForm.reset({ ...toolbarForm.getValues(), ...patch, savedQueryId: "" });
      } else {
        toolbarForm.setValue("savedQueryId", "");
      }
    } else {
      setListState({
        searchInput: toolbarValues.searchInput,
        cycleFilter: toolbarValues.cycleFilter,
        releaseFilter: toolbarValues.releaseFilter,
        areaNodeFilter: toolbarValues.areaNodeFilter,
        tagFilter: toolbarValues.tagFilter,
        sortBy: toolbarValues.sortBy,
        sortOrder: toolbarValues.sortOrder,
        showDeleted: toolbarValues.showDeleted,
      });
      const currentQ = searchParams.get("q") ?? "";
      if (toolbarValues.searchInput !== currentQ) {
        setSearchParams(
          (prev) => {
            const p = new URLSearchParams(prev);
            if (toolbarValues.searchInput.trim()) p.set("q", toolbarValues.searchInput);
            else p.delete("q");
            return p;
          },
          { replace: true },
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toolbarForm/savedQueries omitted to avoid sync loops
  }, [
    toolbarValues.searchInput,
    toolbarValues.savedQueryId,
    toolbarValues.cycleFilter,
    toolbarValues.releaseFilter,
    toolbarValues.areaNodeFilter,
    toolbarValues.tagFilter,
    toolbarValues.sortBy,
    toolbarValues.sortOrder,
    toolbarValues.showDeleted,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    setListState({ searchInput: qFromUrl, searchQuery: qFromUrl });
    toolbarForm.setValue("searchInput", qFromUrl);
  }, [qFromUrl, setListState, toolbarForm]);

  useEffect(() => {
    setListState({
      stateFilter: stateFromUrl,
      typeFilter: typeFromUrl,
      treeFilter: treeFromUrlValid,
      cycleFilter: cycleFilterFromUrl,
      releaseFilter: releaseFilterFromUrl,
      areaNodeFilter: areaNodeIdFromUrl,
    });
  }, [stateFromUrl, typeFromUrl, treeFromUrlValid, cycleFilterFromUrl, releaseFilterFromUrl, areaNodeIdFromUrl, setListState]);

  useEffect(() => {
    toolbarForm.setValue("releaseFilter", releaseFilterFromUrl);
    toolbarForm.setValue("cycleFilter", cycleFilterFromUrl);
    toolbarForm.setValue("areaNodeFilter", areaNodeIdFromUrl);
  }, [cycleFilterFromUrl, releaseFilterFromUrl, areaNodeIdFromUrl, toolbarForm]);

  useEffect(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (typeFilter) p.set("type", typeFilter);
      else p.delete("type");
      if (stateFilter) p.set("state", stateFilter);
      else p.delete("state");
      if (treeFilter) p.set("tree", treeFilter);
      else if (variant === "default") p.set("tree", "all");
      else p.delete("tree");
      if (releaseFilter) p.set("release_id", releaseFilter);
      else p.delete("release_id");
      if (cycleFilter) p.set("cycle_id", cycleFilter);
      else p.delete("cycle_id");
      if (areaNodeFilter) p.set("area_node_id", areaNodeFilter);
      else p.delete("area_node_id");
      return p;
    });
  }, [typeFilter, stateFilter, treeFilter, releaseFilter, cycleFilter, areaNodeFilter, variant, setSearchParams]);

  useEffect(() => {
    const t = setTimeout(() => setListState({ searchQuery: searchInput }), 350);
    return () => clearTimeout(t);
  }, [searchInput, setListState]);

  useEffect(() => {
    if (showDeleted) {
      setListState({ page: 0 });
      clearSelection();
    }
  }, [showDeleted, clearSelection, setListState]);

  return {
    toolbarForm,
    handleClearArtifactFilters,
  };
}
