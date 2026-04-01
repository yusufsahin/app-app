import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, ChevronUp, GripVertical } from "lucide-react";
import type { Artifact } from "../../../shared/api/artifactApi";
import { apiClient } from "../../../shared/api/client";
import {
  type ArtifactRelationship,
  sortOutgoingRelationships,
  useDeleteArtifactRelationship,
  useReorderArtifactRelationships,
} from "../../../shared/api/relationshipApi";
import { Button } from "../../../shared/components/ui";
import type { LastExecutionStatusItem, LastExecutionStepStatusItem } from "../../../shared/api/qualityLastExecutionApi";
import { parseTestSteps } from "../lib/testSteps";
import { useLastExecutionStatusBatch, lastExecutionStatusMap } from "../hooks/useLastExecutionStatusBatch";
import { ExecutionStepStatusBadge } from "./ExecutionStepStatusBadge";
import { TestLastStatusBadge } from "./TestLastStatusBadge";

const SUITE_INCLUDED_ROW = "suite_included_test_row";

type DragItem = { linkId: string; index: number };

function DraggableSuiteRow({
  link,
  index,
  testCase: tc,
  lastExecItem,
  moveRow,
  disabled,
  onRemove,
  onDragStart,
  onDragEnd,
  rowCount,
  onReorderByArrow,
}: {
  link: ArtifactRelationship;
  index: number;
  testCase: Artifact | undefined;
  lastExecItem: LastExecutionStatusItem | undefined;
  moveRow: (from: number, to: number) => void;
  disabled: boolean;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  rowCount: number;
  onReorderByArrow: (from: number, to: number) => Promise<void>;
}) {
  const { t } = useTranslation("quality");
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);

  const inlineSteps = useMemo(
    () => (tc ? parseTestSteps(tc.custom_fields?.test_steps_json) : []),
    [tc],
  );

  const stepStatusById = useMemo(() => {
    const m = new Map<string, LastExecutionStepStatusItem["status"]>();
    for (const s of lastExecItem?.step_results ?? []) {
      m.set(s.step_id, s.status);
    }
    return m;
  }, [lastExecItem]);

  const [, drop] = useDrop({
    accept: SUITE_INCLUDED_ROW,
    hover(dragged: DragItem, monitor) {
      const el = rowRef.current;
      if (!el || disabled) return;
      const dragIndex = dragged.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const rect = el.getBoundingClientRect();
      const mid = (rect.bottom - rect.top) / 2;
      const offset = monitor.getClientOffset();
      if (!offset) return;
      const hoverClientY = offset.y - rect.top;
      if (dragIndex < hoverIndex && hoverClientY < mid) return;
      if (dragIndex > hoverIndex && hoverClientY > mid) return;
      moveRow(dragIndex, hoverIndex);
      dragged.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: SUITE_INCLUDED_ROW,
    item: () => {
      onDragStart();
      return { linkId: link.id, index };
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    canDrag: !disabled,
    end: () => {
      onDragEnd();
    },
  });

  const setRowRef = useCallback(
    (node: HTMLDivElement | null) => {
      rowRef.current = node;
      if (node) {
        drag(drop(node));
      }
    },
    [drag, drop],
  );

  const orderLabel = index + 1;
  const persistedOrder = link.sort_order;
  const storedRank = persistedOrder != null ? persistedOrder + 1 : orderLabel;

  return (
    <div
      className={`rounded-md border border-border bg-card text-sm ${isDragging ? "opacity-50" : ""}`}
      data-testid={`suite-includes-row-${index}`}
      title={t("campaignExecution.suitePlanStoredOrderTitle", { n: storedRank })}
    >
      <div ref={setRowRef} className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div
          className="flex shrink-0 cursor-grab items-center text-muted-foreground active:cursor-grabbing"
          aria-label={t("campaignExecution.dragReorderAria")}
        >
          <GripVertical className="size-4" aria-hidden />
        </div>
        <span className="w-8 shrink-0 tabular-nums text-muted-foreground" aria-hidden>
          {orderLabel}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-expanded={stepsOpen}
          aria-label={
            stepsOpen ? t("campaignExecution.collapseTestSteps") : t("campaignExecution.expandTestSteps")
          }
          onClick={() => setStepsOpen((o) => !o)}
        >
          {stepsOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
        </Button>
        <span className="min-w-0 flex-1 font-medium">{tc?.title ?? link.other_artifact_id}</span>
        <TestLastStatusBadge item={lastExecItem} className="shrink-0" />
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={disabled || index === 0}
            aria-label={t("campaignExecution.moveUpAria")}
            onClick={() => void onReorderByArrow(index, index - 1)}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={disabled || index >= rowCount - 1}
            aria-label={t("campaignExecution.moveDownAria")}
            onClick={() => void onReorderByArrow(index, index + 1)}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onRemove} disabled={disabled}>
            {t("campaignExecution.removeFromSuite")}
          </Button>
        </div>
      </div>
      {stepsOpen ? (
        <div className="border-t border-border bg-muted/25 px-3 py-2 pl-11 text-xs">
          {inlineSteps.length === 0 ? (
            <p className="text-muted-foreground">{t("campaignExecution.noInlineSteps")}</p>
          ) : (
            <ul className="space-y-1.5">
              {inlineSteps.map((step) => (
                <li key={step.id} className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 gap-2">
                    <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{step.stepNumber}.</span>
                    <span className="min-w-0 break-words">
                      {step.description?.trim() || step.name || "—"}
                    </span>
                  </div>
                  <ExecutionStepStatusBadge status={stepStatusById.get(step.id) ?? null} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export type SuiteIncludedTestsReorderListProps = {
  orgSlug: string;
  projectId: string;
  suiteId: string;
  linkType: string;
  links: ArtifactRelationship[];
  targetsById: Map<string, Artifact>;
  canUpdate: boolean;
};

/**
 * Ordered suite ↔ test-case links with drag-and-drop and persisted `sort_order` (link order).
 * Used in the "Suite includes test" planning card; execution UI stays separate.
 */
export function SuiteIncludedTestsReorderList({
  orgSlug,
  projectId,
  suiteId,
  linkType,
  links,
  targetsById,
  canUpdate,
}: SuiteIncludedTestsReorderListProps) {
  const { t } = useTranslation("quality");
  const orderHintId = useId();
  const orderedLinks = sortOutgoingRelationships(links, suiteId, linkType);

  const missingTargetIds = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const l of orderedLinks) {
      const id = l.target_artifact_id;
      if (seen.has(id)) continue;
      seen.add(id);
      if (!targetsById.has(id)) out.push(id);
    }
    return out;
  }, [orderedLinks, targetsById]);

  const detailQueries = useQueries({
    queries: missingTargetIds.map((artifactId) => ({
      queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId] as const,
      queryFn: async (): Promise<Artifact> => {
        const { data } = await apiClient.get<Artifact>(
          `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}`,
        );
        return data;
      },
      enabled: Boolean(orgSlug && projectId && artifactId),
      staleTime: 60_000,
    })),
  });

  const resolvedTargetsById = useMemo(() => {
    const m = new Map(targetsById);
    for (let i = 0; i < missingTargetIds.length; i++) {
      const id = missingTargetIds[i];
      const row = detailQueries[i];
      if (id && row?.data) m.set(id, row.data);
    }
    return m;
  }, [targetsById, missingTargetIds, detailQueries]);

  const serverIds = orderedLinks.map((l) => l.id);
  const serverOrderKey = serverIds.join(",");
  const [localOrder, setLocalOrder] = useState<{ baseKey: string; ids: string[] } | null>(null);
  const orderRef = useRef<{ baseKey: string; ids: string[] }>({ baseKey: serverOrderKey, ids: [...serverIds] });
  const dragSnapshotRef = useRef<string | null>(null);

  const dndBackend = useMemo(() => {
    if (typeof window !== "undefined" && "ontouchstart" in window) {
      return TouchBackend;
    }
    return HTML5Backend;
  }, []);

  const dndOptions = useMemo(
    () =>
      dndBackend === TouchBackend
        ? { enableMouseEvents: true, delayTouchStart: 120, ignoreContextMenu: true }
        : undefined,
    [dndBackend],
  );

  const reorderMutation = useReorderArtifactRelationships(orgSlug, projectId, suiteId);
  const deleteLink = useDeleteArtifactRelationship(orgSlug, projectId, suiteId);

  const suiteTestIdsForLastExec = useMemo(
    () => [...new Set(orderedLinks.map((l) => l.target_artifact_id))].slice(0, 200),
    [orderedLinks],
  );
  const { data: lastExecItems } = useLastExecutionStatusBatch(orgSlug, projectId, suiteTestIdsForLastExec);
  const lastExecById = useMemo(() => lastExecutionStatusMap(lastExecItems), [lastExecItems]);

  useEffect(() => {
    orderRef.current = { baseKey: serverOrderKey, ids: [...serverIds] };
  }, [serverOrderKey, serverIds]);

  const localIds = localOrder?.baseKey === serverOrderKey ? localOrder.ids : null;
  const displayIds = localIds ?? serverIds;
  const displayLinks = displayIds
    .map((id) => orderedLinks.find((l) => l.id === id))
    .filter((l): l is ArtifactRelationship => !!l);

  function resetToServerOrder() {
    orderRef.current = { baseKey: serverOrderKey, ids: [...serverIds] };
    setLocalOrder(null);
  }

  function moveRow(from: number, to: number) {
    if (from === to) return;
    const base = [...orderRef.current.ids];
    if (to < 0 || to >= base.length) return;
    const [removed] = base.splice(from, 1);
    if (removed === undefined) return;
    base.splice(to, 0, removed);
    orderRef.current = { baseKey: serverOrderKey, ids: base };
    setLocalOrder({ baseKey: serverOrderKey, ids: base });
  }

  async function persistCurrentOrder() {
    const ids = orderRef.current.ids;
    if (ids.length === 0) return;
    try {
      await reorderMutation.mutateAsync({ relationship_type: linkType, ordered_relationship_ids: ids });
      setLocalOrder(null);
    } catch {
      resetToServerOrder();
    }
  }

  function onDragStart() {
    dragSnapshotRef.current = orderRef.current.ids.join(",");
  }

  function onDragEnd() {
    const snap = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (snap != null && snap !== orderRef.current.ids.join(",")) {
      void persistCurrentOrder();
    } else {
      resetToServerOrder();
    }
  }

  async function onReorderByArrow(from: number, to: number) {
    if (!canUpdate || to < 0) return;
    const next = [...orderRef.current.ids];
    if (to >= next.length) return;
    const [removed] = next.splice(from, 1);
    if (removed === undefined) return;
    next.splice(to, 0, removed);
    orderRef.current = { baseKey: serverOrderKey, ids: next };
    setLocalOrder({ baseKey: serverOrderKey, ids: next });
    try {
      await reorderMutation.mutateAsync({ relationship_type: linkType, ordered_relationship_ids: next });
      setLocalOrder(null);
    } catch {
      resetToServerOrder();
    }
  }

  if (displayLinks.length === 0) return null;

  return (
    <DndProvider backend={dndBackend} options={dndOptions}>
      <div className="space-y-2" data-testid="suite-includes-reorder-list" aria-describedby={orderHintId}>
        <p id={orderHintId} className="sr-only">
          {t("campaignExecution.suitePlanOrderHint")}
        </p>
        {displayLinks.map((link, index) => (
          <DraggableSuiteRow
            key={link.id}
            link={link}
            index={index}
            testCase={resolvedTargetsById.get(link.target_artifact_id)}
            lastExecItem={lastExecById.get(link.target_artifact_id)}
            moveRow={moveRow}
            disabled={!canUpdate || reorderMutation.isPending}
            onRemove={() => {
              if (!canUpdate) return;
              void deleteLink.mutateAsync(link.id);
            }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            rowCount={displayLinks.length}
            onReorderByArrow={onReorderByArrow}
          />
        ))}
      </div>
    </DndProvider>
  );
}
