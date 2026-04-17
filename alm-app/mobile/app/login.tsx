import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { login } from '@/src/api/auth';
import { getErrorMessage } from '@/src/api/client';
import { useSessionStore } from '@/src/store/sessionStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setTokens = useSessionStore((s) => s.setTokens);
  const setLoginTenantGate = useSessionStore((s) => s.setLoginTenantGate);
  const clearAuthTokens = useSessionStore((s) => s.clearAuthTokens);

  async function onSubmit() {
    setLoading(true);
    try {
      const res = await login({ email: email.trim(), password });
      if (res.requires_tenant_selection && res.temp_token && res.tenants?.length) {
        await clearAuthTokens();
        await setLoginTenantGate(
          res.temp_token,
          res.tenants.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            tier: t.tier,
            roles: [],
          })),
        );
        router.replace('/select-org');
        return;
      }
      if (res.access_token) {
        await setTokens(res.access_token, res.refresh_token ?? null);
        await setLoginTenantGate(null, null);
        router.replace('/select-org');
        return;
      }
      Alert.alert('Login', 'Unexpected response from server.');
    } catch (e) {
      const msg = getErrorMessage(e, 'Login failed');
      Alert.alert('Login', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <Text style={styles.hint}>Use the same account as the web app. Set EXPO_PUBLIC_API_URL in .env.</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={() => void onSubmit()} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', gap: 12 },
  hint: { fontSize: 13, opacity: 0.7, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
