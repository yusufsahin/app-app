import {
  buildWorkflowStateDisplayMap,
  getMergedWorkflowStatesForArtifactTypes,
  normalizeWorkflowStateKey,
  resolveWorkflowStateForArtifactType,
  type ManifestBundleShape,
} from '@alm/manifest-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { fetchArtifacts, transitionArtifact } from '@/src/api/artifacts';
import { getErrorMessage } from '@/src/api/client';
import { manifestQueryKey, fetchProjectManifest } from '@/src/api/manifest';
import type { Artifact } from '@/src/types/api';
import { useSessionStore } from '@/src/store/sessionStore';

type Rect = { left: number; right: number; top: number; bottom: number };

function findStateForDrop(x: number, y: number, rects: Record<string, Rect>): string | null {
  for (const [stateId, r] of Object.entries(rects)) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return stateId;
  }
  return null;
}

function BoardCard({
  artifact,
  bundle,
  columnRects,
  orgSlug,
  projectId,
  artifactTypeFilter,
  onTransitioned,
}: {
  artifact: Artifact;
  bundle: ManifestBundleShape | null;
  columnRects: MutableRefObject<Record<string, Rect>>;
  orgSlug: string;
  projectId: string;
  artifactTypeFilter: string | undefined;
  onTransitioned: () => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const onDragEndJS = useCallback(
    (ax: number, ay: number) => {
      const rects = columnRects.current;
      const targetCol = findStateForDrop(ax, ay, rects);
      if (!targetCol || !bundle) return;
      const typeId = artifact.artifact_type;
      if (artifactTypeFilter && typeId !== artifactTypeFilter) return;
      const newState = resolveWorkflowStateForArtifactType(bundle, typeId, targetCol);
      if (!newState || normalizeWorkflowStateKey(newState) === normalizeWorkflowStateKey(artifact.state)) {
        return;
      }
      void (async () => {
        try {
          await transitionArtifact(orgSlug, projectId, artifact.id, {
            new_state: newState,
            expected_updated_at: artifact.updated_at ?? null,
          });
          onTransitioned();
        } catch (err) {
          const msg = getErrorMessage(err, 'Transition failed');
          Alert.alert('Board', msg);
        }
      })();
    },
    [
      artifact.artifact_type,
      artifact.id,
      artifact.state,
      artifact.updated_at,
      artifactTypeFilter,
      bundle,
      columnRects,
      onTransitioned,
      orgSlug,
      projectId,
    ],
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      dragging.value = 1;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    })
    .onEnd((e) => {
      dragging.value = 0;
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      runOnJS(onDragEndJS)(e.absoluteX, e.absoluteY);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: dragging.value ? 20 : 1,
    elevation: dragging.value ? 8 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, style]}>
        <Text style={styles.cardKey}>{artifact.artifact_key ?? '—'}</Text>
        <Text style={styles.cardTitle} numberOfLines={3}>
          {artifact.title}
        </Text>
        <Text style={styles.cardHint}>Drag to a column to transition</Text>
      </Animated.View>
    </GestureDetector>
  );
}

function Column({
  stateId,
  label,
  children,
  width,
  onRect,
}: {
  stateId: string;
  label: string;
  width: number;
  children: React.ReactNode;
  onRect: (stateId: string, rect: Rect | null) => void;
}) {
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      onRect(stateId, { left: x, right: x + w, top: y, bottom: y + h });
    });
  }, [onRect, stateId]);

  return (
    <View style={[styles.column, { width }]} ref={ref} onLayout={measure}>
      <Text style={styles.columnTitle}>{label}</Text>
      <ScrollView style={styles.columnScroll} nestedScrollEnabled>
        {children}
      </ScrollView>
    </View>
  );
}

export default function BoardScreen() {
  const { width: screenW } = useWindowDimensions();
  const orgSlug = useSessionStore((s) => s.orgSlug)!;
  const projectId = useSessionStore((s) => s.projectId)!;
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const columnRects = useRef<Record<string, Rect>>({});

  const manifestQuery = useQuery({
    queryKey: manifestQueryKey(orgSlug, projectId),
    queryFn: () => fetchProjectManifest(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });

  const bundle = (manifestQuery.data?.manifest_bundle ?? null) as ManifestBundleShape | null;

  const selectableTypes = useMemo(() => {
    const at = bundle?.artifact_types ?? [];
    return at.filter((t) => !t.id.startsWith('root-') && t.is_system_root !== true);
  }, [bundle]);

  const states = useMemo(() => {
    const ids = typeFilter ? [typeFilter] : [];
    return getMergedWorkflowStatesForArtifactTypes(bundle, ids);
  }, [bundle, typeFilter]);

  const labelMap = useMemo(() => buildWorkflowStateDisplayMap(bundle), [bundle]);

  const colW = Math.max(140, Math.min(200, (screenW - 24) / Math.max(states.length, 1)));

  const artifactsQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts', 'mobile-board', typeFilter],
    queryFn: () =>
      fetchArtifacts(orgSlug, projectId, {
        type: typeFilter,
        limit: 500,
        sort_by: 'rank_order',
        sort_order: 'asc',
      }),
    enabled: !!orgSlug && !!projectId,
  });

  const grouped = useMemo(() => {
    const out = new Map<string, Artifact[]>();
    for (const s of states) out.set(s, []);
    for (const a of artifactsQuery.data?.items ?? []) {
      const k = normalizeWorkflowStateKey(a.state);
      const col =
        states.find((s) => normalizeWorkflowStateKey(s) === k) ??
        states.find((s) => s.toLowerCase() === a.state.toLowerCase());
      if (col) out.get(col)!.push(a);
      else if (states[0]) out.get(states[0])!.push(a);
    }
    return out;
  }, [artifactsQuery.data?.items, states]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts'] });
  }, [orgSlug, projectId, queryClient]);

  const setRect = useCallback((stateId: string, rect: Rect | null) => {
    if (rect) columnRects.current[stateId] = rect;
    else delete columnRects.current[stateId];
  }, []);

  const refetchBoard = useCallback(() => {
    return Promise.all([manifestQuery.refetch(), artifactsQuery.refetch()]);
  }, [manifestQuery, artifactsQuery]);

  const manifestWaiting = manifestQuery.isPending && manifestQuery.data === undefined;
  const artWaiting = artifactsQuery.isPending && artifactsQuery.data === undefined;

  if (manifestWaiting || artWaiting) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (manifestQuery.isError && manifestQuery.data === undefined) {
    const msg = getErrorMessage(manifestQuery.error, 'Failed to load manifest for the board.');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void refetchBoard()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (artifactsQuery.isError && artifactsQuery.data === undefined) {
    const msg = getErrorMessage(artifactsQuery.error, 'Failed to load work items for the board.');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void artifactsQuery.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const boardRefreshing = manifestQuery.isRefetching || artifactsQuery.isRefetching;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.boardOuter}
        contentContainerStyle={styles.boardOuterContent}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={boardRefreshing}
            onRefresh={() => void refetchBoard()}
          />
        }>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeBar}>
          <Pressable
            style={[styles.chip, !typeFilter && styles.chipActive]}
            onPress={() => setTypeFilter(undefined)}>
            <Text>All types</Text>
          </Pressable>
          {selectableTypes.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.chip, typeFilter === t.id && styles.chipActive]}
              onPress={() => setTypeFilter(t.id)}>
              <Text>{t.name ?? t.id}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal nestedScrollEnabled contentContainerStyle={styles.boardRow}>
          {states.map((stateId) => (
            <Column
              key={stateId}
              stateId={stateId}
              label={labelMap.get(stateId) ?? stateId}
              width={colW}
              onRect={setRect}>
              {(grouped.get(stateId) ?? []).map((a) => (
                <BoardCard
                  key={a.id}
                  artifact={a}
                  bundle={bundle}
                  columnRects={columnRects}
                  orgSlug={orgSlug}
                  projectId={projectId}
                  artifactTypeFilter={typeFilter}
                  onTransitioned={invalidate}
                />
              ))}
            </Column>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boardOuter: { flex: 1 },
  boardOuterContent: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 15, marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  typeBar: { flexDirection: 'row', gap: 8, padding: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  chipActive: { backgroundColor: '#bfdbfe' },
  boardRow: { paddingHorizontal: 8, paddingBottom: 24 },
  column: {
    marginHorizontal: 4,
    maxHeight: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingBottom: 8,
  },
  columnTitle: {
    fontWeight: '700',
    padding: 10,
    fontSize: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  columnScroll: { flexGrow: 0 },
  card: {
    margin: 8,
    marginBottom: 0,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardKey: { fontSize: 11, opacity: 0.55 },
  cardTitle: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  cardHint: { fontSize: 10, opacity: 0.45, marginTop: 6 },
});
