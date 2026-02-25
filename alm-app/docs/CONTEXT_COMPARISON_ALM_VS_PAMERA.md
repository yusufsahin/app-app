# ALM Backend vs Pamera API — Context Karşılaştırması

Bu doküman **alm-manifest-app/alm-app/backend** ile **pamera/pameraapi** projelerinin bounded context / domain yapılarını karşılaştırır. Kaynaklar: ALM için [CONTEXTS_AND_PROGRESSION.md](./CONTEXTS_AND_PROGRESSION.md) ve [alm-app.md](./alm-app.md); Pamera için [DOMAIN_CONTEXT_MAP.md](https://github.com/.../pamera/DOMAIN_CONTEXT_MAP.md) ve [BOUNDED_CONTEXTS.md](https://github.com/.../pamera/docs/architecture/BOUNDED_CONTEXTS.md).

---

## 1. Context Sayısı ve İsimlendirme

| Alan | ALM (docs + kod) | Pamera (docs + kod) |
|------|------------------|---------------------|
| **Dokümandaki context sayısı** | 6 (Process, Artifact, Tenant/Project, Task, Planning, Traceability) | 10 (Artifact, Process, Iteration, Team, Area, Board, Query, Workflow, Scripting, Shared) |
| **Kodda modül/paket** | auth, tenant, project, artifact, task, comment, **cycle**, **area**, process_template, form_schema, shared | artifact, process, project, **projectstructure** (Area), **planning** (Iteration), team, auth, scripting, shared, i18n |
| **Planning bölünmesi** | Tek “Planning” context; kodda **cycle** (iteration) + **area** ayrı paket | **Iteration** + **Area** ayrı bounded context |

ALM’de Planning tek context olarak anılıyor; uygulamada cycle (iteration) ve area ayrı modüller. Pamera’da da Iteration ve Area ayrı context’ler ve ayrı modüller (planning, projectstructure).

---

## 2. Context Bazlı Karşılaştırma

### 2.1 Process / Süreç

| Özellik | ALM Backend | Pamera API |
|--------|-------------|------------|
| **Kaynak** | Manifest DSL (workflows, artifact_types); proje bazlı manifest (process_template_version_id) | Process template YAML (Agile, Scrum, Kanban, CMMI, …); ProcessConfiguration, artifact types, states, transitions |
| **Saklama** | process_template + process_template_version; manifest JSON projede (project_manifest) | Process entity, artifact type definitions, state definitions, transition rules (DB) |
| **Workflow** | Manifest’teki workflow engine (MPC veya inline); state geçişleri manifest’e göre | Workflow engine metadata-driven; guard/action script (TypeScript) |
| **Vurgu** | Manifest tek kaynak; meta-metadata (form/list schema) manifest’ten türetilir | Süreç şablonları + script (GraalVM) ile guard/action |

ALM: Manifest merkezli, tek deklaratif kaynak. Pamera: Süreç şablonları + script motoru.

---

### 2.2 Artifact / İş Öğesi

| Özellik | ALM Backend | Pamera API |
|--------|-------------|------------|
| **Aggregate** | Artifact (parent_id, cycle_node_id, area_node_id, area_path_snapshot, custom_fields, state, …) | Artifact (type, state, area, iteration, assignment, hierarchy, tags, links) |
| **Tip/State** | Manifest’teki artifact_types + workflow | Process’ten artifact type + state definitions |
| **Planning bağlantısı** | cycle_node_id, area_node_id + area_path_snapshot | iterationPath (path snapshot), areaId + areaPathSnapshot |
| **Hiyerarşi** | parent_id (epic → feature → story) | parentId + ArtifactLink (parent/child, related, blocks, …) |
| **Traceability** | Planlanan: link entity yok (REMAINING_PLAN’da) | ArtifactLink, LinkType (parent/child, related, duplicate, blocks) |
| **Task** | Ayrı Task aggregate (artifact_id FK) | Task artifact tipi veya ayrı task entity (kodda task’lar artifact’a bağlı) |
| **Comment** | Ayrı Comment aggregate (artifact_id) | Artifact detayda comment |

Her iki tarafta da Artifact merkez; ALM’de planning cycle/area alanları ve snapshot path’ler Pamera’daki iteration/area kullanımına benzer. Pamera’da link ve traceability tasarımda/net; ALM’de traceability planlanan.

---

### 2.3 Tenant / Organization / Project

| Özellik | ALM Backend | Pamera API |
|--------|-------------|------------|
| **Çok kiracı** | Tenant (org) + slug; proje tenant’a bağlı | Proje merkezli; multi-tenancy dokümanda/ürün seviyesinde |
| **Proje** | Project (tenant_id, process_template_version_id, code, manifest) | Project (status, settings, metadata) |
| **RBAC** | Tenant: Role, Privilege, Membership; Project: ProjectMember, permission (project:read, artifact:create, …) | Auth/IAM: User, Role, JWT; proje/alan bazlı erişim |
| **Org/tenant API** | /orgs/{org_slug}/… (resolve_org); projeler org altında | /api/v1/projects/… |

ALM org/tenant/proje hiyerarşisi ve izinleri daha açık tanımlı; Pamera proje ve ekip/alan odaklı.

---

### 2.4 Planning: Cycle/Iteration ve Area

| Özellik | ALM Backend | Pamera API |
|--------|-------------|------------|
| **Iteration** | **CycleNode** (parent_id, path, depth, sort_order, goal, start_date, end_date, state) | **IterationNode** (parent_id, path, depth, sort_order); tree/flat API |
| **Area** | **AreaNode** (parent_id, path, depth, sort_order, is_active); rename, move, activate/deactivate | **AreaNode** (parent_id, path, depth, sort_order, is_active); rename, move, activate/deactivate |
| **Artifact atama** | cycle_node_id; area_node_id + area_path_snapshot | iterationId/iterationPath; areaId + areaPathSnapshot |
| **Path subtree** | find_by_project_and_path_prefix (rename/move) | findByProjectIdAndPathPrefix (rename/move) |

Kavram ve API’ler hizalı: ALM’deki CycleNode ≈ Pamera IterationNode, ALM AreaNode ≈ Pamera AreaNode; artifact tarafında alanlar ve snapshot path kullanımı benzer.

---

### 2.5 Task

| Özellik | ALM Backend | Pamera API |
|--------|-------------|------------|
| **Konum** | Ayrı task modülü (artifact_id FK) | Artifact’a bağlı task’lar veya task tipi |
| **CRUD** | CreateTask, UpdateTask, DeleteTask, ListTasksByArtifact, GetTask | Task CRUD, artifact ile ilişki |
| **Schema** | Manifest/task metadata ile (planlanan) | Process/artifact type ile |

ALM’de task ayrı aggregate; Pamera’da da artifact’a bağlı görev kavramı var.

---

### 2.6 Traceability / Link

| Özellik | ALM Backend | Pamera API |
|--------|-------------|------------|
| **Durum** | Planlanan (link type metadata); henüz entity/API yok | ArtifactLink, LinkType (parent/child, related, duplicate, blocks); domain event’ler tanımlı |
| **Kullanım** | CONTEXTS_AND_PROGRESSION’da Adım 5 | Artifact aggregate içinde hierarchy + links |

Pamera’da traceability tasarımda ve dilde net; ALM’de sırada.

---

### 2.7 Board, Query, Workflow, Scripting

| Context | ALM Backend | Pamera API |
|---------|-------------|------------|
| **Board** | Yok | Tasarımda; Kanban/Scrum, sütun = state, WIP, swimlane |
| **Query** | Yok (liste filtreleri API param) | Tasarımda; kayıtlı sorgular, AQL, paylaşım |
| **Workflow (otomasyon)** | Yok | Tasarımda; event tetikleyiciler, kurallar |
| **Scripting** | Yok | GraalVM ile TypeScript/JS; guard/action script |

Bu dört context sadece Pamera tarafında (Board/Query/Workflow tasarımda; Scripting implemente). ALM’de karşılığı yok.

---

### 2.8 Form / List Schema ve Metadata

| Özellik | ALM Backend | Pamera API |
|--------|-------------|------------|
| **Form schema** | form_schema modülü; GetFormSchema (entity_type, context); manifest’ten türetim | FormSchemaContract, metadata-driven form; process/artifact type ile |
| **List schema** | GetListSchema; manifest/artifact_types ile uyumlu kolon/filtre | Metadata-driven list; alan kataloğu |
| **Meta-metadata** | artifact_types[].fields (planlanan); form/list tek kaynak | Process/field definitions, quality manifest örnekleri |

ALM’de form/list schema manifest merkezli; Pamera’da process ve metadata katalogları merkezli.

---

## 3. Mimari ve Entegrasyon

| Alan | ALM Backend | Pamera API |
|------|-------------|------------|
| **Mimari** | Clean Architecture + DDD + Hexagonal; CQRS (Command/Query), Mediator, DTO | Spring Modulith (modüler monolit); DDD, aggregate, domain event |
| **İletişim** | Mediator.send(command) / .query(query); session-scoped | ApplicationModuleListener (event), port/adapter (query) |
| **Süreç → Artifact** | Manifest (workflow, artifact_types) projede; transition manifest’e göre | Process context → Artifact (Customer–Supplier); transition kuralları Process’ten |
| **Area/Iteration → Artifact** | Artifact area_node_id, cycle_node_id + path snapshot | Conformist: Artifact path/ID kullanır; ağaç ilgili context’te |

ALM: CQRS + Mediator + manifest tek kaynak. Pamera: Modulith + event + port/adapter, süreç ve alan/iterasyon context’leri ayrı.

---

## 4. Özet Tablo: Context Eşlemesi

| ALM (doc + kod) | Pamera (doc + kod) | Not |
|-----------------|--------------------|-----|
| Process | Process | ALM: manifest; Pamera: template + script |
| Artifact | Artifact | Her ikisinde de core; planning alanları benzer |
| Tenant/Project | Project (+ Auth) | ALM’de tenant/org açık; Pamera proje merkezli |
| Task | Task (artifact’a bağlı) | ALM ayrı aggregate; Pamera da artifact ile ilişkili |
| Planning | Iteration + Area | ALM: cycle + area; Pamera: iteration + area (aynı kavram) |
| Traceability | ArtifactLink / LinkType | Pamera’da var/tasarımda; ALM’de planlanan |
| (yok) | Board, Query, Workflow, Scripting | Sadece Pamera’da |
| Form/List schema | Metadata/FormSchema | ALM manifest; Pamera process/metadata |

---

## 5. Sonuç ve Öneriler

- **Ortak noktalar:** Artifact merkezli ALM; Planning’te iteration (cycle) ve area ağacı; artifact’ta iteration/area ataması ve path snapshot; Process/Manifest ile süreç ve tip/state tanımı.
- **Farklar:** ALM manifest’i tek kaynak ve meta-metadata (form/list) oradan türetiyor; Pamera süreç şablonları + script + metadata katalogları kullanıyor. Pamera’da Board, Query, Workflow, Scripting context’leri var; ALM’de yok. Traceability Pamera’da tasarımda/var, ALM’de planlanan.
- **Referans:** Pamera’daki Iteration/Area, link tipleri ve event’ler ALM’deki cycle/area ve ileride traceability için rehber alınabilir; ALM tarafında manifest merkezlilik ve CQRS/Mediator yapısı korunabilir.

---

**İlgili dokümanlar:**  
- [CONTEXTS_AND_PROGRESSION.md](./CONTEXTS_AND_PROGRESSION.md)  
- [alm-app.md](./alm-app.md)  
- [REMAINING_PLAN.md](./REMAINING_PLAN.md)  
- Pamera: `DOMAIN_CONTEXT_MAP.md`, `docs/architecture/BOUNDED_CONTEXTS.md`

— ↑ [Dokümanlar](README.md)
