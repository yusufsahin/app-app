# Manifest DSL / Metadata-Driven İhlal Analizi (Frontend)

**Kaynak:** `manifest-dsl.md`, `CONTEXTS_AND_PROGRESSION.md` — *"Süreç davranışı manifest ile tanımlanır; form/list schema manifest'ten (meta-metadata) türetilir."*

**Durum:** Aşağıdaki ihlaller düzeltildi (fix all).

---

## Özet

| # | Konum | İhlal | Öneri |
|---|--------|--------|--------|
| 1 | ArtifactsPage – liste toolbar | Filtreler (State, Type, Cycle, Area, Sort, Order, Search, Saved query) tamamen hardcoded | Liste filtreleri `listSchema.filters` + varsa ek filtreler metadata ile tanımlanmalı; toolbar tek kaynak olarak schema kullanmalı |
| 2 | ArtifactsPage – table fallback | `listSchema` yokken sabit kolonlu `<Table>` render ediliyor | Schema yokken tablo göstermemek (loading/mesaj) veya fallback’i kaldırmak |
| 3 | ArtifactsPage – artifact detay düzenleme | Drawer’da “Edit” için Title, Description, Assignee hardcoded TextField/Select | `useFormSchema(..., "artifact", "edit")` + `MetadataDrivenForm` kullanılmalı |
| 4 | ArtifactsPage – task ekleme/düzenleme | Add task / Edit task dialog’ları tamamen hardcoded (title, state, assignee) | Backend’de `entity_type=task`, `context=create|edit` form schema var; `useFormSchema(..., "task", "create")` / `"edit"` + `MetadataDrivenForm` kullanılmalı |
| 5 | ArtifactsPage – state transition dialog | State reason / Resolution alanları hardcoded Select | İsteğe bağlı: workflow/transition metadata’dan seçenekler türetilebilir |
| 6 | ArtifactsPage – detay drawer Planning | Cycle / Area seçicileri hardcoded | Form schema’da planning alanları varsa metadata-driven yapılabilir |

---

## 1. Liste toolbar filtreleri (ArtifactsPage, ~satır 927–1090)

**Durum:** Sayfa hem `MetadataDrivenList` ile `schema={listSchema}` kullanıyor hem de üstte ayrı bir toolbar’da şu alanlar **hardcoded**:

- Search (TextField)
- Saved queries (Select)
- State (Select)
- Type (Select)
- Cycle (Select)
- Area (Select)
- Sort by (Select)
- Order (Select)
- Show deleted (Checkbox)

Backend `get_list_schema` zaten `filters` dönüyor (`type`, `state` için `ListFilterSchema`). Metadata-driven prensibe göre liste filtreleri **list schema**’dan gelmeli; ek ihtiyaçlar (Cycle, Area, Sort, Search) ya schema genişletmesi ya da ayrı bir “list view options” metadata ile tanımlanmalı.

**İhlal:** Filtrelerin schema dışında, sabit kodla tanımlanması.

---

## 2. Table fallback (listSchema yokken)

**Konum:** `ArtifactsPage.tsx` ~1364–1460.

**Durum:** `viewMode === "table"` ama `!listSchema` iken sabit kolonlu `<Table>` (Key, Type, Title, State, …) render ediliyor.

**İhlal:** Liste görünümü her zaman **list schema** ile tanımlanmalı; schema yokken aynı sayfada sabit kolonlu tablo göstermek metadata-driven kuralını bozar.

**Öneri:** `listSchema` yokken tablo göstermeyip “Loading…” veya “List schema not available” mesajı göstermek; fallback tabloyu kaldırmak.

---

## 3. Artifact detay düzenleme (drawer)

**Konum:** `ArtifactsPage.tsx` ~2643–2725 (`detailDrawerEditing`).

**Durum:** Artifact düzenlerken Title, Description, Assignee alanları doğrudan `TextField` / `FormControl` + `Select` ile yazılmış.

**İhlal:** Artifact edit formu, create’te olduğu gibi **form schema** ile sürülmeli. Backend’de `entityType=artifact`, `context=edit` desteği varsa kullanılmalı; yoksa eklenmeli ve frontend `MetadataDrivenForm` ile tekilleştirilmeli.

---

## 4. Task create / edit formları

**Konum:** `ArtifactsPage.tsx` ~2264–2333 (Add task), ~2335–2408 (Edit task).

**Durum:** Task ekleme ve düzenleme dialog’ları tamamen hardcoded: Title (TextField), State (Select: todo / in_progress / done), Assignee (Select).

**Backend:** `get_form_schema` ve `manifest_form_schema_builder` içinde `entity_type="task"`, `context in ("create", "edit")` ile task form schema üretiliyor.

**İhlal:** Task formları da metadata-driven olmalı; backend schema’ya rağmen frontend’de sabit form kullanılması ihlal.

**Öneri:**

- `useFormSchema(orgSlug, projectId, "task", "create")` ve `useFormSchema(..., "task", "edit")` çağrılmalı.
- Add task dialog’unda `MetadataDrivenForm` + task create schema.
- Edit task dialog’unda `MetadataDrivenForm` + task edit schema + mevcut task değerleri.

---

## 5. State transition dialog (State reason / Resolution)

**Konum:** `ArtifactsPage.tsx` ~2025–2055.

**Durum:** State reason ve Resolution için Select’ler sabit kodda; seçenekler `transitionOptions` ile geliyor (muhtemelen API’den).

**İhlal:** Hafif. Workflow/transition metadata tek kaynak kabul edilirse, bu alanlar da manifest/API metadata’ya bağlanabilir; şu an tam “manifest’ten türetilmiş form” değil.

---

## 6. Detay drawer – Planning (Cycle / Area)

**Konum:** `ArtifactsPage.tsx` ~2771–2825.

**Durum:** Cycle ve Area için iki ayrı `FormControl` + `Select` hardcoded; seçenekler `cycleNodesFlat` / `areaNodesFlat` ile dolduruluyor.

**İhlal:** CONTEXTS_AND_PROGRESSION’a göre planning “Manifest veya ayrı planning config; alan/iterasyon path metadata” ile yönetilebilir. Form schema’da bu alanlar tanımlıysa aynı ekranda metadata-driven (MetadataDrivenForm veya schema’dan gelen alanlar) yapılması tutarlı olur.

---

## İhlal olmayan / farklı bağlam

- **Artifact create dialog:** `MetadataDrivenForm` + `useFormSchema(..., "artifact", "create")` kullanılıyor — uyumlu.
- **Manifest sayfası (preview):** `MetadataDrivenForm` + `buildPreviewSchemaFromManifest` — uyumlu.
- **Table view (listSchema varken):** `MetadataDrivenList` + `useListSchema` — uyumlu.
- Auth, tenant, project, settings (CreateUser, InviteMember, CreateProject, Role, vb.): Bunlar Tenant/Project/Admin context; dokümandaki “meta-metadata driven” hedefi öncelikle **Process / Artifact / Task** için. İsteğe bağlı olarak ileride metadata’ya alınabilir, şu an net ihlal sayılmadı.

---

## Yapılacaklar (öncelik sırasıyla)

1. **Task create/edit:** Task form schema API’yi kullan, Add/Edit task dialog’larını `MetadataDrivenForm` ile değiştir.
2. **Artifact edit (drawer):** Edit context form schema (backend’de varsa/eklenirse) + `MetadataDrivenForm` ile drawer edit formunu tekilleştir.
3. **Liste filtreleri:** Toolbar’daki State/Type (ve mümkünse Cycle/Area) filtrelerini list schema’dan türet; tekrarlanan filtre UI’ı kaldır veya schema ile senkronize et.
4. **Table fallback:** `listSchema` yokken sabit tablo yerine loading/mesaj göster veya fallback’i kaldır.
5. **Transition dialog / Planning alanları:** İsteğe bağlı olarak workflow ve form schema ile metadata-driven yap.

Bu doküman `alm-app/frontend/docs/METADATA_DRIVEN_VIOLATIONS.md` olarak kaydedildi; ihlalleri gidermek için yukarıdaki adımlar uygulanabilir.
