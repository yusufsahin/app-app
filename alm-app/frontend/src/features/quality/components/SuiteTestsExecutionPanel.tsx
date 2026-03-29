import { useCallback, useEffect, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, GripVertical, PlayCircle, Plus } from "lucide-react";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { ArtifactLink } from "../../../shared/api/artifactLinkApi";
import {
  sortOutgoingSuiteLinks,
  useDeleteArtifactLink,
  useReorderArtifactLinks,
} from "../../../shared/api/artifactLinkApi";
import { Button } from "../../../shared/components/ui";

const SUITE_TEST_ROW = "suite_test_row";

type DragItem = { linkId: string; index: number };

function DraggableRow({
  link,
  index,
  testCase: tc,
  moveRow,
  disabled,
  onRemove,
  onDragStart,
  onDragEnd,
  rowCount,
  onReorderByArrow,
}: {
  link: ArtifactLink;
  index: number;
  testCase: Artifact | undefined;
  moveRow: (from: number, to: number) => void;
  disabled: boolean;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  rowCount: number;
  onReorderByArrow: (from: number, to: number) => Promise<void>;
}) {
  const { t } = useTranslation("quality");
  const rowRef = useRef<HTMLTableRowElement | null>(null);

  const [, drop] = useDrop({
    accept: SUITE_TEST_ROW,
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
    type: SUITE_TEST_ROW,
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
    (node: HTMLTableRowElement | null) => {
      rowRef.current = node;
      if (node) {
        drag(drop(node));
      }
    },
    [drag, drop],
  );

  return (
    <tr
      ref={setRowRef}
      className={`border-b border-border ${isDragging ? "opacity-50" : ""}`}
      data-testid={`suite-exec-row-${index}`}
    >
      <td className="w-10 px-2 py-2 align-middle text-muted-foreground">
        <GripVertical className="size-4" aria-hidden />
      </td>
      <td className="w-12 px-2 py-2 text-sm text-muted-foreground tabular-nums">{index + 1}</td>
      <td className="min-w-0 px-2 py-2 text-sm font-medium">{tc?.title ?? link.to_artifact_id}</td>
      <td className="w-52 px-2 py-2 text-right">
        <div className="flex flex-wrap items-center justify-end gap-1">
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
      </td>
    </tr>
  );
}

type Props = {
  orgSlug: string;
  projectId: string;
  suiteId: string;
  linkType: string;
  links: ArtifactLink[];
  testCasesById: Map<string, Artifact>;
  canUpdate: boolean;
  onAddTests: () => void;
  onRun: () => void;
  runDisabled: boolean;
};

export function SuiteTestsExecutionPanel({
  orgSlug,
  projectId,
  suiteId,
  linkType,
  links,
  testCasesById,
  canUpdate,
  onAddTests,
  onRun,
  runDisabled,
}: Props) {
  const { t } = useTranslation("quality");
  const orderedLinks = sortOutgoingSuiteLinks(links, suiteId, linkType);
  const serverIds = orderedLinks.map((l) => l.id);
  const [localIds, setLocalIds] = useState<string[] | null>(null);
  const orderRef = useRef<string[]>(serverIds);
  const dragSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    orderRef.current = serverIds;
    setLocalIds(null);
  }, [serverIds.join(",")]);

  const displayIds = localIds ?? serverIds;
  const displayLinks = displayIds
    .map((id) => orderedLinks.find((l) => l.id === id))
    .filter((l): l is ArtifactLink => !!l);

  const moveRow = useCallback((from: number, to: number) => {
    if (from === to) return;
    setLocalIds((prev) => {
      const base = prev ?? [...orderRef.current];
      if (to < 0 || to >= base.length) return prev;
      const next = [...base];
      const [removed] = next.splice(from, 1);
      if (removed === undefined) return prev;
      next.splice(to, 0, removed);
      orderRef.current = next;
      return next;
    });
  }, []);

  const reorderMutation = useReorderArtifactLinks(orgSlug, projectId, suiteId);
  const deleteLink = useDeleteArtifactLink(orgSlug, projectId, suiteId);

  const persistCurrentOrder = useCallback(async () => {
    const ids = orderRef.current;
    if (ids.length === 0) return;
    try {
      await reorderMutation.mutateAsync({ link_type: linkType, ordered_link_ids: ids });
      setLocalIds(null);
    } catch {
      setLocalIds(null);
      orderRef.current = serverIds;
    }
  }, [linkType, reorderMutation, serverIds]);

  const onDragStart = useCallback(() => {
    dragSnapshotRef.current = orderRef.current.join(",");
  }, []);

  const onDragEnd = useCallback(() => {
    const snap = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (snap != null && snap !== orderRef.current.join(",")) {
      void persistCurrentOrder();
    } else {
      setLocalIds(null);
    }
  }, [persistCurrentOrder]);

  const onReorderByArrow = useCallback(
    async (from: number, to: number) => {
      if (!canUpdate || to < 0) return;
      const base = localIds ?? serverIds;
      if (to >= base.length) return;
      const next = [...base];
      const [removed] = next.splice(from, 1);
      if (removed === undefined) return;
      next.splice(to, 0, removed);
      orderRef.current = next;
      setLocalIds(next);
      try {
        await reorderMutation.mutateAsync({ link_type: linkType, ordered_link_ids: next });
        setLocalIds(null);
      } catch {
        setLocalIds(null);
        orderRef.current = serverIds;
      }
    },
    [canUpdate, linkType, localIds, reorderMutation, serverIds],
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-3">
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAddTests}
            disabled={!canUpdate}
            data-testid="quality-suite-add-tests"
          >
            <Plus className="mr-1.5 size-4" />
            {t("campaignExecution.addTests")}
          </Button>
          <Button type="button" size="sm" onClick={onRun} disabled={runDisabled || !canUpdate}>
            <PlayCircle className="mr-1.5 size-4" />
            {t("campaignExecution.runSuite")}
          </Button>
        </div>

        {displayLinks.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            {t("campaignExecution.emptySuiteHint")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-2 py-2">{t("campaignExecution.dragColumn")}</th>
                  <th className="w-12 px-2 py-2">#</th>
                  <th className="px-2 py-2">{t("campaignExecution.testColumn")}</th>
                  <th className="w-52 px-2 py-2 text-right">{t("campaignExecution.actionsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {displayLinks.map((link, index) => (
                  <DraggableRow
                    key={link.id}
                    link={link}
                    index={index}
                    testCase={testCasesById.get(link.to_artifact_id)}
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
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DndProvider>
  );
}
