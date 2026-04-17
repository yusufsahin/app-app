import { useQuery } from '@tanstack/react-query';
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
import { fetchTenantMembers } from '@/src/api/tenants';
import { useSessionStore } from '@/src/store/sessionStore';

export default function SettingsMembersScreen() {
  const tenantId = useSessionStore((s) => s.tenantId);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['tenants', tenantId, 'members'],
    queryFn: () => fetchTenantMembers(tenantId!),
    enabled: !!tenantId,
  });

  if (!tenantId) {
    return (
      <View style={styles.centered}>
        <Text>Re-select your organization to load members.</Text>
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
    const msg = getErrorMessage(error, 'Failed to load members.');
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
      keyExtractor={(item) => item.user_id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListEmptyComponent={<Text style={styles.empty}>No members returned for this organization.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.name}>{item.display_name}</Text>
          <Text style={styles.email}>{item.email}</Text>
          <Text style={styles.roles}>{item.roles.map((r) => r.name).join(', ')}</Text>
        </View>
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
  list: { padding: 12 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  name: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 14, opacity: 0.7, marginTop: 2 },
  roles: { fontSize: 12, opacity: 0.55, marginTop: 4 },
  empty: { textAlign: 'center', padding: 24, opacity: 0.6 },
});
