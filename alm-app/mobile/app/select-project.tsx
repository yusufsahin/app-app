import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getErrorMessage } from '@/src/api/client';
import { fetchOrgProjects } from '@/src/api/projects';
import { useSessionStore } from '@/src/store/sessionStore';

export default function SelectProjectScreen() {
  const orgSlug = useSessionStore((s) => s.orgSlug);
  const setProject = useSessionStore((s) => s.setProject);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['orgs', orgSlug, 'projects'],
    queryFn: () => fetchOrgProjects(orgSlug!),
    enabled: !!orgSlug,
  });

  const onPick = useCallback(
    async (p: { id: string; name: string }) => {
      await setProject(p.id, p.name);
      router.replace('/(app)/(tabs)/backlog');
    },
    [setProject],
  );

  if (!orgSlug) {
    return (
      <View style={styles.centered}>
        <Text>Select an organization first.</Text>
      </View>
    );
  }

  if (isPending && data === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError && data === undefined) {
    const msg = getErrorMessage(error, 'Failed to load projects.');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
      ListEmptyComponent={<Text style={styles.empty}>No projects. Create one in the web app.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => void onPick(item)}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {item.code} · {item.slug}
          </Text>
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
  list: { padding: 16 },
  row: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  name: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 13, opacity: 0.6, marginTop: 4 },
  empty: { padding: 24, textAlign: 'center', opacity: 0.7 },
});
