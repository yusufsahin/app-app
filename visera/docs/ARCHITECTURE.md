# @visera Architecture

## Scope
This document defines the target architecture for a renderer-agnostic, enterprise-ready diagram platform.

## Core Principles
1. Canonical model is the source of truth.
2. Renderer adapters are replaceable.
3. All mutations go through command handling.
4. Integrations and AI actions are policy-controlled.
5. Security and audit are first-class concerns.
6. Core-first delivery gate applies before expansion tracks.

## Logical Layers
- App Shell Layer
- Diagram Core Layer
- Renderer Adapter Layer
- Persistence Layer
- Collaboration Layer
- AI Agent Hub
- Integration Hub
- Security and Governance Layer

## Canonical Diagram Model

- `DiagramDocument`
- `DiagramPage`
- `DiagramNode`
- `DiagramEdge`
- `DiagramLayer`
- `DiagramStyle`
- `DiagramMetadata`
- `DiagramViewport`

The persistence model must never be tied directly to renderer-native node/edge structures.

Full schema reference: [Core Delivery Plan — Schema Reference](./CORE_DELIVERY_PLAN.md)

## Core Mutation Path
All user actions follow this path:

UI Event -> Renderer Adapter Mapping -> Command Bus -> Canonical Model Update -> Persistence

Direct UI-to-model mutation is not allowed.

## Renderer Strategy
- Current adapters: React Flow, whiteboard adapter, BPMN adapter
- Future: custom hybrid renderer (`SVG + Canvas + WebGL`)

React Flow is the first structured renderer and must remain an adapter, not a storage model.

## AI and Integrations

- AI architecture details: [AI Agent Hub](./AI_AGENT_HUB.md)
- Integration architecture details: [Integration Architecture](./integrations/ARCHITECTURE.md)

## Collaboration Layer

- Real-time and async collaboration details: [Collaboration](./COLLABORATION.md)

## Core Delivery Reference

- [Core Delivery Plan](./CORE_DELIVERY_PLAN.md)

## Packaging Direction

Full matrix: [Packaging](./PACKAGING.md)

- `visera-domain` — canonical model, commands, repository contracts (no UI, no framework deps)
- `visera-api-contracts` — API types, DTOs, event schemas
- `visera-renderer-react-flow` — React Flow adapter
- `visera-renderer-whiteboard` — whiteboard adapter
- `visera-renderer-bpmn` — BPMN adapter
- `visera-ui` — editor shell, toolbars, panels, design tokens
- `visera-shell-embedded` — embedded app shell (ALM integration host)
- `visera-shell-standalone` — standalone app shell
- `visera-shell-headless` — headless SDK entry point
