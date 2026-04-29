# @visera Core Delivery Plan

## Scope
This document defines the non-negotiable core that must be completed before advanced integrations, AI expansion, and custom canvas R&D.

## Core-First Rule
No feature moves to "product complete" unless all items in this document pass their acceptance criteria.

## Core Workstreams

### 1) Canonical Diagram Model
Deliverables:
- `DiagramDocument`, `DiagramPage`, `DiagramNode`, `DiagramEdge`, `DiagramLayer`, `DiagramStyle`, `DiagramMetadata`, `DiagramViewport`
- `schemaVersion` in document root
- validation schema and migration hooks

Acceptance criteria:
- persistence stores canonical JSON only
- renderer-native shapes are not persisted as source-of-truth
- schema validation runs before save/load

#### Schema Reference (TypeScript)

```typescript
interface DiagramDocument {
  id: string
  schemaVersion: string           // e.g. "1.0"
  metadata: DiagramMetadata
  pages: DiagramPage[]
  layers: DiagramLayer[]
}

interface DiagramPage {
  id: string
  name: string
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  viewport: DiagramViewport
}

interface DiagramNode {
  id: string
  type: string                    // plugin-registered shape type id
  pageId: string
  layerId?: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  style: DiagramStyle
  data: Record<string, unknown>   // shape-specific, not renderer-specific
  ports?: DiagramPort[]
}

interface DiagramEdge {
  id: string
  pageId: string
  layerId?: string
  sourceNodeId: string
  sourcePortId?: string
  targetNodeId: string
  targetPortId?: string
  waypoints?: { x: number; y: number }[]
  style: DiagramStyle
  data: Record<string, unknown>
}

interface DiagramLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  order: number
}

interface DiagramStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  fontSize?: number
  fontFamily?: string
  textAlign?: string
  [key: string]: unknown          // extensible for plugin-defined styles
}

interface DiagramMetadata {
  title: string
  description?: string
  tags?: string[]
  createdAt: string               // ISO 8601
  updatedAt: string
  createdBy: string
  ownerId: string
  workspaceId: string
}

interface DiagramViewport {
  x: number
  y: number
  zoom: number
}

interface DiagramPort {
  id: string
  position: 'top' | 'bottom' | 'left' | 'right' | { x: number; y: number }
  type?: string
}
```

### 2) Renderer Adapter (React Flow first)
Deliverables:
- renderer port contract
- canonical -> React Flow mapper
- React Flow events -> domain command mapping

Acceptance criteria:
- React Flow state is treated as view state only
- moving/connecting/deleting through UI updates canonical model via commands

### 3) Command System
Deliverables:
- command contract (`execute`, `undo`)
- command bus and command context
- initial commands: `AddNode`, `MoveNode`, `DeleteNode`, `AddEdge`, `UpdateStyle`

Acceptance criteria:
- all diagram mutations go through command bus
- direct mutation from UI components is blocked

#### Command Contract (TypeScript)

```typescript
interface Command<TResult = void> {
  readonly type: string
  execute(context: CommandContext): TResult
  undo(context: CommandContext): void
}

interface CommandContext {
  document: DiagramDocument
  emit: (event: DomainEvent) => void
}

interface DomainEvent {
  type: string
  payload: unknown
  timestamp: string
}
```

### 4) Undo/Redo
Deliverables:
- undo stack and redo stack
- reverse execution for initial commands

Acceptance criteria:
- undo/redo works for add, move, delete, connect, style updates
- command ordering remains deterministic in tests

### 5) Editor Shell
Deliverables:
- top toolbar
- left shape palette
- center canvas host
- right properties panel
- bottom status bar

Acceptance criteria:
- user can create, select, modify, and delete objects
- keyboard shortcuts for delete/undo/redo are active

### 6) Persistence
Deliverables:
- `DiagramRepository` interface
- local repository implementation for first release
- API repository placeholder with same interface

Acceptance criteria:
- swap between local/API repo without editor refactor
- autosave writes canonical JSON safely

### 7) Export Foundation
Deliverables:
- canonical JSON export (real)
- SVG/PNG export placeholders

Acceptance criteria:
- exported JSON can be re-imported into canonical model
- placeholders are explicit and versioned in docs

## Out of Core Scope (after core complete)

- advanced collaboration (live cursors/offline merge) → R3
- BPMN adapter full editing (modeler + XML roundtrip) → R2; R1 scope is render-only
- AI automation beyond guarded baseline → R4
- custom canvas kernel implementation → R5

## Core Completion Gate
Core is complete only if all conditions are true:
1. Canonical model is the only persistence source
2. Mutation path is command-only
3. Undo/redo covers initial command set
4. Repository abstraction swap is proven
5. JSON export/import roundtrip test passes
