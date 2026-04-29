# @visera Roadmap

## Scope
Release-level roadmap for building `@visera` from foundation to platform scale.

## R1 Foundation Editor
- Canonical model and schema versioning
- First renderer adapter
- Editor shell and core commands
- Local persistence and baseline exports

Exit criteria:
- command-only mutation path
- undo/redo for core commands
- canonical JSON roundtrip
- repository abstraction proven (local now, API-ready)

## R2 Enterprise Core
- Workspaces and projects
- RBAC
- Version history
- Audit logs
- SSO readiness
- BPMN adapter hardening (modeler + XML lifecycle baseline)

## R3 Collaboration and Integrations
- Comments and review
- Presence and real-time collaboration (see [Collaboration](./COLLABORATION.md))
- Figma and Figma Make connectors
- ALM and SCM connector baseline (link/sync only; backlog generation requires R4)

## R4 AI Agent Hub
- Provider-agnostic model gateway
- Public/private/in-house routing policy
- Approval Gate for risky actions
- Diagram generation and analysis agents
- Backlog extraction from diagram structures (AI-driven, ALM connector prerequisite from R3)

## R5 Custom Canvas Track
- Scene graph and hit-testing
- Connector routing engine
- Hybrid renderer benchmark
- Gradual migration from adapter renderers

## R6 Ecosystem
- Plugin marketplace
- Template marketplace
- Integration expansion
- Enterprise policy packs

## Priority Guardrail
If R1 exit criteria are not complete, R2+ items do not move to implementation.
