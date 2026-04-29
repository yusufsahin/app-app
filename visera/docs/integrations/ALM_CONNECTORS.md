# ALM Connectors

## Scope

Defines how `@visera` connects diagram entities to ALM work items and delivery workflows.

## Supported Targets

- Jira
- Azure DevOps
- GitHub Issues
- GitLab Issues

## Core Use Cases

- Link node to work item
- Create work item from diagram selection
- Sync status from ALM tools back into diagram context

## AI-Enhanced Use Cases (requires R4 AI Agent Hub)

- Generate backlog proposals from diagram structures (Backlog Extraction Agent)
- Suggest work item relationships based on diagram topology

## Auth Model

- OAuth or service token per connector
- Workspace and project-level connector scoping

## Mapping Contract

- `externalSystem`
- `externalProject`
- `externalItemId`
- `linkType`
- `syncDirection`
- `lastSyncAt`

## Sync Conflict Handling

Bi-directional sync may produce conflicts when both sides mutate the same field between sync cycles.

Resolution strategy:

- `syncDirection: source-to-diagram` — ALM is authoritative; diagram field is overwritten
- `syncDirection: diagram-to-source` — diagram is authoritative; ALM field is overwritten
- `syncDirection: bidirectional` — last-write-wins by `updatedAt` timestamp; ties favour the ALM source
- Conflict events are logged and surfaced in the connector observability dashboard

## Audit and Policy

- Log create/update/delete mapping operations
- Enforce per-role sync permissions
- Block destructive sync actions without Approval Gate when configured
