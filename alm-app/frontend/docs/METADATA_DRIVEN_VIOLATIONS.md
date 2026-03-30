# Manifest DSL / metadata-driven uyum (Frontend + ilgili backend)

**Hedef:** Süreç ve iş öğesi formları mümkün olduğunca manifest / API şemasından (`form-schema`, `list-schema`) üretilsin; sayfada tekrarlanan sabit form alanı kalmasın.

**Son güncelleme:** Kod tabanıyla hizalı durum özeti aşağıdadır (otomatik denetim için bu dosyayı ve `MetadataDrivenForm` / `ArtifactsToolbar` kaynaklarını kullanın).

---

## Uyumlu / tamamlanan

| Alan | Durum |
|------|--------|
| Artifact create | `CreateArtifactModal` + `useFormSchema(..., "artifact", "create")` + `MetadataDrivenForm` |
| Artifact edit (drawer) | `useFormSchema(..., "artifact", "edit", artifactType)` + `MetadataDrivenForm`; proje etiketleri şemada `tag_list` (`tag_ids`) + `projectTagOptions` |
| Task create | `useFormSchema(..., "task", "create")` + `AddTaskModal` / `MetadataDrivenForm` |
| Task edit | `useFormSchema(..., "task", "edit")` + `EditTaskModal` (backend create/edit için aynı builder; ayrı context ile sorgu) |
| Tablo görünümü | `listSchema` yokken sabit kolonlu tablo yok; yükleme / hata / bilgi mesajı |
| Tablo + kolonlar | `MetadataDrivenList` + `useListSchema` (`entity_type=artifact`) |
| Transition (tekil) | Modal içinde `MetadataDrivenForm`; alanlar manifest workflow `state_reason_options` / `resolution_options` ile client’ta şemaya dönüştürülüyor |
| Bulk transition | Aynı yaklaşım + `BulkTransitionModal` |
| Manifest önizleme | `buildPreviewSchemaFromManifest` + `MetadataDrivenForm` |

---

## Kalan sapmalar (bilinçli borç veya ileri iş)

### 1. Artifacts toolbar filtreleri (`ArtifactsToolbar.tsx`)

Üst bölümde arama, kayıtlı sorgu, cycle, area, tag, state, type, sıralama, silinenleri göster vb. **hâlâ sayfada sabit tanımlı** (`ToolbarFilterValues` + RHF bileşenleri).

Backend `get_list_schema` yalnızca **`state`** ve **`type`** filtresini şemaya koyuyor; cycle / area / tag / sort / free-text search şemada yok. Toolbar’ı tamamen `listSchema.filters` (ve gerekirse genişletilmiş liste-metadata) ile üretmek **ayrı bir mimari iş** (API + UI).

### 2. Tablo içi filtre satırı

`MetadataDrivenList` kullanılırken `hideFilters={true}`; state/type senkronu toolbar ile yapılıyor. Liste ve toolbar **çift kaynak** riski (şimdilik elle senkronize).

### 3. Transition — resolution görünürlüğü

`resolution_target_states` yoksa hedef state `resolved` / `closed` / `done` için **sabit fallback** kullanılıyor (`ArtifactsPage`).

### 4. `MetadataDrivenForm` özel dalları

- `field.key === "test_steps_json"` → `TestStepsEditor`
- `field.key === "description"` veya `input_mode` → `DescriptionField`
- `cycle_node_id` / `area_node_id` için ek `field.key` kontrolleri  
Bunlar **render motoru** parçası; tamamen manifest-generic değil.

### 5. Task / artifact kaydetme payload’ları

Şemadan gelen alanların bir kısmı submit sırasında **sabit property adlarıyla** API DTO’suna map’leniyor. Yeni çekirdek alanlar için hem şema hem bu map güncellenmeli.

### 6. `QualityDefectsPage`

Özel triage listesi: filtreler `Input` + URL; `useListSchema` / `MetadataDrivenList` kullanılmıyor. İstenirse ileride artifact list şeması veya ayrı `entity_type` ile hizalanabilir.

### 7. Tenant / admin formları

Proje dışı ekranlar (üye, rol, proje oluşturma vb.) bu dokümanın kapsamı dışında tutulabilir.

---

## Backend notları

- **Form şeması:** `manifest_form_schema_builder` — çekirdek alanlar kodda, manifest `fields` ile özel alanlar birleşir. Artifact edit’te `tag_ids` (`tag_list`) çekirdek alanlardandır.
- **Liste şeması:** `get_list_schema` — varsayılan kolon seti Python’da; `artifact_list.columns` manifest ile override edilebilir.

---

## İleride yapılabilecekler (öncelik önerisi)

1. Liste API’sine toolbar ihtiyaçlarını taşıyacak şekilde **filtre / sıralama metadata** genişletmesi; `ArtifactsToolbar`’ı şemadan üretmek.
2. Transition resolution visibility’yi tamamen workflow metadata’ya bağlamak (fallback’i kaldırmak veya manifest’e taşımak).
3. Submit mapper’ları şema yansımasından türetmek veya paylaşılan bir “çekirdek anahtar” listesi ile tekilleştirmek (backend ile contract).
