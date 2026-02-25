# ALM App — Gap Analizi

Bu doküman ALM uygulamasının **mevcut durum** ile **hedef** arasındaki boşlukları özetler. Güncel plan için [REMAINING_PLAN.md](./REMAINING_PLAN.md) kullanılır.

---

## 1. Özet Tablo (Context Bazlı)

| Context | ALM mevcut | Hedef | Gap / öncelik |
|--------|------------|-------|----------------|
| **Process** | Manifest, workflow, artifact_types; form/list schema; edit + kaydet; custom kolonlar | Manifest edit + kaydet; custom fields list | — |
| **Artifact** | CRUD, transition, FTS, task, comment, attachment, cycle/area, links | Work items, links, attachments | — |
| **Tenant/Project** | Org, proje, RBAC, project member | Project, teams, permissions | Proje bazlı izin detayı (D1); Team context yok |
| **Task** | Entity, CRUD, Linked Tasks panel | Sub-tasks, linked tasks | Task form/list schema manifest’ten (opsiyonel) |
| **Planning** | Cycle (CycleNode), Area (AreaNode), artifact atama; Planning sayfası, Cycle backlog | Iteration, area, backlog | Capacity/velocity yok (uzun vadeli) |
| **Traceability** | ArtifactLink entity, API, artifact detayda Links paneli | ArtifactLink, LinkType | LinkType manifest’ten (opsiyonel) |
| **Board** | Kanban board (state kolonları, sürükle-bırak; type + cycle filtresi) | Kanban/Scrum board | — |
| **Real-time** | WebSocket + Redis PubSub; transition sonrası toast | Live updates, presence | C1/C2 tamamlandı |
| **Dashboard** | KPI kartları, recent activity | KPI, grafikler, activity feed | D3 recent activity tamamlandı |
| **Rate limit** | Tenant bazlı Redis sliding window, 429 + Retry-After | Tier (Free/Pro/Enterprise) | D2 tamamlandı |
| **Admin** | Health, access audit, admin user CRUD/soft delete, tenant archive; UI: Members admin, Audit sayfası, Archive org | Admin context | G1–G5 + UI tamamlandı |

**Not:** Sprint entity yok; **Cycle (CycleNode)** ile iteration/planning yapılır. Artifact’lar `cycle_node_id` ile cycle’a atanır.

---

## 2. Planning Context (Cycle + Area)

| Özellik | ALM | Hedef | Gap |
|--------|-----|-------|-----|
| Cycle (iteration) tree API | CycleNode CRUD, flat/tree | Var | — |
| Area tree API | AreaNode CRUD, rename, move, activate/deactivate | Var | — |
| Artifact’a cycle/area atama | Backend (cycle_node_id, area_node_id) | Var | — |
| **Planning UI** | Cycle/area ağacı, Cycle backlog sekmesi, list’te cycle/area filtre | Cycle/area ağacı, artifact atama, list’te cycle/area filtre | — |
| Backlog / cycle planning ekranı | Cycle backlog (seçili cycle’a göre artifact listesi, View all in Artifacts) | Backlog listesi, cycle’a atama (cycle_node_id) | — |
| Capacity / velocity / burndown | Yok | Raporlama | Uzun vadeli |

**Özet:** Backend ve Planning UI (cycle/area ağacı, Cycle backlog) tamam; ileride artifact atama Planning'ten ve capacity/velocity raporları.

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
- **Traceability:** ArtifactLink entity, API, artifact detayda Links paneli
- **Planning UI:** Cycle/area ağacı (tree), Cycle backlog sekmesi, list’te cycle/area filtre
- **Workflow API:** GET permitted-transitions (entity snapshot’a göre guard filtreli); PATCH transition ve POST batch-transition’da `trigger` veya `new_state`; manifest’te transition’lara opsiyonel trigger, trigger_label, guard; guard evaluator (whitelist, eval yok). Bkz. [WORKFLOW_API.md](./WORKFLOW_API.md), [GUARD_EVALUATOR_SECURITY.md](./GUARD_EVALUATOR_SECURITY.md).

---

## 4. Liste Filtreleri ve API

| Filtre | API param | UI |
|--------|-----------|-----|
| State | state | Var |
| Tip | type_filter | Var |
| Metin arama | q (FTS) | Var |
| Cycle | cycle_node_id | Var |
| Area | area_node_id | Var |

---

## 5. İlgili Dokümanlar

- [REMAINING_PLAN.md](./REMAINING_PLAN.md) — Kalan işler (Faz A–E)
- [CONTEXTS_AND_PROGRESSION.md](./CONTEXTS_AND_PROGRESSION.md) — Context’ler ve ilerleyiş
- [CONTEXT_COMPARISON_ALM_VS_PAMERA.md](./CONTEXT_COMPARISON_ALM_VS_PAMERA.md) — ALM vs Pamera karşılaştırması
- [alm-app.md](./alm-app.md) — Mimari ve aşama planı

— ↑ [Dokümanlar](README.md)
