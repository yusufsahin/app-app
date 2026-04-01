# Reusable Tabular Grid

This document defines the adoption boundary for the shared `ReactGrid`-based tabular surface.

## Shared layer

Shared files under `frontend/src/shared/components/lists/` own:

- grid shell and `ReactGrid` integration
- schema to column mapping
- editor registry
- selection semantics
- pinned column behavior
- dirty/pending cell state
- generic cell commit contract

Shared code must stay domain-agnostic:

- no artifact-specific imports
- no quality-specific imports
- no settings-specific query logic

## Feature adapter layer

Feature adapters own:

- row shaping
- field editability rules
- mutation wiring
- toast and rollback behavior
- feature-specific display renderers
- domain-specific pinned/default columns

Current first consumer:

- `frontend/src/features/artifacts/components/ArtifactsTableView.tsx`

## Good next consumers

- `frontend/src/features/quality/pages/QualityDefectsPage.tsx`
- `frontend/src/features/quality/components/QualityRunsHubPanel.tsx`
- `frontend/src/features/artifacts/pages/RequirementTraceabilityMatrixPage.tsx` flat relationships view only
- `frontend/src/features/settings/pages/MemberManagementPage.tsx`
- `frontend/src/features/settings/pages/AccessAuditPage.tsx`

## Non-goals for the shared grid

These should remain feature-specific or separate surfaces:

- matrix renderers
- tree navigation
- hierarchy views
- traceability matrix cells
- workflow boards
- complex domain bulk actions

## First phase scope

The first reusable implementation supports:

- single-cell editing
- keyboard navigation
- pinned columns
- row selection
- optimistic save with rollback
- basic schema-driven editor mapping

Deferred capabilities:

- multi-range selection
- fill handle
- undo/redo
- complex cross-row paste rules
