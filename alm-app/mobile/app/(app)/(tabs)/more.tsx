import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '@/src/store/sessionStore';

export default function MoreScreen() {
  const orgName = useSessionStore((s) => s.orgName);
  const projectName = useSessionStore((s) => s.projectName);
  const setOrg = useSessionStore((s) => s.setOrg);
  const setProject = useSessionStore((s) => s.setProject);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Signed in</Text>
      <Text style={styles.meta}>{orgName ?? '—'}</Text>
      <Text style={styles.meta}>{projectName ?? '—'}</Text>

      <Text style={[styles.section, styles.mt]}>Modules</Text>
      <Pressable style={styles.row} onPress={() => router.push('/(app)/manifest-preview')}>
        <Text style={styles.rowTitle}>Manifest (read-only)</Text>
        <Text style={styles.rowSub}>Template version and bundle summary</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push('/(app)/quality-defects')}>
        <Text style={styles.rowTitle}>Quality · Defects</Text>
        <Text style={styles.rowSub}>Work items filtered as defect</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push('/(app)/settings-members')}>
        <Text style={styles.rowTitle}>Organization members</Text>
        <Text style={styles.rowSub}>Same API as web settings</Text>
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={() => {
          void (async () => {
            await setProject(null, null);
            router.push('/select-project');
          })();
        }}>
        <Text style={styles.rowTitle}>Switch project</Text>
        <Text style={styles.rowSub}>Clears selection; pick another project</Text>
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={() => {
          void (async () => {
            await setOrg(null, null);
            router.push('/select-org');
          })();
        }}>
        <Text style={styles.rowTitle}>Switch organization</Text>
        <Text style={styles.rowSub}>Choose a different org (tenant)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  section: { fontSize: 12, fontWeight: '700', opacity: 0.5, textTransform: 'uppercase' },
  mt: { marginTop: 20 },
  meta: { fontSize: 16, marginTop: 4 },
  row: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, opacity: 0.65, marginTop: 4 },
});
