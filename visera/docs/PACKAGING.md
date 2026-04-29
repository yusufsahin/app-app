# @visera Packaging

## Scope

Defines the package structure and deployment matrix for `@visera` across all product modes.

## Packages

| Package | Purpose |
|---|---|
| `visera-domain` | Canonical model, commands, repository contracts |
| `visera-api-contracts` | API types, DTOs, event schemas |
| `visera-renderer-react-flow` | React Flow adapter |
| `visera-renderer-whiteboard` | Whiteboard adapter |
| `visera-renderer-bpmn` | BPMN adapter |
| `visera-ui` | Editor shell, toolbars, panels, design tokens |
| `visera-shell-embedded` | Embedded app shell (ALM integration host) |
| `visera-shell-standalone` | Standalone app shell (independent product) |
| `visera-shell-headless` | Headless SDK entry point |

## Deployment Matrix

| Package | Embedded | Standalone | Headless |
|---|---|---|---|
| `visera-domain` | required | required | required |
| `visera-api-contracts` | required | required | required |
| `visera-renderer-react-flow` | required | required | optional |
| `visera-renderer-whiteboard` | optional | optional | optional |
| `visera-renderer-bpmn` | optional | optional | optional |
| `visera-ui` | required | required | excluded |
| `visera-shell-embedded` | required | excluded | excluded |
| `visera-shell-standalone` | excluded | required | excluded |
| `visera-shell-headless` | excluded | excluded | required |

## Dependency Rules

- `visera-domain` and `visera-api-contracts` have no UI or framework dependencies.
- Renderer packages depend on `visera-domain` only — no cross-renderer dependencies.
- `visera-ui` depends on `visera-domain` and one or more renderer packages.
- Shell packages are thin hosts; all logic lives in domain and UI layers.

## Embedded Shell Integration

The embedded shell integrates with ALM via a documented host API:

- **Props** — `workspaceId`, `documentId`, `currentUser`, `featureFlags`
- **Events out** — `onDocumentSave`, `onNodeSelect`, `onExport`
- **Events in** — `setTheme`, `setReadOnly`, `loadDocument`

No direct coupling to ALM internals; the host API is the only contract.
