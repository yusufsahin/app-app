import Constants from 'expo-constants';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * Absolute API origin (scheme + host + port), no path — client adds `/api/v1`.
 */
export function getApiOrigin(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim()) {
    return stripTrailingSlash(fromEnv.trim());
  }
  return 'http://localhost:8000';
}

export const API_V1_BASE = `${getApiOrigin()}/api/v1`;
