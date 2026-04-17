import { useColorScheme } from '@/components/useColorScheme';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '../queryClient';
import { useSessionStore } from '../store/sessionStore';

function SessionHydration({ children }: { children: ReactNode }) {
  const hydrateFromStorage = useSessionStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <SessionHydration>{children}</SessionHydration>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}
