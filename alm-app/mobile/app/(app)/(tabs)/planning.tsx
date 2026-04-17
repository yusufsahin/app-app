import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getErrorMessage } from '@/src/api/client';
import { areaNodesQueryKey, cadencesQueryKey, fetchAreaNodes, fetchCadences } from '@/src/api/planning';
import { useSessionStore } from '@/src/store/sessionStore';

function flattenCadences(nodes: { id: string; name: string; path: string; type?: string; children?: typeof nodes }[], depth = 0): { id: string; title: string; type?: string }[] {
  const out: { id: string; title: string; type?: string }[] = [];
  for (const n of nodes) {
    const pad = '  '.repeat(depth);
    out.push({ id: n.id, title: `${pad}${n.name} (${n.path})`, type: n.type });
    if (n.children?.length) out.push(...flattenCadences(n.children, depth + 1));
  }
  return out;
}

function flattenAreas(
  nodes: { id: string; name: string; path: string; children?: typeof nodes }[],
  depth = 0,
): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  for (const n of nodes) {
    const pad = '  '.repeat(depth);
    out.push({ id: n.id, title: `${pad}${n.name} (${n.path})` });
    if (n.children?.length) out.push(...flattenAreas(n.children, depth + 1));
  }
  return out;
}

export default function PlanningScreen() {
  const orgSlug = useSessionStore((s) => s.orgSlug)!;
  const projectId = useSessionStore((s) => s.projectId)!;

  const cadencesQuery = useQuery({
    queryKey: cadencesQueryKey(orgSlug, projectId, false, undefined),
    queryFn: () => fetchCadences(orgSlug, projectId, false),
    enabled: !!orgSlug && !!projectId,
  });

  const areasQuery = useQuery({
    queryKey: areaNodesQueryKey(orgSlug, projectId, false),
    queryFn: () => fetchAreaNodes(orgSlug, projectId, false),
    enabled: !!orgSlug && !!projectId,
  });

  const sections = useMemo(() => {
    const cadRows = flattenCadences(cadencesQuery.data ?? []);
    const areaRows = flattenAreas(areasQuery.data ?? []);
    return [
      { title: 'Cadences (releases / cycles)', data: cadRows },
      { title: 'Areas', data: areaRows },
    ];
  }, [cadencesQuery.data, areasQuery.data]);

  const refetchAll = useCallback(() => {
    return Promise.all([cadencesQuery.refetch(), areasQuery.refetch()]);
  }, [cadencesQuery, areasQuery]);

  const cadWaiting = cadencesQuery.isPending && cadencesQuery.data === undefined;
  const areaWaiting = areasQuery.isPending && areasQuery.data === undefined;

  if (cadWaiting || areaWaiting) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const bothMissing =
    cadencesQuery.data === undefined &&
    areasQuery.data === undefined &&
    !cadencesQuery.isPending &&
    !areasQuery.isPending;

  if (bothMissing && (cadencesQuery.isError || areasQuery.isError)) {
    const err = cadencesQuery.error ?? areasQuery.error;
    const msg = getErrorMessage(err, 'Failed to load planning data.');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void refetchAll()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const refreshing = cadencesQuery.isRefetching || areasQuery.isRefetching;

  return (
    <SectionList
      style={styles.listFlex}
      sections={sections}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refetchAll()}
        />
      }
      renderSectionHeader={({ section: { title } }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      )}
      renderItem={({ item }) => {
        const typeBadge = 'type' in item && typeof item.type === 'string' ? item.type : null;
        return (
          <View style={styles.row}>
            <Text style={styles.rowText}>{item.title}</Text>
            {typeBadge ? <Text style={styles.badge}>{typeBadge}</Text> : null}
          </View>
        );
      }}
      ListEmptyComponent={<Text style={styles.empty}>No planning data.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  listFlex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 15, marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  sectionHeader: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionTitle: { fontWeight: '700', fontSize: 14 },
  row: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowText: { flex: 1, fontSize: 15 },
  badge: { fontSize: 11, opacity: 0.7, textTransform: 'capitalize' },
  empty: { padding: 24, textAlign: 'center', opacity: 0.6 },
});
