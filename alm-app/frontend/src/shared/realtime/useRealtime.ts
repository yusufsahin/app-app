/**
 * WebSocket hook for real-time events (C1–C2).
 * Connects with access token; on artifact_state_changed invalidates that project's artifact queries
 * and shows a toast (C2 real-time feed).
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { useNotificationStore } from "../stores/notificationStore";

const WS_PATH = "/api/v1/ws";
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

interface RealtimeEvent {
  type: string;
  project_id?: string;
  artifact_id?: string;
  from_state?: string;
  to_state?: string;
}

export function useRealtime(): void {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS);
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}${WS_PATH}?token=${encodeURIComponent(accessToken)}`;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      reconnectDelayRef.current = RECONNECT_DELAY_MS;

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as RealtimeEvent;
          if (data.type === "artifact_state_changed" && data.project_id) {
            queryClient.invalidateQueries({
              predicate: (query) =>
                Array.isArray(query.queryKey) &&
                query.queryKey[0] === "orgs" &&
                query.queryKey[2] === "projects" &&
                query.queryKey[3] === data.project_id,
            });
            // C2: toast for real-time feed
            const msg =
              data.to_state != null
                ? `Artifact updated: state changed to ${data.to_state}`
                : "Artifact updated";
            useNotificationStore.getState().showNotification(msg, "info");
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        const delay = Math.min(reconnectDelayRef.current, MAX_RECONNECT_DELAY_MS);
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, MAX_RECONNECT_DELAY_MS);
        timeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, accessToken, queryClient]);
}
