import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { switchTenant } from '@/src/api/auth';
import { getErrorMessage } from '@/src/api/client';
import { fetchMyTenants } from '@/src/api/tenants';
import { useSessionStore } from '@/src/store/sessionStore';
import type { TenantListItem } from '@/src/types/api';

export default function SelectOrgScreen() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const switchTempToken = useSessionStore((s) => s.switchTempToken);
  const loginTenantOptions = useSessionStore((s) => s.loginTenantOptions);
  const setTokens = useSessionStore((s) => s.setTokens);
  const setOrg = useSessionStore((s) => s.setOrg);
  const setProject = useSessionStore((s) => s.setProject);
  const setLoginTenantGate = useSessionStore((s) => s.setLoginTenantGate);

  const tenantQuery = useQuery({
    queryKey: ['tenants', accessToken ?? ''],
    queryFn: fetchMyTenants,
    enabled: !!accessToken && !switchTempToken,
  });

  const {
    data: fetchedTenants,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = tenantQuery;

  const tenants: TenantListItem[] = switchTempToken
    ? (loginTenantOptions ?? [])
    : (fetchedTenants ?? []);

  const onPick = useCallback(
    async (t: TenantListItem) => {
      try {
        await setProject(null, null);
        if (switchTempToken) {
          const tok = await switchTenant(t.id, switchTempToken);
          await setTokens(tok.access_token, tok.refresh_token);
          await setLoginTenantGate(null, null);
        }
        await setOrg(t.id, t.slug, t.name);
        router.replace('/select-project');
      } catch (e) {
        const msg = getErrorMessage(e, 'Failed');
        Alert.alert('Organization', msg);
      }
    },
    [setLoginTenantGate, setOrg, setProject, setTokens, switchTempToken],
  );

  if (!accessToken && !switchTempToken) {
    return (
      <View style={styles.centered}>
        <Text>Not signed in.</Text>
      </View>
    );
  }

  if (!switchTempToken && isPending && fetchedTenants === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!switchTempToken && isError && fetchedTenants === undefined) {
    const msg = getErrorMessage(error, 'Failed to load organizations.');
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
      data={tenants}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        switchTempToken ? undefined : (
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        )
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No organizations found. Create one from the web app first.</Text>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => void onPick(item)}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.slug}>{item.slug}</Text>
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
  slug: { fontSize: 13, opacity: 0.6, marginTop: 4 },
  empty: { padding: 24, textAlign: 'center', opacity: 0.7 },
});
