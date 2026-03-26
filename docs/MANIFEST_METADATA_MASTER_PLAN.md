# Manifest / Metadata — Bütünleşik Plan (Master Plan)

Bu dosya **repo kökünde** `docs/` altındadır (`entities-and-fields.csv` ile aynı klasör). Uygulama kodu ve ayrıntılı indeks: [alm-app/docs/README.md](../alm-app/docs/README.md).

Bu doküman; **manifest DSL**, **metadata-driven** ve **meta-metadata** hedefi doğrultusunda yapılanları, kalan boşlukları ve tüm context’ler için sıralı yol haritasını tek yerde toplar. Ayrıntılı görev listesi için [REMAINING_PLAN.md](../alm-app/docs/REMAINING_PLAN.md); bağlam hiyerarşisi için [CONTEXTS_AND_PROGRESSION.md](../alm-app/docs/CONTEXTS_AND_PROGRESSION.md); şema alanları için [manifest-schema.md](../alm-app/docs/manifest-schema.md) kullanılır.

---

## 1. Vizyon (tek cümle)

Süreç davranışı, ağaç görünümleri, task state’leri, çözüm (resolution) kuralları, kök politikaları, ikonlar ve planning/liste meta-metadata **manifest ve metadata** ile tanımlanır; uygulama kodu çoğunlukla motor, API ve güvenlik katmanında kalır. Stratejik hedef: kalan sabit listelerin kalkması ve manifest sürüm/snapshot yönetimi (M6).

---

## 2. Yakın zamanda tamamlananlar (metadata sıkılaştırması)

| Alan | Ne yapıldı |
|------|------------|
| **Task** | `task_workflow_id` + `defs` içindeki `Workflow` ile form/list state seçenekleri; create/update’te state doğrulama; seed’de `task_basic`. |
| **Tree filtresi** | Manifest `tree_roots` + API’de çözüm; frontend’de dinamik ağaç seçici; URL `tree=` doğrulaması manifest’e göre. |
| **Resolution** | Workflow `resolution_target_states`; yoksa `category: completed` / legacy state isimleri; transition + UI (Artifacts geçiş formu) hizası. |
| **Flat manifest** | `manifest_defs_to_flat` → `resolution_target_states` düz `workflows`’a taşınır (GET manifest yanıtı). |
| **Meta-metadata (genişletme)** | `system_roots` / defs `is_system_root`; `artifact_list.columns`; `planning.cycle_for_types` & `area_for_types`; `burndown_done_states`; `search_locale`; `artifact_types[].icon`; `merge_manifest_metadata_defaults`; Alembic `035_merge_manifest_metadata_defaults` (süreç şablon sürümlerinde birleşik varsayılanlar). |

**Not:** Eski projelerde DB’deki `manifest_bundle` bu yeni kök alanları içermeyebilir; kod **varsayılanlarla** geriye dönük uyumludur.

---

## 3. Metadata durumu (güncel)

Alan sözlüğü ve semantik için önce **[manifest-schema.md](../alm-app/docs/manifest-schema.md)** kullanılır; bu bölüm yönetim özeti verir.

### Kodda karşılananlar (önceki P1 / P2 maddelerinin çoğu)

| Konu | Yer / davranış |
|------|----------------|
| Liste kolon sırası, görünürlük, sıralanabilirlik | `artifact_list.columns` → `get_list_schema` |
| CSV | `downloadArtifactsCsv` — list şeması kolonları varsa onları kullanır; `custom_fields` hücre anahtarları ile uyumlu |
| Artifact ikon | Manifest’te tip `icon` (Lucide anahtarı); `getArtifactIcon` + fallback haritası |
| Planning (edit form) | `planning.cycle_for_types` / `area_for_types` → form şemada cycle/area alanı tip bazlı |
| FTS dili | Manifest `search_locale` (allowlist) veya sunucu varsayılanı |
| System kök tipler | `resolve_system_root_artifact_types` — liste sayımı, oluşturma kuralları; org dashboard artifact toplamı proje manifest’i başına (`get_org_dashboard_stats`) |
| Ağaç kök sırası | `buildArtifactTree` — `tree_roots` sırasına göre üst düzey kök sıralaması |
| Burndown “done” | `burndown_done_states` → `get_burndown` |

### Hâlâ açık veya kısmi (öncelik sırası)

**P0 — tutarlılık ve veri**

| # | Konu | Durum / aksiyon |
|---|------|-----------------|
| 1 | **Backfill ve operasyon** | `035_merge_manifest_metadata_defaults` mevcut; üretim/demoda **runbook** (ne zaman çalıştırılır, org şablon istisnaları) ve gerekiyorsa ek job netleştirilmeli. |

**P1 — ürün (artık “yeni alan ekle” değil, derinlik)**

- Board / backlog / filtrelerin planning ve liste metadata ile **tam** hizası (M3/M5 ile örtüşür).
- `link_types` için UI etiketi, yön, cardinality manifest’te var; **izinler ve oluşturma akışı** (M4) gözden geçirilebilir.

**P2 — küçük borçlar**

| # | Konu | Durum |
|---|------|--------|
| 8 | `create_project` varsayılan şablon `basic` | Org bazlı varsayılan veya manifest referansı — açık. |
| 9 | Dashboard `type=task` | `task_workflow_id` ile kısmen ele alındı; UX ince ayarı gerekebilir. |

---

## 4. Context bazlı yol haritası (hepsi — sıralı)

CONTEXTS_AND_PROGRESSION’daki adımlar + mevcut kod durumu ile hizalı **önerilen sıra**:

### Faz M0 — Process (Manifest DSL) sağlamlaştırma

- Manifest tek kaynak: zaten UI + kaynak; şema doğrulama, conformance, versiyon notları.
- **Çıktı:** Yeni opsiyonel alanlar için kurallar dokümante (`manifest-schema.md`) ve birim testlerle kısmen doğrulanıyor. İstenirse tek “tam bundle” JSON Schema paketi genişletilebilir.

### Faz M1 — Artifact meta-metadata derinliği

- Custom kolonlar (mevcut) + `artifact_list.columns` ile çekirdek kolonların sırası/görünürlüğü.
- Form: zaten `fields` + `visibleWhen` / `requiredWhen`.
- **Çıktı:** Liste ve CSV, list şeması ile hizalanabilir (uygulamada büyük ölçüde karşılandı).

### Faz M2 — Task (tamamlanmış çekirdek + genişleme)

- Çekirdek: manifest-driven state ✓.
- **Sonraki:** İsteğe bağlı task alanları (`fields` benzeri task metadata), task transition kuralları (basit workflow motoru veya manifest edge).

### Faz M3 — Planning metadata

- Cycle/area hangi tipte formda görünsün → `planning` kök bölümü (form tarafı ✓).
- **Kalan:** Board / backlog filtreleri ve ürün akışının bu metadata ile tam hizası.

### Faz M4 — Traceability

- `link_types` genişletme: yön, cardinality, UI etiketi, izinler.
- Link oluşturma UI’si manifest’e göre seçenekler.

### Faz M5 — Board & raporlar

- Kolonlar = workflow states (mevcut); grup alanları metadata’dan (kısmen).
- Done/burndown: `burndown_done_states` ile manifest’ten (uygulamada mevcut).

### Faz M6 — Manifest versiyonlama (stratejik)

- Artifact oluşturulduğu andaki workflow snapshot vs. her zaman güncel manifest (breaking change yönetimi).

---

## 5. Öncelik özeti (uygulama sırası)

1. **P0-1** — backfill sonrası **runbook** ve istisna senaryoları dokümante etmek.  
2. **M3/M5** — board, backlog ve raporların planning + liste metadata ile tam hizası.  
3. **M4** — traceability: izinler ve link oluşturma UX’inin manifest ile tutarlılığı.  
4. **P2-8, P2-9** — org varsayılan şablon, dashboard task bağlantısı ince ayarı.  
5. **M6** — manifest / workflow snapshot stratejisi (büyük projeler).

*(İkon, list kolonları, CSV, planning form, FTS locale, burndown done, ağaç sırası, org dashboard kök hariç sayım §3 “karşılananlar” kapsamında.)*

---

## 6. Tamamlanma kriterleri (özet)

- Yeni artifact tipi / task state / ağaç görünümü: **çoğunlukla** yalnızca manifest güncellemesi (ikon, liste kolonları, planning görünürlüğü, burndown done, arama dili dahil). **Tam** “yalnızca manifest” hedefi için M4–M6 ve kalan ürün hizaları kapanmalı.
- Backend ve frontend aynı manifest alanlarını okur; `ROOT_ARTIFACT_TYPES` yalnızca varsayılan sistem kök kümesinin stabil tuple görünümüdür.
- Conformance + test: yeni manifest alanları için unit + en az bir entegrasyon senaryosu.

---

## 7. İlgili dosyalar (referans)

Yollar `alm-app/` altına göredir.

| Konu | Kod / doküman |
|------|----------------|
| Task / tree / resolution / system roots / burndown | `alm-app/backend/src/alm/artifact/domain/manifest_workflow_metadata.py` |
| Varsayılan birleştirme | `alm-app/backend/src/alm/artifact/domain/manifest_merge_defaults.py` |
| Liste şeması + `artifact_list` | `alm-app/backend/src/alm/form_schema/application/queries/get_list_schema.py` |
| FTS `search_locale` | `alm-app/backend/src/alm/artifact/domain/fulltext_config.py` |
| Burndown sorgusu | `alm-app/backend/src/alm/project/application/queries/get_burndown.py` |
| Org dashboard artifact sayımı | `alm-app/backend/src/alm/project/application/queries/get_org_dashboard_stats.py` |
| Workflow transition actions (MPC uyumu) | `alm-app/backend/src/alm/artifact/domain/workflow_sm.py` (`get_transition_actions`) |
| Varsayılan kök tuple (test/SQL) | `alm-app/backend/src/alm/artifact/domain/constants.py` |
| Seed örnekleri | `alm-app/backend/src/alm/config/seed.py` |
| Frontend ağaç / CSV / ikon / tree sırası | `alm-app/frontend/src/shared/lib/manifestTreeRoots.ts`, `alm-app/frontend/src/features/artifacts/utils.tsx` |
| Şema dokümantasyonu | [manifest-schema.md](../alm-app/docs/manifest-schema.md) |

---

— ↑ [ALM uygulama doküman indeksi](../alm-app/docs/README.md)
