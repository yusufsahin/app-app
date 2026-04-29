# @visera Backlog

## Scope
Epic-level product backlog for building `@visera` as both embedded and standalone offerings.

## Priority
- P0: core platform essentials (must complete first)
- P1: enterprise hardening
- P2: integrations and collaboration scale
- P3: strategic platform expansion

## P0 Epic 1: Platform Foundation
- App shell
- Module boundaries
- Shared design system primitives

## P0 Epic 2: Diagram Core
- Canonical schema
- Serializer/deserializer
- Migration-ready versioning hooks

## P0 Epic 3: Renderer Adapters
- Renderer port contract
- Structured diagram adapter (React Flow first)
- Whiteboard adapter
- BPMN adapter (render-only baseline; full editing moves to P1)

## P0 Epic 4: Command and History
- Command bus
- Mutation commands
- Undo/redo stack

## P0 Epic 5: Plugin System
- Shape manifests
- Plugin registry
- Property editor registry
- Template registry

## P1 Epic 6: Enterprise Governance
- RBAC policy matrix
- Document lifecycle states
- Audit events
- Version restore flows

## P1 Epic 7: BPMN Full Editing

- BPMN modeler (editing, not just rendering)
- BPMN XML import/export lifecycle
- BPMN-specific command set

## P1 Epic 8: AI Agent Hub

- Provider registry
- Policy-based routing
- Agent runtime
- Human approval workflow
- Backlog extraction agent (depends on ALM connector)

## P2 Epic 9: Collaboration

- Real-time presence (cursors, selections)
- Command sync broker
- Offline buffer and reconnect resync
- Conflict notification (see [Collaboration](./COLLABORATION.md))

## P2 Epic 10: Integration Hub

- Connector contract
- Secret handling
- Webhook framework
- Connector observability

## P3 Epic 11: Canvas R&D

- Scene graph
- Spatial indexing
- Hit testing
- Hybrid renderer proof points

## Core Done Definition
Core is complete only when these are true:
- canonical model is the only source-of-truth
- command bus owns all mutations
- undo/redo works for core command set
- local repository implementation is stable and API repository can replace it
- JSON export/import roundtrip is validated
