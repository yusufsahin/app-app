# AI Provider Connectors

## Scope
Defines connector-level contracts for public, private, and in-house AI model providers.

## Provider Categories
- Public providers
- Enterprise private providers
- In-house/self-hosted providers

## Connector Requirements
- Health check endpoint
- Model discovery/listing
- Inference capability metadata
- Optional tool-calling capability flags
- Usage metadata support where available

## Policy Model
- Route by data sensitivity and Provider Policy
- Restrict confidential workloads to approved providers
- Require Approval Gate for sensitive or high-impact actions

## Audit Requirements
- Provider and model used
- Request class/sensitivity
- Action type and approval state
- Actor and timestamp
