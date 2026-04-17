import axios from 'axios';
import { API_V1_BASE } from './config';

export interface RefreshedTokenPair {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

/** Plain axios — avoids circular import with `client` interceptors. */
export async function fetchRefreshedTokens(
  refreshToken: string,
  accessTokenHint?: string | null,
): Promise<RefreshedTokenPair> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessTokenHint) headers.Authorization = `Bearer ${accessTokenHint}`;
  const { data } = await axios.post<RefreshedTokenPair>(
    `${API_V1_BASE}/auth/refresh`,
    { refresh_token: refreshToken },
    { headers, timeout: 15_000 },
  );
  return data;
}
