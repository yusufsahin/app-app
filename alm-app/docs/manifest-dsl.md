# ALM Manifest DSL

Domain-Specific Language for process definitions. Manifest DSL, proje süreçlerini (workflow, artifact tipleri, politikalar) tanımlayan bir metadil (meta language) olarak çalışır.

## 1. DSL Konsepti

**Metadata-driven**: Süreç davranışı manifest ile tanımlanır; kod değişikliği olmadan farklı süreç modelleri desteklenir.

- **Grammar**: Yapısal kurallar (sözdizimi)
- **Semantics**: Anlamsal kurallar (validasyon, davranış)
- **Serialization**: JSON/YAML formatı

## 2. EBNF Grammar

```ebnf
(* Manifest: ana kök *)
manifest        = "manifest" "{" section+ "}"

section         = workflows | artifact_types | policies

(* Workflows: durum makinesi tanımları *)
workflows       = "workflows" ":" "[" workflow+ "]"
workflow        = "{" workflow_id "," workflow_name "," states "," transitions "}"
workflow_id     = string
workflow_name   = string
states          = "states" ":" "[" state+ "]"
state           = "{" state_id "," state_name "," category "}"
state_id        = string
state_name      = string
category        = "proposed" | "in_progress" | "completed"
transitions     = "transitions" ":" "[" transition+ "]"
transition      = "{" "from" ":" state_id "," "to" ":" state_id "}"

(* Artifact types: iş öğesi tipleri *)
artifact_types  = "artifact_types" ":" "[" artifact_type+ "]"
artifact_type   = "{" type_id "," type_name "," workflow_ref "}"
type_id         = string
type_name       = string
workflow_ref    = "workflow_id" ":" workflow_id

(* Policies: geçiş kuralları, validasyonlar - ileride *)
policies        = "policies" ":" "[" policy* "]"
```

## 3. JSON Schema (Serialization)

Manifest DSL, JSON/YAML ile serialize edilir. Yapı:

```json
{
  "workflows": [
    {
      "id": "<workflow_id>",
      "name": "<display_name>",
      "states": [
        {
          "id": "<state_id>",
          "name": "<display_name>",
          "category": "proposed | in_progress | completed"
        }
      ],
      "transitions": [
        { "from": "<state_id>", "to": "<state_id>" },
        { "from": "<state_id>", "to": "<state_id>", "trigger": "<trigger_id>", "trigger_label": "<görünen_ad>" }
      ]
    }
  ],
  "artifact_types": [
    {
      "id": "<type_id>",
      "name": "<display_name>",
      "workflow_id": "<workflow_id>"
    }
  ],
  "policies": []
}
```

## 4. Semantik Kurallar

### 4.1 Workflow

| Kural | Açıklama |
|-------|----------|
| `states` boş olamaz | En az bir state gerekli |
| `category` | `proposed`, `in_progress`, `completed` olmalı |
| `transitions` | `from` ve `to` geçerli state id’lerine referans vermeli; opsiyonel `trigger`, `trigger_label`, `guard` (whitelist koşul; bkz. GUARD_EVALUATOR_SECURITY.md) |
| Initial state | `category = "proposed"` olan ilk state, yeni artifact’ın başlangıç durumu |

### 4.2 Artifact Type

| Kural | Açıklama |
|-------|----------|
| `workflow_id` | Var olan bir workflow id’sine referans vermeli |
| `type_id` | Benzersiz, slug formatında (a-z, 0-9, `-`) |

### 4.3 Geçiş Validasyonu

`transition(from, to)` geçerli ⟺ manifest’te ilgili workflow’da `{ "from": from, "to": to }` tanımlı.

## 5. DSL Örneği (Basic)

```yaml
# Basic process template - YAML serialization
workflows:
  - id: basic
    name: Basic
    states:
      - id: new
        name: New
        category: proposed
      - id: active
        name: Active
        category: in_progress
      - id: resolved
        name: Resolved
        category: completed
      - id: closed
        name: Closed
        category: completed
    transitions:
      - from: new
        to: active
      - from: active
        to: resolved
      - from: resolved
        to: closed
      - from: closed
        to: active

artifact_types:
  - id: requirement
    name: Requirement
    workflow_id: basic
  - id: defect
    name: Defect
    workflow_id: basic

policies: []
```

## 6. Genişletilebilirlik

### 6.1 Policy DSL — `when state = 'active' require assignee`
### 6.2 Artifact hierarchy — `parent_types`, `child_types` (epic → feature → requirement). CreateArtifact parent_id için doğrulanır.
- **Custom fields**: manifest’te `fields` tanımı
- **Actions**: `on_enter`, `on_leave` hook’ları


— ↑ [Dokümanlar](README.md)
