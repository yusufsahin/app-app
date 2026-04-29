# Figma Integration

## Scope
Connect `@visera` diagrams with Figma files, frames, and design context.

## Use Cases
- Link diagram nodes to Figma frames
- Embed Figma previews in diagram documentation
- Import design context metadata
- Maintain traceability between architecture and design assets

## Auth Model
- OAuth-based workspace connection
- Tenant/workspace-scoped credential binding

## Data Flow
1. User connects Figma account
2. User selects file/frame
3. Link metadata stored in `@visera`
4. Preview and context available inside diagram workflow

## Audit and Policy
- Log connect/disconnect events
- Log link creation and unlink actions
- Enforce connector scope and workspace access policies
