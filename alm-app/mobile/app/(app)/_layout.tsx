import { Stack, router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { queryClient } from '@/src/queryClient';
import { useSessionStore } from '@/src/store/sessionStore';

function HeaderRight() {
  const logout = useSessionStore((s) => s.logout);
  return (
    <Pressable
      onPress={() => {
        void logout().then(() => {
          queryClient.clear();
          router.replace('/login');
        });
      }}
      style={styles.headerBtn}>
      <Text style={styles.headerBtnText}>Sign out</Text>
    </Pressable>
  );
}

export default function AppStackLayout() {
  const projectName = useSessionStore((s) => s.projectName);

  return (
    <Stack
      screenOptions={{
        headerRight: () => <HeaderRight />,
      }}>
      <Stack.Screen
        name="(tabs)"
        options={{
          title: projectName ?? 'Project',
          headerLeft: () => (
            <Pressable onPress={() => router.push('/select-project')} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Projects</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="artifact/[id]" options={{ title: 'Work item' }} />
      <Stack.Screen name="create-artifact" options={{ title: 'New work item' }} />
      <Stack.Screen name="quality-defects" options={{ title: 'Defects' }} />
      <Stack.Screen name="manifest-preview" options={{ title: 'Manifest' }} />
      <Stack.Screen name="settings-members" options={{ title: 'Members' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  headerBtnText: { color: '#2563eb', fontSize: 16 },
});
