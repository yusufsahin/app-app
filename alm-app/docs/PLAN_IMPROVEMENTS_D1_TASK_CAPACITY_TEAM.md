# Plan İyileştirme Önerileri — D1, Task Schema, Capacity, Team

Bu doküman [alm_d1_task_capacity_team planına](.cursor/plans/alm_d1_task_capacity_team_42afbff7.plan.md) eklenebilecek iyileştirmeleri özetler: netleştirmeler, riskler, kabul kriterleri ve uygulama detayları.

---

## 1. D1 Tam Entegrasyon — İyileştirmeler

### 1.1 Event formatını sabitle

Plana **örnek event** eklemek implementasyonu hızlandırır ve MPC ile sözleşmeyi netleştirir:

```json
{
  "kind": "transition",
  "name": "artifact.transition",
  "object": {
    "id": "<artifact_uuid>",
    "type": "artifact",
    "artifact_type": "story",
    "state": "active",
    "assignee_id": "<uuid_or_null>",
    "custom_fields": {}
  },
  "actor": {
    "id": "<user_uuid>",
    "type": "user",
    "tenant_id": "<tenant_uuid>",
    "roles": ["member"]
  },
  "context": {
    "from_state": "open",
    "to_state": "active",
    "project_id": "<uuid>"
  },
  "timestamp": "2025-02-25T12:00:00Z"
}
```

**Öneri:** `transition_artifact.py` içinde `build_transition_event(artifact, command, current_user)` gibi tek bir fonksiyonda üret; PolicyEngine adapter aynı event’i kullansın.

### 1.2 PolicyEngine yoksa davranış

MPC paketi yüklü olsa bile PolicyEngine API’si (örn. `evaluate(event)`) farklı sürümlerde değişebilir. Öneri:

- **Önce** mevcut `check_transition_policies` çalışsın (assignee required vb.).
- **Sonra** PolicyEngine çağrısı: `_HAS_MPC` benzeri bir guard + try/except. Hata durumunda:
  - **Seçenek A:** Log + devam (geçişe izin ver) — geçici.
  - **Seçenek B:** Log + 503 / 422 “Policy check temporarily unavailable” — güvenli.

Başlangıçta Seçenek B tercih edilebilir; production’da MPC kesinleşince A’ya geçilebilir veya hata yönetimi sadeleştirilir.

### 1.3 Test stratejisi

- **Unit:** Event builder’ın `object`, `actor`, `context` alanlarını doğru doldurduğunu assert et.
- **PolicyEngine:** Mock `PolicyEngine.evaluate` (allow=True/False, reasons); 403/422 ve mesaj birleştirmesini test et.
- **Entegrasyon (opsiyonel):** MPC gerçek sürümü ile manifest’te bir Policy def ile red/green senaryosu.

### 1.4 Doküman

- `D1_POLICY_ACL_INTEGRATION.md` içinde “Event format” ve “PolicyEngine unavailable handling” bölümleri eklenebilir.

---

## 2. Task Form/List Schema — İyileştirmeler

### 2.1 GetListSchema (B — sabit schema)

- `GetListSchemaHandler.handle`: `entity_type == "task"` için `None` dönmek yerine proje/tenant kontrolü sonrası sabit `ListSchema` döndür.
- Kolonlar planla uyumlu: `id`, `title`, `state`, `assignee_id`, `rank_order`, `created_at`, `updated_at`. İstenirse `artifact_id` eklenebilir (linked artifact).
- Filtre: en azından `state` (todo, in_progress, done vb.); isteğe `assignee_id` filtresi.

### 2.2 GetFormSchema (task)

- `build_form_schema` şu an sadece `entity_type == "artifact"` ve `context == "create"` döndürüyor; `entity_type == "task"` için `None`.
- **Task create:** Sabit alanlar: title (required), description, state (choice), assignee_id (entity_ref user), rank_order.
- **Task edit:** Aynı alanlar; context `"edit"` ile ayrım yapılabilir (ileride task’a özel alanlar farklılaşırsa).

Önce sadece **create** ile başlamak yeterli; edit de aynı schema ile kullanılabilir.

### 2.3 Frontend tarafı

- List/form schema isteğinde `entity_type=task` kullanımı: hangi sayfada (örn. Artifact detay → Linked Tasks, veya ayrı Task list sayfası) kullanılacağı netleştirilirse API kullanımı tek yerde toplanır.
- Eğer task list şu an sabit kolonlarla çalışıyorsa, list-schema endpoint’i kullanmaya geçiş tek bir refactor olarak planlanabilir.

### 2.4 Kabul kriterleri (özet)

- [ ] `GET list-schema?entity_type=task` proje/tenant geçerliyse sabit ListSchema döner (artifact dışı ilk entity_type).
- [ ] `GET form-schema?entity_type=task&context=create` sabit FormSchema döner.
- [ ] Frontend task listesi (ve varsa form) bu schema’yı kullanır.

---

## 3. Capacity / Velocity — İyileştirmeler

### 3.1 Effort alanı konvansiyonu

Velocity = cycle’a göre “done” artifact’ların effort toplamı. Effort’ın nereden geleceği net olmalı:

- **Seçenek 1:** Manifest’te belirli bir custom field id’si (örn. `story_points`, `effort`) convention; bu id’ye sahip numeric alan toplanır.
- **Seçenek 2:** Artifact type bazlı farklı alanlar (örn. Story → story_points, Bug → effort); config veya manifest’te “velocity_field” gibi bir meta.
- **Seçenek 3:** Tek bir global custom field id (örn. config’de `velocity_effort_field_id`).

**Öneri:** İlk adımda Seçenek 1 veya 3 ile tek bir alan adı (örn. `story_points`) sabit kullanılabilir; ileride manifest’te “bu tip için effort alanı” tanımı eklenir.

### 3.2 Velocity API kapsamı

- **MVP:** `GET /projects/{id}/velocity?cycle_node_ids=...&last_n=5` (veya cycle_node_id tek tek): her cycle için `state=done` (veya workflow’daki “terminal” state’ler) artifact’ların effort toplamı. Cycle = Sprint olarak kullanılıyor (CycleNode).
- **State “done”:** Workflow’dan “son state” veya manifest’te `state_category: done` benzeri bir bilgi kullanılabilir; yoksa sabit `done` / `closed` / `resolved` listesi.
- Capacity (user/team başına planlanan saat) sonraki adım; plan “cycle bazlı velocity + isteğe bağlı capacity” ile uyumlu.

### 3.3 Burndown raporu (scope içi)

- **Hedef:** Cycle (Sprint) bazlı burndown — seçilen cycle’da kalan iş (remaining effort) veya tamamlanan iş (completed) zaman serisi.
- **Backend:** Velocity ile aynı effort alanı; `GET /projects/{id}/burndown?cycle_node_id=...` (tarih bazlı remaining/completed noktaları).
- **Frontend:** Planning veya Dashboard’da burndown grafiği. Velocity ile aynı konvansiyon (effort, done state, CycleNode).

### 3.4 Bağımlılık

- Artifact’ta numeric bir custom field’ın “effort” olarak kullanılması için manifest’te en az bir artifact type’da böyle bir field olmalı veya uygulama “bu alan yoksa 0 kabul et” demeli. Dokümanda “effort alanı kullanımı” netleştirilebilir.

---

## 4. Team Context — İyileştirmeler

### 4.1 Model ve migration

- **Team:** `id`, `project_id`, `name`, `created_at`, `updated_at` (ve istenirse `description`).
- **TeamMember:** `team_id`, `user_id`, `role` (opsiyonel); unique (team_id, user_id).
- Artifact/Task’a `team_id` (nullable FK) eklenmesi: migration’da default NULL; mevcut kayıtlar etkilenmez. Filtreleme “team_id boş veya şu takım” şeklinde olur.

### 4.2 API sırası

1. Team CRUD + proje bazlı list (`GET /projects/{id}/teams`).
2. TeamMember CRUD (veya team create/update içinde member listesi).
3. Artifact/Task’a `team_id` ekleme + list/query’de `team_id` filtresi.
4. UI: proje ayarlarında takım listesi; artifact/task formunda team seçimi; list filtrelerinde team.

Bu sıra plandaki “ilk adım: Team + TeamMember + proje bazlı CRUD” ile uyumlu.

### 4.3 Capacity ile ilişki

- “Team capacity” istersen: Capacity entity’de `team_id` (veya user_id) tutulur; Team önce gelirse capacity tarafında team_id referansı eklemek kolay olur. Bağımlılık: Team → (opsiyonel) Capacity.

---

## 5. Genel İyileştirmeler

### 5.1 Öncelik ve sıra

- **Önce:** D1 + Task schema (bağımlılık yok, hızlı değer).
- **Sonra:** Team (model + API); ardından Capacity/Velocity (effort konvansiyonu ile).
- Capacity ile Team’i birleştirmek istenirse Team’in önce bitmesi mantıklı.

### 5.2 Riski azaltma

- **D1:** PolicyEngine API’si değişirse sadece adapter (veya mpc_resolver içindeki çağrı) güncellenir; event formatı dokümante edilmiş olur.
- **Task schema:** Sabit schema (B) ile başlamak manifest değişikliği gerektirmez; A (TaskType) sonra eklenebilir.
- **Velocity:** Effort alanı yoksa 0 kabul et; grafik “tüm değerler 0” gösterebilir — kullanıcıya “effort alanı tanımlayın” mesajı verilebilir.

### 5.3 Sprint = Cycle (scope içi)

**Sprint ayrı entity değildir; Cycle olarak implemente edilmiştir.** ALM’de iteration/planning kavramı **CycleNode** (cycle) ile temsil edilir: `alm/cycle` (CycleNode entity, start_date, end_date, goal, state). Artifact’lar `cycle_node_id` ile cycle’a atanır; Planning sayfası Cycle backlog ve cycle/area filtreleri ile mevcut. Bu plan kapsamında Sprint ayrıca “out of scope” sayılmaz — Cycle/CycleItem (artifact’ın cycle’a atanması) zaten scope içindedir.

### 5.4 Genel ACL — MPC ve alm-app durumu

**manifest-platform-core-suite (`alm-manifest-app/manifest-platform-core-suite/src`) içinde:**

- **ACLEngine** (`mpc/acl/engine.py`): `ACLEngine(ast).check(action, resource, actor_roles=..., actor_attrs=...)` → `ACLResult(allowed, reasons, intents, errors)`. RBAC + opsiyonel ABAC; kurallarda `maskFields` listesi ile **maskField** intent’leri üretiyor (P2 dışı — alm-app P2’de uygulanmayacak).
- **PolicyEngine** (`mpc/policy/engine.py`): Event tabanlı `evaluate(event)` — D1 transition entegrasyonunda kullanılacak.
- **Workflow** (`mpc/workflow/fsm.py`): **GuardPort**, **AuthPort** interface’leri tanımlı.

**alm-app tarafında eksik olan (genel ACL):**

- Endpoint bazlı RBAC (require_permission) ve sabit **field_masking** (artifact:read_sensitive, SENSITIVE_CUSTOM_FIELD_KEYS) var; ancak manifest’teki **ACL** def’leri ve MPC **ACLEngine** kullanılmıyor. Yani:
  - **Okuma/yazma kararı:** Her istek için `ACLEngine.check(action="read"|"update", resource="artifact", actor_roles=...)` çağrısı yok.
  - **Alan maskeleme (P2 dışı):** maskField intent’leri manifest’ten (ACL kuralındaki `maskFields`) alınıp response’ta uygulanmıyor; şu an sadece sabit liste (internal_notes, confidential) kullanılıyor. P2’de response’ta alan maskeleme kapsam dışıdır.

**Öneri:** Genel ACL P2 kapsamı: manifest’te ACL def’leri (action, resource, roles); GET artifact / list öncesi ACLEngine.check (allow/deny). maskField intents’a göre response’ta alan maskeleme P2 kapsamında değildir; ileride ayrı iş paketi olarak ele alınabilir.

### 5.5 Burndown raporu (scope içi)

**Burndown raporu plan kapsamına alınmalı.** Cycle (Sprint) bazlı burndown: seçilen cycle’da kalan iş (remaining effort) veya tamamlanan iş (completed effort) zaman içinde nasıl değişiyor — genelde günlük veya tarih bazlı veri noktaları.

- **Veri:** Velocity ile aynı effort alanı + cycle_node_id + state; “remaining” = cycle’a atanmış ama henüz done olmayan artifact’ların effort toplamı (veya toplam planlanan − tamamlanan).
- **Backend:** Cycle bazlı velocity endpoint’ine ek veya ayrı `GET /projects/{id}/burndown?cycle_node_id=...` (tarih bazlı remaining/completed serisi).
- **Frontend:** Planning veya Dashboard’da burndown grafiği (örn. remaining effort vs date).

Bu plan “Capacity/velocity” başlığına **burndown raporu** eklenerek güncellenir; velocity ile aynı effort konvansiyonu ve cycle kullanılır.

### 5.6 Out of scope (bu plan için)

- Ayrı bir “Sprint” entity eklemek (Sprint = Cycle kullanılıyor).
- MPC/ALM dışı raporlama veya harici BI entegrasyonu.

---

## 6. Özet Tablo (güncellenmiş)

| Başlık               | İyileştirme özeti |
|----------------------|-------------------|
| D1                   | Event formatı sabitle; PolicyEngine yoksa/hata davranışı (B: 503/422); event builder + Policy mock testleri. |
| Genel ACL            | MPC ACLEngine mevcut; alm-app'te entegre değil — P2: manifest ACL + ACLEngine.check (allow/deny); maskField intents P2 kapsamında değil. |
| Task schema          | List + form için task branch (sabit); GetFormSchema’da task create (ve istenirse edit); AC’ler net. |
| Capacity/velocity   | Effort konvansiyonu (tek alan veya config); MVP = cycle velocity; “done” state kuralı; capacity sonra. Burndown: cycle bazlı remaining/completed + endpoint + grafik (scope içi). |
| Team                 | Team + TeamMember + migration (team_id nullable); API sırası CRUD → member → artifact/task team_id + filtre. |
| Sprint               | Scope dışı değil; Sprint = Cycle (CycleNode) implemente; Planning, Cycle backlog mevcut. |

Bu maddeler plan dokümanına “İyileştirmeler” veya “Detaylar” bölümü olarak eklenebilir; implementasyon sırasında referans alınır.

---

## 7. Sonraki adımlar (devam)

Uygulamaya geçmek için önerilen sıra:

1. **D1 (P1):** `transition_artifact.py` içinde `build_transition_event(...)` ekle; mpc_resolver veya policy adapter'da `PolicyEngine(ast, meta).evaluate(event)` çağır; `allow is False` ise mevcut `check_transition_policies` ihlalleri ile birleştirip ValidationError fırlat. Unit test: event builder + mock PolicyEngine.
2. **Task schema (P3):** `get_list_schema.py` → `entity_type == "task"` için sabit `ListSchema` döndür (kolonlar: id, title, state, assignee_id, rank_order, created_at, updated_at; filtre: state). `manifest_form_schema_builder.py` → `entity_type == "task"` ve `context == "create"` için sabit FormSchema döndür.
3. **Team (P6):** Team ve TeamMember modelleri + migration; proje bazlı Team CRUD API; ardından artifact/task'a team_id (nullable) + list filtreleri.
4. **Velocity (P4):** Effort konvansiyonu (örn. custom field `story_points`); cycle bazlı velocity endpoint; Planning/Dashboard'da velocity grafiği.
5. **Burndown (P5):** Burndown endpoint (cycle_node_id, tarih serisi); frontend'te burndown grafiği.
6. **Genel ACL (P2):** Manifest'te ACL def'leri; GET artifact/list öncesi ACLEngine.check (allow/deny); response'ta alan maskeleme (maskField) yok.

Takip: [REMAINING_PLAN.md](./REMAINING_PLAN.md) — "Plan: D1, Task schema, Capacity, Burndown, Team, Genel ACL" tablosu.

— ↑ [Dokümanlar](README.md)
