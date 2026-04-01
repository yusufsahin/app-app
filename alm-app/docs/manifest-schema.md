# Manifest Schema

Proje süreçlerini tanımlayan manifest_bundle yapısı. Detaylı DSL grammar ve semantik için [manifest-dsl.md](./manifest-dsl.md) bakınız.

## Genel Yapı

```json
{
  "workflows": [...],
  "artifact_types": [...],
  "policies": [...],
  "task_workflow_id": "task_basic",
  "tree_roots": [...]
}
```

Opsiyonel kök alanlar:

- **task_workflow_id**: `defs` içindeki `Workflow` kimliği; artifact’a bağlı **Task** varlığının form/list state seçenekleri bu workflow’dan üretilir. Yoksa `task_basic` aranır; o da yoksa sunucu varsayılanı (`todo` / `in_progress` / `done`) kullanılır.
- **tree_roots**: Artifact listesi **tree** filtresi için `tree` query değeri → kök artifact tipi eşlemesi. Manifest yoksa veya boşsa varsayılan: `requirement` → `root-requirement`, `quality` → `root-quality`, `defect` → `root-defect`.

```json
"tree_roots": [
  { "tree_id": "requirement", "root_artifact_type": "root-requirement", "label": "Requirements" }
]
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
    { "from": "active", "to": "resolved", "trigger": "resolved", "trigger_label": "Resolve" },
    { "from": "resolved", "to": "closed" },
    { "from": "closed", "to": "active" }
  ]
}
```

- **states**: Geçerli durumlar. `category`: `proposed` | `in_progress` | `completed`
- **transitions**: İzin verilen durum geçişleri (from → to). Opsiyonel: **trigger**, **trigger_label** (tetikleyici/etiket); **guard** (geçişe izin koşulu; sadece whitelist predikatlar, bkz. GUARD_EVALUATOR_SECURITY.md). Guard örnekleri: `"assignee_required"`, `{"type": "field_present", "field": "state_reason"}`, `{"type": "field_equals", "field": "resolution", "value": "fixed"}`
- **resolution_target_states** (opsiyonel): `resolution_options` tanımlı workflow’larda, bu state’lere geçerken çözüm (resolution) alanının zorunlu/otomatik doldurulması için kullanılır. Verilmezse: state nesnelerinde `category: completed` kullanılır; o da yoksa `resolved` / `closed` / `done` id’leri (büyük/küçük harf duyarsız) ile eşleştirilir.

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

## Metadata (liste, kökler, planlama, burndown)

Sunucu, manifest kaydedilirken veya okunurken `merge_manifest_metadata_defaults` ile eksik alanları doldurur (`tree_roots`, `task_workflow_id`, `task_basic` workflow, `resolution_target_states` ipuçları).

- **system_roots**: Silinemez / yeniden üstlenemez kök artifact tip id listesi. Yoksa `defs` içinde `is_system_root` veya `flags.is_system_root` olan `ArtifactType` satırları; o da yoksa `root-requirement`, `root-quality`, `root-defect`.
- **planning**: `cycle_for_types` / `area_for_types`: `null` veya alan yok = tüm tipler; `[]` = hiçbiri; dolu liste = sadece bu tipler formda cycle/area alanını görür.
- **artifact_list.columns**: Tablo kolonları (sıra, `visible`, `sortable`, `label`). Verilirse çekirdek kolonlar bu liste ile kısıtlanır; manifest alanları (`artifact_types[].fields`) hâlâ ek kolon olarak eklenir.
- **artifact_list.surfaces.\<surface\>**: Surface-bazlı liste politikası. `backlog` ve `defects` gibi surface'ler için kolon davranışı manifest'ten ayarlanabilir.

```json
"artifact_list": {
  "columns": [
    { "key": "title", "label": "Summary", "order": 1, "sortable": true },
    { "key": "state", "order": 2 }
  ],
  "surfaces": {
    "backlog": {
      "fixed_columns": ["artifact_key", "title", "state", "priority", "updated_at"]
    },
    "defects": {
      "fixed_columns": ["title", "severity", "updated_at"],
      "exclude_columns": ["artifact_key", "artifact_type", "state_reason", "resolution"],
      "extra_column_limit": 2
    }
  }
}
```

- **fixed_columns**: Surface açıldığında öncelikli / sabit kolon kümesi. Backend liste şeması bu kolonları surface contract'ı olarak döner.
- **exclude_columns**: Bu surface'te hiç görünmemesi gereken kolonlar.
- **extra_column_limit**: Sabit kolonlardan sonra eklenecek ek manifest alanı sayısı. Özellikle defects benzeri triage görünümleri için kullanışlıdır.
- **burndown_done_states**: Burndown’da “tamamlanmış” sayılacak state id listesi. API `done_states` göndermezse proje manifest’inden okunur.
- **ArtifactType.icon**: UI’da lucide ikon anahtarı (örn. `file-text`, `bug`, `list-checks`); API flat manifest’te tip nesnesine yansır.
- **search_locale**: Artifact listesi FTS (`q`) için PostgreSQL `regconfig` adı (allowlist: `english`, `simple`, `turkish`, …). Yoksa `ALM_FULLTEXT_SEARCH_CONFIG` / sunucu varsayılanı kullanılır.

## Link types (traceability)

`defs` içinde `kind: LinkType` satırları flat yanıtta `link_types` listesine dönüşür. Zorunlu: **id**, **name** (yoksa id’den türetilir). İsteğe bağlı (UI / doğrulama için): **direction**, **inverse_name**, **label**, **cardinality**, **from_types**, **to_types**, **description**. Link oluştururken `link_type` değeri, manifest’te tanımlı id’lerden biri olmalıdır (tanım varsa).

— ↑ [Dokümanlar](README.md)
