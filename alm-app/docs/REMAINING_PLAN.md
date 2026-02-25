# ALM App — Kalan İşler Planı

Bu doküman, mevcut durum özetinden sonra kalan işleri öncelik sırasıyla listeler. Her blok tahmini kapsam ve bağımlılıklarla birlikte verilmiştir.

---

## Mevcut Durum (Özet)

**Tamamlanmış:**
- Auth, tenant/org, projeler, artifact CRUD, workflow transition
- Manifest okuma, form schema, list schema (backend + frontend)
- Manifest sayfası: Overview, Workflow (görsel diyagram, geçiş ekleme/kaydetme), Form preview, Source (Monaco düzenlenebilir, Save, JSON/YAML, hata satırı)
- Artifacts sayfası: list-schema + MetadataDrivenList (custom kolonlar artifact_types.fields'tan), bulk seçim, conflict modal (409)
- Planning sayfası: Cycles, Areas, Cycle backlog; backlog'da artifact cycle atama (dropdown) (seçili cycle’a göre artifact listesi, “View all in Artifacts” linki)
- Board sayfası: Kanban (state kolonları, sürükle-bırak, type + cycle + area filtresi, View in Artifacts linki)
- Real-time: WebSocket + Redis PubSub (C1), transition toast (C2)
- Dashboard: KPI kartları, recent activity (D3); rate limit tenant bazlı (D2)
- CI: GitHub Actions (backend ruff + pytest + pip-audit, frontend lint + build + build:check-size + test:unit + npm audit); Dependabot (npm, pip)
- ESLint 9 flat config; test: Playwright e2e, Vitest unit (manifestPreviewSchema, workflowManifest, permissions, savedQueryApi, workflowRuleApi, artifactApi, appPaths, planningApi); pytest unit (backend: mpc_resolver, list_schema, form_schema_builder, security _matches_permission)
- D1: Tasarım + GuardPort/AuthPort + field masking (artifact:read_sensitive, SENSITIVE_CUSTOM_FIELD_KEYS) + transition policy hook; pytest unit (field_masking)
- **Admin context (G1–G5):** Health (app_version, environment, /health/ready), Access audit (login success/failure, GET /admin/audit/access), Admin kullanıcı oluşturma/liste/soft delete (POST/GET/DELETE /admin/users), Tenant arşivleme (DELETE /tenants/{id}); UI: Members sayfasında admin (include deleted, create user, delete), Access audit sayfası, Settings’te Archive organization

**Referans:** Aşama planının tam listesi için [alm-app.md §12](./alm-app.md#12-asama-plani-phases) kullanılır.

---

## Faz A — Manifest & List İyileştirmeleri (Kısa vadeli)

**Hedef:** Manifest düzenleme ve list deneyimini tamamlamak.

| # | Görev | Detay | Tahmini |
|---|--------|--------|---------|
| A1 | Manifest edit + kaydet | Monaco’da düzenlenebilir JSON; backend’e PUT/PATCH ile kaydetme; versiyonlama varsa version create | ✓ |
| A2 | Monaco YAML modu (opsiyonel) | Dil seçimi JSON/YAML; YAML serialize/parse; hata satırı gösterimi | ✓ |
| A3 | List schema’da custom kolonlar | Backend list-schema’ya artifact_types.fields’tan custom kolon ekleme; MetadataDrivenList’te gösterme | ✓ |
| A4 | MetadataDrivenList’te bulk seçim (opsiyonel) | Checkbox kolonu, select all, mevcut bulk transition/delete ile entegre | ✓ |

**Çıktı:** Manifest’i UI’dan düzenleyip kaydedebilme; liste tarafında custom alan ve istenirse toplu işlem.

---

## Faz B — Arama & Artifact Derinleştirme (Orta vadeli)

**Hedef:** Arama deneyimi ve artifact’a bağlı Task/comment altyapısı.

| # | Görev | Detay | Tahmini |
|---|--------|--------|---------|
| B1 | PostgreSQL FTS (tsvector) | Artifacts tablosunda title/description için tsvector kolonu + index; API’de `q` ile FTS sorgusu | ✓ |
| B2 | Task entity + API | Task aggregate (artifact_id FK), CRUD, link/unlink; basit Task list/detail API | ✓ |
| B3 | Artifact detayda Linked Tasks paneli | Task listesi, “Add task”, task’a git linki | ✓ |
| B4 | Comment / Attachment (opsiyonel) | Entity + API + UI (artifact detayda comment + attachment listesi, ekleme) | ✓ |

**Çıktı:** FTS ile arama; artifact’a bağlı task ve istenirse comment/attachment.

---

## Faz C — Real-time & Workflow Görsel (Orta–uzun vadeli)

**Hedef:** Canlı güncellemeler ve workflow tasarımı.

| # | Görev | Detay | Tahmini |
|---|--------|--------|---------|
| C1 | WebSocket + Redis PubSub | FastAPI WebSocket endpoint; Redis pub/sub bridge; frontend’te subscription (örn. state change) | ✓ |
| C2 | State transition’da real-time feed | Transition sonrası event yayını; ilgili sayfada dinleme ve liste güncelleme | ✓ |
| C3 | WorkflowDesigner (görsel FSM) | Görsel diyagram, geçiş ekleme/silme (taslak), manifest'e kaydetme | ✓ |
| C4 | Conflict resolution (409) | State transition 409 durumunda UI’da ConflictResolutionModal; merge/overwrite seçenekleri | ✓ |

**Çıktı:** Real-time bildirimler; istenirse görsel workflow editörü ve conflict çözümü.

---

## Faz D — Policy, ACL, Dashboard (Uzun vadeli)

**Hedef:** İzinler, limitler ve özet ekranlar.

| # | Görev | Detay | Tahmini |
|---|--------|--------|---------|
| D1 | MPC PolicyEngine / ACLEngine entegrasyonu | Tasarım + GuardPort/AuthPort + **field masking** (artifact:read_sensitive, custom_fields internal_notes/confidential); transition’da policy hook. PolicyEngine harici çağrı MPC hazır olunca. | Kısmen ✓ |
| D2 | Tenant rate limiting | Redis sliding window; 429 + Retry-After | ✓ |
| D3 | Dashboard sayfası | KPI kartları, basit grafikler, activity feed; backend’te read model / materialized view | ✓ (temel) |
| D4 | Cycle (CycleNode) iyileştirmeleri (opsiyonel) | Cycle CRUD, artifact cycle_node_id atama, cycle bazlı filtre; Planning’te Cycle backlog sekmesi | ✓ |

**Çıktı:** İzin ve limit kontrollü API; dashboard; cycle/planning UI istenirse genişletilir.

---

## Faz E — Kalite & DevOps (Paralel / sürekli)

**Hedef:** CI, test ve güvenlik tarafı.

| # | Görev | Detay | Tahmini |
|---|--------|--------|---------|
| E1 | Unit testler | Kritik modüller için Vitest + Testing Library (örn. manifestPreviewSchema, form/list helpers) | Sürekli |
| E2 | Pre-commit hooks | ruff, eslint (frontend); format check | ✓ |
| E3 | GitHub Actions CI | build, lint, test (unit), backend pytest | ✓ |
| E4 | Bundle size budget | Vite plugin ile PR’da uyarı; Lighthouse CI (opsiyonel) | ✓ |
| E5 | Dependency & güvenlik taraması | npm audit / pip-audit; Trivy (container); Dependabot | ✓ |

**Çıktı:** Otomatik kontroller, daha güvenli ve sürdürülebilir repo.

---

## Önerilen Sıra

1. **Faz A** — A1–A4 tamamlandı (manifest edit, custom kolonlar, bulk seçim).
2. **Faz E (kısmen)** — E2–E5 tamamlandı; E1 (unit testler) sürekli.
3. **Faz B** — B1–B4 tamamlandı (FTS, Task, Comment, Attachment).
4. **Faz C** — C1–C4 tamamlandı (WebSocket, toast, WorkflowDesigner, conflict modal).
5. **Faz D** — D2, D3, D4 tamamlandı; D1 tasarım + port impl eklendi; PolicyEngine/field masking MPC hazır olunca tamamlanacak.

---

## Plan: D1, Task schema, Capacity, Burndown, Team, Genel ACL

Bu blok [PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md](./PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md) ile uyumludur. Sprint = Cycle (CycleNode); burndown ve genel ACL scope içindedir.

| # | Başlık | Kapsam | Durum |
|---|--------|--------|--------|
| P1 | D1 PolicyEngine | Event build + PolicyEngine.evaluate + ihlal birleştirme | ✓ |
| P2 | Genel ACL | Manifest ACL + ACLEngine.check (allow/deny); maskField yok | ✓ (tüm artifact/manifest endpoint’lerinde require_manifest_acl) |
| P3 | Task form/list schema | GetListSchema + GetFormSchema entity_type=task (sabit schema) | ✓ |
| P4 | Velocity | Cycle bazlı velocity API + grafik | ✓ |
| P5 | Burndown | Cycle bazlı burndown API + grafik | ✓ |
| P6 | Team context | Team + TeamMember, CRUD, artifact/task team_id + filtre | ✓ (CRUD + members) |

Öncelik: P1 + P3 → P6 → P4 + P5 → P2. P2 tamamlandı: `require_manifest_acl("artifact"|"manifest", "read"|"update")` tüm ilgili endpoint’lere eklendi (list/get/create/update/delete/transition artifact, links, comments, attachments, tasks; manifest get/put; form/list schema).

---

## Sonraki Adımlar (İsteğe bağlı / uzun vadeli)

- **Board context:** Kanban/Scrum board (type + cycle + area filtreleri, sürükle-bırak; tamamlandı).
- **LinkType manifest:** Manifest defs’te `kind: LinkType` (id, name); flat’ta link_types; create link’te manifest’te tanımlıysa link_type validasyonu; GET/PUT manifest response’ta link_types (tamamlandı).
- **E1:** Unit testlere yeni modüller eklenebilir (örn. listSchema, formSchema, planningApi yardımcıları).
- **Planning:** Artifact’ı cycle’a atamayı doğrudan Planning sayfasından yapılabiliyor (Cycle backlog’da dropdown; tamamlandı).
- **D1:** MPC PolicyEngine/ACLEngine tam entegrasyonu (MPC interface’leri hazır olunca).

---

## Takip

- Bu dosyada görevler tamamlandıkça `[x]` ile işaretlenebilir veya tarih eklenebilir.
- Yeni gereksinimler ilgili faza madde olarak eklenebilir.
- Tahminler değişebilir; büyük özellikler (örn. C3) alt görevlere bölünebilir.

— ↑ [Dokümanlar](README.md)
