import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchArtifacts } from '@/src/api/artifacts';
import { getErrorMessage } from '@/src/api/client';
import { useSessionStore } from '@/src/store/sessionStore';

/** Quality hub subset: defect work items (same list API as web, type=defect). */
export default function QualityDefectsScreen() {
  const orgSlug = useSessionStore((s) => s.orgSlug)!;
  const projectId = useSessionStore((s) => s.projectId)!;

  const defectsQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts', 'mobile-defects'],
    queryFn: () =>
      fetchArtifacts(orgSlug, projectId, {
        type: 'defect',
        limit: 200,
        sort_by: 'updated_at',
        sort_order: 'desc',
      }),
    enabled: !!orgSlug && !!projectId,
  });

  const { data, isPending, isError, error, refetch, isRefetching } = defectsQuery;

  if (isPending && data === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError && data === undefined) {
    const msg = getErrorMessage(error, 'Failed to load defects.');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const items = data?.items ?? [];

  return (
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListEmptyComponent={<Text style={styles.empty}>No defects in this project.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/(app)/artifact/${item.id}`)}>
          <Text style={styles.key}>{item.artifact_key ?? item.id.slice(0, 8)}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{item.state}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 15, marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  row: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  key: { fontSize: 12, opacity: 0.55 },
  title: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  meta: { fontSize: 13, opacity: 0.65, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
});
