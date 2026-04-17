import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchArtifacts } from '@/src/api/artifacts';
import { getErrorMessage } from '@/src/api/client';
import { manifestQueryKey, fetchProjectManifest } from '@/src/api/manifest';
import { useSessionStore } from '@/src/store/sessionStore';

export default function BacklogScreen() {
  const orgSlug = useSessionStore((s) => s.orgSlug);
  const projectId = useSessionStore((s) => s.projectId);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const manifestQuery = useQuery({
    queryKey: manifestQueryKey(orgSlug, projectId),
    queryFn: () => fetchProjectManifest(orgSlug!, projectId!),
    enabled: !!orgSlug && !!projectId,
  });

  const types = useMemo(() => {
    const at = manifestQuery.data?.manifest_bundle?.artifact_types ?? [];
    return at.filter((t) => !t.id.startsWith('root-') && t.is_system_root !== true);
  }, [manifestQuery.data]);

  const listQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts', 'mobile-backlog', q, typeFilter],
    queryFn: () =>
      fetchArtifacts(orgSlug!, projectId!, {
        q: q.trim() || undefined,
        type: typeFilter,
        limit: 100,
        sort_by: 'updated_at',
        sort_order: 'desc',
      }),
    enabled: !!orgSlug && !!projectId,
  });

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search…"
        value={q}
        onChangeText={setQ}
        clearButtonMode="while-editing"
      />
      <View style={styles.typeRow}>
        <Pressable
          style={[styles.chip, !typeFilter && styles.chipActive]}
          onPress={() => setTypeFilter(undefined)}>
          <Text style={styles.chipText}>All types</Text>
        </Pressable>
        {types.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.chip, typeFilter === t.id && styles.chipActive]}
            onPress={() => setTypeFilter(t.id)}>
            <Text style={styles.chipText}>{t.name ?? t.id}</Text>
          </Pressable>
        ))}
      </View>
      {manifestQuery.isError && manifestQuery.data === undefined ? (
        <Text style={styles.manifestHint}>Type filters unavailable — pull down to retry.</Text>
      ) : null}

      {listQuery.isPending && listQuery.data === undefined ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : listQuery.isError && listQuery.data === undefined ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {getErrorMessage(listQuery.error, 'Failed to load work items.')}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => void listQuery.refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          style={styles.listFlex}
          keyboardShouldPersistTaps="handled"
          data={listQuery.data?.items ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={listQuery.isRefetching || manifestQuery.isRefetching}
              onRefresh={() => void Promise.all([manifestQuery.refetch(), listQuery.refetch()])}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>No work items.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/(app)/artifact/${item.id}`)}>
              <Text style={styles.key}>{item.artifact_key ?? item.id.slice(0, 8)}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.artifact_type} · {item.state}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/(app)/create-artifact')}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listFlex: { flex: 1 },
  search: {
    margin: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  chipActive: { backgroundColor: '#bfdbfe' },
  chipText: { fontSize: 13 },
  loader: { marginTop: 40 },
  row: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  key: { fontSize: 12, opacity: 0.6 },
  title: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: 13, opacity: 0.65, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
  manifestHint: { fontSize: 12, opacity: 0.55, paddingHorizontal: 12, marginBottom: 4 },
  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 15, marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, marginTop: -2 },
});
