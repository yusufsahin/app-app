# @visera Collaboration Layer

## Scope

Defines real-time and async collaboration capabilities for `@visera`.

## Delivery

- R3 baseline: presence, command sync, basic conflict handling
- Post-R3: CRDT-based merge, offline-first convergence

## Components

- **Presence service** — cursor and selection broadcast per session
- **Command sync broker** — real-time command propagation to session participants
- **Offline queue** — local command buffer when disconnected
- **Merge engine** — conflict resolution on reconnect

## Command Sync Model

All mutations flow through the Command Bus before being broadcast.

1. User action → Command Bus → canonical model update
2. Confirmed command broadcast to session participants via WebSocket
3. Each participant applies remote commands in arrival order
4. Divergent state triggers merge notification

## Conflict Resolution (R3 baseline)

- Last-write-wins per node property, keyed by `updatedAt`
- Active edit on a node shows a live presence lock (UI hint, not hard lock)
- Concurrent edits to the same node property trigger a conflict notification
- User can accept remote or keep local; no silent data loss

## Post-R3: CRDT Path

- Property-level CRDT merge (no last-write-wins tradeoffs)
- Offline-first with full convergence guarantee
- History reconciliation UI for divergent branches

## Presence

- Cursor position per user (throttled broadcast, ~50ms)
- Active selection highlight with user colour
- Online / away / offline status per participant

## Offline Behavior

1. Commands buffered locally when WebSocket is disconnected
2. On reconnect, buffered commands submitted in order with a local-origin flag
3. Server may reject out-of-order commands; client triggers full resync
4. Resync replaces local view state with authoritative server state

## Security

- Session tokens scoped to workspace and document
- Presence data contains only cursor/selection metadata — no document content
- Command broadcast validates actor permission before relay
