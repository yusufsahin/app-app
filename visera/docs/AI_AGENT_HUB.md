# @visera AI Agent Hub

## Scope
Architecture and policies for AI-assisted diagram generation, review, and automation.

## Provider Strategy
`@visera` supports:
- Public providers
- Private enterprise providers
- In-house model endpoints

Provider integration details: [AI Provider Connectors](./integrations/AI_PROVIDER_CONNECTORS.md)

## Core Components
- Provider registry
- Capability-aware model router
- Provider Policy evaluation engine
- Agent runtime
- Tool registry
- Approval Gate workflow
- AI audit logging

## Safety Model
- AI proposes actions as patches or operations.
- Sensitive operations require Approval Gate checks.
- Policy violations block execution.
- Every execution path is auditable.

## Example Agent Types
- Diagram generation agent
- Architecture review agent
- BPMN analysis agent
- Backlog extraction agent
- Integration orchestration agent

## Security Alignment
AI behavior is constrained by [Security Model](./SECURITY_MODEL.md) and integration governance in [Integration Hub](./integrations/README.md).
