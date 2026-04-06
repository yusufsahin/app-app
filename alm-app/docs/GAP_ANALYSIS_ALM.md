# ALM App — Gap Analizi

Bu doküman ALM uygulamasının **mevcut durum** ile **hedef** arasındaki boşlukları özetler. Güncel plan ve tamamlanan P4–P6 (velocity, burndown, team) satırları için kaynak: [REMAINING_PLAN.md](./REMAINING_PLAN.md) — “Plan: D1, Task schema, Capacity, Burndown, Team, Genel ACL”.

---

## 1. Özet Tablo (Context Bazlı)

| Context | ALM mevcut | Hedef | Gap / öncelik |
|--------|------------|-------|----------------|
| **Process** | Manifest, workflow, artifact_types; form/list schema; edit + kaydet; custom kolonlar | Manifest edit + kaydet; custom fields list | — |
| **Artifact** | CRUD, transition, FTS, task, comment, attachment, cycle/area, links | Work items, links, attachments | — |
| **Tenant/Project** | Org, proje, RBAC, project member; Team + TeamMember (CRUD), artifact/task `team_id` + filtre | Project, teams, permissions | D1 tam MPC PolicyEngine/ACLEngine entegrasyonu (kısmen ✓); opsiyonel kapasite/availability modeli |
| **Task** | Entity, CRUD, Linked Tasks panel; **form/list schema** (sabit schema, P3 ✓) | Sub-tasks, linked tasks | Tamamen manifest’ten task şeması (opsiyonel) |
| **Planning** | Cycle/area, Planning + Cycle backlog; cycle bazlı **velocity** ve **burndown** (API + grafik); artifact cycle atama | Iteration, area, backlog, forecast | **Capacity** ve ileri tahmin: [PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) |
| **Traceability** | ArtifactLink; **SCM links** (manuel API + GitHub/GitLab webhook, `task_id`, unmatched kuyruk, teslimat idempotency: `X-GitHub-Delivery` / `X-Gitlab-Event-UUID`); Kaynak sekmesi; LinkType manifest (`link_types`) | Deploy/CI olayları ile ortam izlenebilirliği (S4) | S4+ ve derin Git entegrasyonu: [PLAN_SCM_TRACEABILITY.md](./PLAN_SCM_TRACEABILITY.md) |
| **Board** | Kanban board (state kolonları, sürükle-bırak; type + cycle + area filtresi) | Kanban/Scrum board | — |
| **Real-time** | WebSocket + Redis PubSub; transition sonrası toast | Live updates, presence | C1/C2 tamamlandı |
| **Dashboard** | KPI kartları, recent activity | KPI, grafikler, activity feed | D3 temel tamam; derinleştirme: [PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) |
| **Rate limit** | Tenant bazlı Redis sliding window, 429 + Retry-After | Tier (Free/Pro/Enterprise) | D2 tamamlandı |
| **Admin** | Health, access audit, admin user CRUD/soft delete, tenant archive; UI: Members admin, Audit sayfası, Archive org | Admin context | G1–G5 + UI tamamlandı |

**Not:** Sprint entity yok; planlama zaman ekseni domain'de **Cadence**, UI'da ise **Release/Cycle** olarak temsil edilir. Artifact'lar `cycle_id` ile cycle'a atanır.

---

## 2. Planning Context (Cycle + Area)

| Özellik | ALM | Hedef | Gap |
|--------|-----|-------|-----|
| Release/Cycle tree API | Cadence CRUD, flat/tree | Var | — |
| Area tree API | AreaNode CRUD, rename, move, activate/deactivate | Var | — |
| Artifact’a cycle/area atama | Backend (cycle_id, area_node_id) | Var | — |
| **Planning UI** | Cycle/area ağacı, Cycle backlog sekmesi, list’te cycle/area filtre | Cycle/area ağacı, artifact atama, list’te cycle/area filtre | — |
| Backlog / cycle planning ekranı | Cycle backlog (seçili cycle’a göre artifact listesi, cycle atama, View all in Artifacts) | Backlog listesi, cycle’a atama (cycle_id) | — |
| Velocity | Cycle bazlı velocity API + grafik | Raporlama | — ([REMAINING_PLAN.md](./REMAINING_PLAN.md) P4 ✓) |
| Burndown | Cycle bazlı burndown API + grafik | Raporlama | — ([REMAINING_PLAN.md](./REMAINING_PLAN.md) P5 ✓) |
| Team | Team + TeamMember, CRUD; artifact/task team_id + filtre | Takım bağlama | — ([REMAINING_PLAN.md](./REMAINING_PLAN.md) P6 ✓) |
| Capacity (planlanan süre / müsaitlik) | Yok | Sprint/cycle planlama | [PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) A1; ayrıca [PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md](./PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md) §3 |

**Özet:** Planning UI, cycle bazlı velocity/burndown ve team bağlamı tamam; **capacity** (kişi veya takım bazlı planlanan saat / availability) ve ileri analitik sonraki aşamada.

---

## 3. Tamamlanan Özellikler (Güncel)

- **C1:** WebSocket + Redis PubSub; frontend subscription, artifact_state_changed ile liste invalidate
- **C2:** State transition’da real-time toast (Artifact updated: state changed to X)
- **C4:** Conflict resolution (409); optimistic lock expected_updated_at; Overwrite/Cancel modal
- **A2:** Monaco YAML modu; JSON/YAML dil seçimi; hata satırı (JSON position + Alert)
- **D2:** Tenant rate limiting (Redis sliding window, 429 + Retry-After)
- **D3:** Dashboard KPI kartları + recent activity (son güncellenen artifact’lar)
- **E3:** GitHub Actions CI (backend: ruff, pytest; frontend: lint, build, test:unit)
- **Manifest:** defs flat format desteği; kaydetmede MPC semantic validation; normalizer boş workflow states hatası
- **A1, A3:** Manifest edit + kaydet; list custom kolonlar
- **B4:** Comment + Attachment (entity, API, artifact detayda paneller)
- **Traceability:** ArtifactLink entity, API, artifact detayda Links paneli; LinkType manifest (`link_types`, create validasyonu) ✓
- **Planning UI:** Cycle/area ağacı (tree), Cycle backlog sekmesi, list’te cycle/area filtre
- **Velocity & burndown:** Cycle bazlı velocity ve burndown API + grafik (P4, P5 ✓)
- **Team context:** Team + TeamMember CRUD; artifact/task `team_id` + filtre (P6 ✓)
- **Genel ACL:** Manifest ACL + `ACLEngine.check` (allow/deny); artifact/manifest endpoint’lerinde `require_manifest_acl` (P2 ✓)
- **Workflow API:** GET permitted-transitions (entity snapshot’a göre guard filtreli); PATCH transition ve POST batch-transition’da `trigger` veya `new_state`; manifest’te transition’lara opsiyonel trigger, trigger_label, guard; guard evaluator (whitelist, eval yok). Bkz. [WORKFLOW_API.md](./WORKFLOW_API.md), [GUARD_EVALUATOR_SECURITY.md](./GUARD_EVALUATOR_SECURITY.md).

---

## 4. Liste Filtreleri ve API

| Filtre | API param | UI |
|--------|-----------|-----|
| State | state | Var |
| Tip | type_filter | Var |
| Metin arama | q (FTS) | Var |
| Cycle | cycle_id | Var |
| Area | area_node_id | Var |

---

## 5. İlgili Dokümanlar

- [REMAINING_PLAN.md](./REMAINING_PLAN.md) — Kalan işler (Faz A–E, **Faz F** uzun vadeli)
- [PLAN_SCM_TRACEABILITY.md](./PLAN_SCM_TRACEABILITY.md) — SCM / PR / commit izlenebilirliği planı
- [PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) — Capacity, load vs capacity, forecast
- [CONTEXTS_AND_PROGRESSION.md](./CONTEXTS_AND_PROGRESSION.md) — Context’ler ve ilerleyiş
- [CONTEXT_COMPARISON_ALM_VS_PAMERA.md](./CONTEXT_COMPARISON_ALM_VS_PAMERA.md) — ALM vs Pamera karşılaştırması
- [alm-app.md](./alm-app.md) — Mimari ve aşama planı

— ↑ [Dokümanlar](README.md)
