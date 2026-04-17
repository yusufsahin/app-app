import { Redirect } from 'expo-router';
import { useSessionStore } from '@/src/store/sessionStore';

export default function Index() {
  const hydrated = useSessionStore((s) => s.hydrated);
  const accessToken = useSessionStore((s) => s.accessToken);
  const orgSlug = useSessionStore((s) => s.orgSlug);
  const projectId = useSessionStore((s) => s.projectId);
  const switchTempToken = useSessionStore((s) => s.switchTempToken);
  const loginTenantOptions = useSessionStore((s) => s.loginTenantOptions);

  if (!hydrated) {
    return null;
  }

  if (switchTempToken && loginTenantOptions?.length) {
    return <Redirect href="/select-org" />;
  }

  if (!accessToken) {
    return <Redirect href="/login" />;
  }

  if (!orgSlug) {
    return <Redirect href="/select-org" />;
  }

  if (!projectId) {
    return <Redirect href="/select-project" />;
  }

  return <Redirect href="/(app)/(tabs)/backlog" />;
}
