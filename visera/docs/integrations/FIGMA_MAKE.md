# Figma Make Integration

## Scope

Enable diagram-to-prototype handoff by generating Figma Make-ready prompt packages.

## Use Cases

- Convert diagram context to prototype brief
- Generate interaction and layout guidance from selected nodes/pages
- Attach generated prototype links back to diagram context

## Auth Model

- Reuse Figma workspace authorization model
- Restrict access to approved workspaces/projects

## Data Flow

1. User selects diagram/page/scope
2. `@visera` creates structured prompt package
3. Package is sent to Figma Make flow
4. Returned prototype reference is stored in diagram metadata

## Prompt Package Structure

The prompt package is a JSON document submitted to the Figma Make API.

```typescript
interface FigmaMakePromptPackage {
  version: string                  // package schema version
  sourceRef: {
    viseraDocumentId: string
    viseraPageId?: string
    nodeIds?: string[]             // scoped selection; omit for full page
  }
  brief: {
    title: string
    description?: string
    interactionHints: string[]     // e.g. ["modal opens on node click"]
    layoutHints: string[]          // e.g. ["grid layout", "sidebar navigation"]
  }
  nodes: FigmaMakeNodeSummary[]
  dataClassification: 'public' | 'internal' | 'confidential'
}

interface FigmaMakeNodeSummary {
  id: string
  type: string
  label?: string
  style?: Record<string, unknown>
  connections: string[]            // connected node ids
}
```

`dataClassification` is evaluated against Provider Policy before submission.
Packages marked `confidential` are blocked from public Figma Make endpoints.

## Audit and Policy

- Track who generated prompts and when
- Track target workspace/project references
- Apply data sensitivity checks before external prompt submission
- Log prompt package hash and classification in AI audit trail
