# Workflow API (state transition)

Artifact durum geçişleri için kullanılan HTTP API özeti. Manifest’teki workflow tanımı (states, transitions, trigger, guard) tek kaynaktır; detay için [WORKFLOW_ENGINE_BOUNDARY.md](./WORKFLOW_ENGINE_BOUNDARY.md) ve [manifest-schema.md](./manifest-schema.md) bakın.

---

## 1. İzin verilen geçişler

**GET** `/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/permitted-transitions`

- **Amaç:** Artifact’ın mevcut durumundan yapılabilecek geçişleri döner (manifest + guard’a göre filtrelenir).
- **Yanıt:** `{ "items": [ { "trigger", "to_state", "label" } ] }`
  - `trigger`: API’de geçiş tetiklemek için kullanılacak id (manifest’teki `trigger` veya `to_state`).
  - `to_state`: Hedef state id.
  - `label`: Görünen ad (manifest’teki `trigger_label` veya `trigger`/`to_state`).
- **Guard:** Manifest’te transition’da `guard` varsa, entity snapshot’a göre değerlendirilir; guard sağlanmıyorsa o geçiş listede yer almaz.

---

## 2. Tek artifact geçişi

**PATCH** `/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/transition`

- **Body:** `new_state` ve/veya `trigger` (en az biri gerekli). Opsiyonel: `state_reason`, `resolution`, `expected_updated_at`.
- **trigger kullanımı:** İstekte sadece `trigger` gönderilirse backend manifest’e göre hedef state’i çözümler (örn. `trigger: "start"` → `to_state: "active"`). `new_state` ile doğrudan hedef state de gönderilebilir.
- **Guard:** Geçişte guard tanımlıysa ve koşul sağlanmıyorsa 422 + "Transition guard not satisfied".

---

## 3. Toplu geçiş

**POST** `/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/batch-transition`

- **Body:** `artifact_ids`, ve `new_state` veya `trigger` (en az biri). Opsiyonel: `state_reason`, `resolution`.
- **trigger:** Aynı trigger her artifact için kendi mevcut durumuna göre hedef state’e çözümlenir (artifact’lar farklı durumda olabilir).
- **Yanıt:** `success_count`, `error_count`, `errors`, `results` (artifact_id → `ok` | `validation_error` | `policy_denied` | `conflict_error`).

---

## 4. İlgili dokümanlar

- [WORKFLOW_ENGINE_BOUNDARY.md](./WORKFLOW_ENGINE_BOUNDARY.md) — Adapter vs MPC, handler sırası, guard entegrasyonu.
- [TRANSITION_OBSERVABILITY.md](./TRANSITION_OBSERVABILITY.md) — Geçiş metrikleri, log, tracing.
- [GUARD_EVALUATOR_SECURITY.md](./GUARD_EVALUATOR_SECURITY.md) — Guard tipleri (assignee_required, field_present, field_equals), güvenlik kuralları.
- [manifest-schema.md](./manifest-schema.md) — Workflow transitions (trigger, trigger_label, guard).

— ↑ [Dokümanlar](README.md)
