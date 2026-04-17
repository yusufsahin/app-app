import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getErrorMessage } from '@/src/api/client';
import { manifestQueryKey, fetchProjectManifest } from '@/src/api/manifest';
import { useSessionStore } from '@/src/store/sessionStore';

/** Read-only manifest summary; full edit remains on web (admin). */
export default function ManifestPreviewScreen() {
  const orgSlug = useSessionStore((s) => s.orgSlug)!;
  const projectId = useSessionStore((s) => s.projectId)!;

  const q = useQuery({
    queryKey: manifestQueryKey(orgSlug, projectId),
    queryFn: () => fetchProjectManifest(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });

  if (q.isPending && q.data === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (q.isError && q.data === undefined) {
    const msg = getErrorMessage(q.error, 'Failed to load manifest.');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void q.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const bundle = q.data?.manifest_bundle;
  const summary = {
    template_name: q.data?.template_name,
    template_slug: q.data?.template_slug,
    version: q.data?.version,
    workflows: bundle?.workflows?.length ?? 0,
    artifact_types: bundle?.artifact_types?.length ?? 0,
    link_types: bundle?.link_types?.length ?? 0,
    tree_roots: bundle?.tree_roots?.length ?? 0,
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}>
      <Text style={styles.mono}>{JSON.stringify(summary, null, 2)}</Text>
      <Text style={styles.note}>
        Full bundle JSON is large; use the web Manifest page to edit. This screen confirms mobile reads the
        same manifest endpoint as the web app.
      </Text>
    </ScrollView>
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
  container: { padding: 12 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  note: { marginTop: 16, fontSize: 13, opacity: 0.65 },
});
