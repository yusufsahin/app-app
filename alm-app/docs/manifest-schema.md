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

- **task_workflow_id**: `defs` içindeki `Workflow` kimliği; artifact’a bağlı **Task** varlığının (ayrı aggregate, `artifact_id` FK) form/list state seçenekleri bu workflow’dan üretilir. Yoksa `task_basic` aranır; o da yoksa sunucu varsayılanı (`todo` / `in_progress` / `done`) kullanılır. Azure DevOps’taki Task **work item type** ile karıştırılmamalı: yerleşik şablonlarda (Basic, Scrum, Kanban, ADO, Agile, CMMI) sprint/kırılım işi manifest `ArtifactType` olarak tanımlanmaz; hep bu Task entity + `task_workflow_id` ile gider.
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

## Board (Kanban / flow)

İsteğe bağlı kök alan **`board`**: proje panosu (`BoardPage`) için metadata. Tüm alanlar opsiyonel; **`board` yoksa** veya **`surfaces.default` yoksa** davranış, workflow `states` sırasına göre kolonlar + listede görünen manifest dışı state’ler için ek kolonlar (mevcut varsayılan).

```json
"board": {
  "surfaces": {
    "default": {
      "column_source": "workflow_states",
      "hide_state_ids": ["archived"],
      "column_order_override": ["new", "active", "done"],
      "card_fields": ["title", "assignee_id", "priority"],
      "group_by": "assignee_id"
    }
  }
}
```

- **column_source**: `workflow_states` (varsayılan) — her kolon bir workflow state id’si; `state_category` — kolonlar `states[].category` değerleridir (`proposed` \| `in_progress` \| `completed`), sürükleyince hedef state workflow içinde o kategorideki **ilk** state olur.
- **hide_state_ids**: `workflow_states` modunda bu state id’leri kolon setinden çıkarılır; `state_category` modunda ilgili state’ler kategori türetiminde yok sayılır, bu state’deki artifact’lar ek state kolonlarında gösterilir.
- **column_order_override**: `workflow_states` için sıra — id’ler manifest’teki workflow state’lerinde tanımlı olmalıdır. `state_category` için sıra — değerler workflow’da kullanılan kategori string’leri olmalıdır.
- **card_fields**: Kart üzerinde gösterilecek alan anahtarları (UI ileride kullanır; kayıtta doğrulanır).
- **group_by**: Swimlane / gruplama için ayrılmış alan (ileride).

Kayıt sırasında backend, `board` bloğunu `validate_manifest_board_section` ile doğrular (`hide_state_ids` / `column_order_override` referansları workflow ile uyumlu olmalı).

## Proje `settings` ve SCM webhook (manifest dışı)

`projects.settings` JSON alanı **manifest_bundle** parçası değildir; `PATCH /orgs/.../projects/{id}` ile güncellenir. SCM otomasyonu için kullanılan isteğe bağlı anahtarlar:

| Anahtar | Amaç |
|--------|------|
| `scm_github_webhook_secret` | GitHub webhook gövdesi için `X-Hub-Signature-256` (HMAC-SHA256) doğrulaması |
| `scm_gitlab_webhook_secret` | GitLab `X-Gitlab-Token` başlığı ile birebir karşılaştırma |
| `deploy_webhook_secret` | CI dağıtım webhook’u: ham JSON gövdesi için `X-Hub-Signature-256` (HMAC-SHA256, GitHub ile aynı `sha256=` öneki) |
| `scm_webhook_github_enabled` | `false` iken imza doğrulandıktan sonra GitHub PR/push işlenmez (`{"reason":"disabled"}`). Varsayılan: açık |
| `scm_webhook_gitlab_enabled` | `false` iken GitLab MR/push işlenmez. Varsayılan: açık |
| `scm_webhook_push_branch_regex` | Boş değilse yalnızca bu Python regex’i ile `re.search` eşleşen dallarda **push** commit’leri işlenir; PR/MR bu anahtardan etkilenmez. Geçersiz regex: loglanır, eşleşme **açık** (fail-open) |

**Güvenlik:** Proje **GET** yanıtlarında secret değerleri dönmez; yalnızca `scm_webhook_github_secret_configured`, `scm_webhook_gitlab_secret_configured` ve `deploy_webhook_secret_configured` bayrakları ile yapılandırılmış olup olmadığı bildirilir. Politika anahtarları (`*_enabled`, `push_branch_regex`) secret değildir; `settings` içinde düz metin döner. GitHub/GitLab webhook uçları ham gövdeyi **1 MiB** üzerinde **413** ile reddeder (`SCM_WEBHOOK_MAX_BODY_BYTES`).

**İstemci başlıkları (idempotency):** GitHub `X-GitHub-Delivery`, GitLab `X-Gitlab-Event-UUID` — aynı değerle gelen ikinci istek, önceki başarılı işlemden sonra yan etkisiz şekilde `duplicate_delivery` ile sonuçlanır; ayrıntı [PLAN_SCM_TRACEABILITY.md §5](./PLAN_SCM_TRACEABILITY.md).

Uç noktalar ve eşleme kuralları: [PLAN_SCM_TRACEABILITY.md](./PLAN_SCM_TRACEABILITY.md).

## Link types (traceability)

`defs` içinde `kind: LinkType` satırları flat yanıtta `link_types` listesine dönüşür. Zorunlu: **id**, **name** (yoksa id’den türetilir). İsteğe bağlı (UI / doğrulama için): **direction**, **inverse_name**, **label**, **cardinality**, **from_types**, **to_types**, **description**. Link oluştururken `link_type` değeri, manifest’te tanımlı id’lerden biri olmalıdır (tanım varsa).

— ↑ [Dokümanlar](README.md)
