# Manifest Schema

Proje süreçlerini tanımlayan manifest_bundle yapısı. Detaylı DSL grammar ve semantik için [manifest-dsl.md](./manifest-dsl.md) bakınız.

## Genel Yapı

```json
{
  "workflows": [...],
  "artifact_types": [...],
  "policies": [...]
}
```

## Workflows

Her workflow, artifact'ların geçebileceği durumları ve geçişleri tanımlar.

```json
{
  "id": "basic",
  "name": "Basic",
  "states": [
    { "id": "new", "name": "New", "category": "proposed" },
    { "id": "active", "name": "Active", "category": "in_progress" },
    { "id": "resolved", "name": "Resolved", "category": "completed" },
    { "id": "closed", "name": "Closed", "category": "completed" }
  ],
  "transitions": [
    { "from": "new", "to": "active" },
    { "from": "active", "to": "resolved" },
    { "from": "resolved", "to": "closed" },
    { "from": "closed", "to": "active" }
  ]
}
```

- **states**: Geçerli durumlar. `category`: `proposed` | `in_progress` | `completed`
- **transitions**: İzin verilen durum geçişleri (from → to)

## Artifact Types

Her artifact tipi hangi workflow'u kullandığını belirtir.

```json
{
  "id": "requirement",
  "name": "Requirement",
  "workflow_id": "basic"
}
```

## Policies (İleride)

Kurallar: örn. "active" durumuna geçmeden önce assignee zorunlu.

— ↑ [Dokümanlar](README.md)
