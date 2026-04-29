# @visera Security Model

## Scope
Security baseline for `@visera` across embedded and standalone deployments.

## Identity and Access
- OIDC/SAML-compatible authentication
- Workspace and project scoping
- Role-based authorization (owner/admin/editor/reviewer/viewer)

## Tenant Isolation
- Hard tenant boundaries in data access
- Tenant-aware authorization checks
- Isolation tests as release gates

## Data Protection
- Encryption for sensitive credentials
- Backend-only secret access
- Strict upload and export controls

## AI Safety Controls
- Data classification labels
- Provider Policy for model routing
- Approval Gate for high-impact actions
- Full AI action auditability

## Audit Coverage
- Document mutations
- Permission changes
- Export/share actions
- Integration operations
- AI provider/model/tool usage
