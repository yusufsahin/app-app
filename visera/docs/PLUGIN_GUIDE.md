# @visera Plugin Guide

## Scope
Guidelines for extending `@visera` through controlled plugin contracts.

## Plugin Categories
- Shape plugins
- Connector plugins
- Property editor plugins
- Template plugins
- Import/export plugins

## Minimum Plugin Contract
Each plugin defines:
- `id`
- `name`
- `version`
- `capabilities`
- registration hooks

## Shape Manifest Essentials
- Unique shape identifier
- Category and display name
- Default size and style
- Ports and connection behavior
- Editable properties
- Renderer mapping metadata

## Governance

- Workspace-level plugin enable/disable
- Capability-based permission checks
- Plugin signing for enterprise deployments (see below)

### Plugin Signing Policy

Unsigned plugins are allowed in development and self-hosted environments. Enterprise workspaces may enforce a signed-only policy.

Signing requirements:

- Publisher identity verified via signing key pair
- Manifest hash signed and embedded in plugin bundle
- Registry validates signature on install and on load
- Revocation list checked at workspace policy enforcement time

Signing authority options:

- Self-signed (trusted per workspace allow-list)
- Organization CA (internal enterprise PKI)
- `@visera` registry CA (future managed marketplace)

## Plugin Lifecycle

1. **Register** — plugin loaded into registry at workspace init
2. **Activate** — capabilities declared and permission checks run
3. **Runtime** — plugin responds to canvas events and command hooks
4. **Deactivate** — cleanup hooks run on workspace close or explicit disable
5. **Uninstall** — plugin removed; persisted data governed by workspace retention policy

## Compatibility

Plugins target canonical model contracts, not renderer internals. This keeps plugins stable across renderer changes.
