# Quality suite

## Amaç

Proje içinde kalite çalışması için ayrı giriş noktaları:

| Route | Açıklama |
|-------|----------|
| `/:orgSlug/:projectSlug/quality` | Hub + artifact listesi (Artifacts ile aynı API) |
| `/:orgSlug/:projectSlug/quality/tests` | `test-case` tipi filtresi (`?type=test-case` + `tree=quality`) |
| `/:orgSlug/:projectSlug/quality/suites` | `test-suite` |
| `/:orgSlug/:projectSlug/quality/runs` | `test-run` |
| `/:orgSlug/:projectSlug/quality/campaigns` | `test-campaign` |
| `/:orgSlug/:projectSlug/quality/traceability` | Quality ağacı; sayfalama + arama; detayda link yönetimi |

Liste ve API **Artifacts ile aynıdır**; varsayılan olarak manifest’te tanımlı **`tree_id: "quality"`** ağacına filtre uygulanır (ağaç yoksa otomatik yazılmaz).

## Davranış

- **İzin:** `artifact:read` (Artifacts / Board ile aynı).
- **Artifacts listesi:** Varsayılan ağaç filtresi **Requirements** (`tree=requirement`); quality ağacındaki test case’ler burada görünmez. Hepsini görmek için filtrede **All trees** (`?tree=all`).
- **Varsayılan ağaç:** `tree_roots` içinde `tree_id` **quality** yoksa otomatik `tree=quality` yazılmaz.
- **Breadcrumb:** Quality sayfasında "Quality"; traceability’de "Traceability".
- **Hub (Faz 2B):** Üstte özet; Quality ağacı tanımlıysa `useArtifacts` ile `limit=1` sorgusundan gelen **toplam sayı** gösterilir (ayrı aggregate endpoint yok).
- **Traceability:** API proje genelinde link listesi sunmaz; linkler artifact başına. Sayfa Quality ağacını **sayfalar** (`limit`/`offset`, URL `?page=`); **arama** `?q=` ile `Artifacts` ile aynı parametre. **Details** ile `?artifact=` üzerinden detay çekmecesinde linkler düzenlenir.

## Kod

- URL yardımcıları: [frontend/src/shared/utils/appPaths.ts](../frontend/src/shared/utils/appPaths.ts) — `qualityPath`, `qualityTraceabilityPath` (birim test: `appPaths.test.ts`).
- Route: [frontend/src/app/router.tsx](../frontend/src/app/router.tsx) — `QualityPage`, `QualityTraceabilityPage` lazy; `quality/traceability` route’u `quality`’den önce tanımlıdır.
- Hub: [frontend/src/features/quality/pages/QualityPage.tsx](../frontend/src/features/quality/pages/QualityPage.tsx), [QualityHubHeader.tsx](../frontend/src/features/quality/components/QualityHubHeader.tsx).
- Tip sayfaları: [QualityArtifactsByTypePage.tsx](../frontend/src/features/quality/pages/QualityArtifactsByTypePage.tsx) + `QualityTestsPage` / `QualitySuitesPage` / `QualityRunsPage` / `QualityCampaignsPage`.
- Liste: [ArtifactsPage.tsx](../frontend/src/features/artifacts/pages/ArtifactsPage.tsx) — `variant="quality"`.
- Traceability: [QualityTraceabilityPage.tsx](../frontend/src/features/quality/pages/QualityTraceabilityPage.tsx).

## Prototip eşlemesi (Metadatadriventestmanagement)

Kalite testleri / suite / run / campaign / klasör kavramları tek **artifact motoru** ve manifest ile modellenir. Tablo ve kararlar: [QUALITY_DOMAIN_MANIFEST_MAP.md](./QUALITY_DOMAIN_MANIFEST_MAP.md). API özeti: [QUALITY_API_NOTES.md](./QUALITY_API_NOTES.md).

**Repo notu:** `Metadatadriventestmanagement/.git` iç içe repo oluşturabilir; kök `.gitignore` ile yok sayılabilir veya ayrı submodule olarak yönetilir.

## Manifest: Quality ağacı ve link tipleri

`tree_roots` içinde `tree_id: quality` ve `root_artifact_type` (ör. `root-quality`) tanımlı olmalı. Varsayılanlar: [manifestTreeRoots.ts](../frontend/src/shared/lib/manifestTreeRoots.ts).

Yerleşik süreç şablonlarında (Basic, Scrum, Kanban, Azure DevOps Basic) `root-quality` altında **`quality-folder`**, **`test-case`**, **`test-suite`**, **`test-run`**, **`test-campaign`** türleri ve ilişki link tipleri seed ile enjekte edilir — [seed.py](../backend/src/alm/config/seed.py) (`_with_quality_manifest_bundle`). Demo kurulum iki örnek test case, örnek requirement’a **`verifies`**, ayrıca demo suite / run / campaign ve `suite_includes_test` / `run_for_suite` / `campaign_includes_suite` linkleri ekler.

**Örnek** (`defs` içinde LinkType satırları flat yanıtta `link_types` olur; ayrıntı [manifest-schema.md](./manifest-schema.md) — Link types):

```yaml
# Özet — tam manifest şablonu proje ihtiyacına göre
tree_roots:
  - tree_id: quality
    root_artifact_type: root-quality
    label: Quality

# defs veya flat manifest içinde örnek link tipleri (id'ler API'de link_type olarak kullanılır):
# - id: validates
#   kind: LinkType
#   name: Validates
# - id: verified_by
#   kind: LinkType
#   name: Verified by
```

Kaliteye özel liste kolonları: [MANIFEST_METADATA_MASTER_PLAN.md](../../docs/MANIFEST_METADATA_MASTER_PLAN.md) ve `artifact_list.columns`.

İsteğe bağlı — manifest kökünde liste şemasını daraltmak (örnek; proje ihtiyacına göre uyarlayın):

```yaml
artifact_list:
  columns:
    - { key: artifact_key, label: Key, order: 1, sortable: true }
    - { key: artifact_type, label: Type, order: 2, sortable: true }
    - { key: title, label: Title, order: 3, sortable: true }
    - { key: state, label: State, order: 4, sortable: true }
    - { key: updated_at, label: Updated, order: 5, sortable: true }
```

## Testler (birim + API)

- Frontend (Vitest): [manifestTreeRoots.test.ts](../frontend/src/shared/lib/manifestTreeRoots.test.ts) (`getTreeRootsFromManifestBundle`, varsayılan `quality` ağacı), [appPaths.test.ts](../frontend/src/shared/utils/appPaths.test.ts) (`qualityPath` / `qualityTraceabilityPath`); [artifactApi.test.ts](../frontend/src/shared/api/artifactApi.test.ts) içinde `buildArtifactListParams` + `tree`.
- Backend (pytest): [test_artifact_flow.py](../backend/tests/test_artifact_flow.py) — `test_list_artifacts_tree_quality_param_ok` (`GET .../artifacts?tree=quality`).

## E2E

- Genel Playwright notları: [frontend/e2e/README.md](../frontend/e2e/README.md).
- [frontend/e2e/quality-suite.spec.ts](../frontend/e2e/quality-suite.spec.ts) — Quality hub ve Traceability dolaşımı (`playwright` project: `quality-suite`; `setup` projesi bağımlılık olarak önce çalışır, `e2e/.auth/user.json` üretir).
- **Önkoşul:** Backend çalışıyor olmalı (Vite `/api` proxy’si → API; `auth.setup` gerçek giriş yapar).
- **Çalıştırma:** `alm-app/frontend` içinde `npm run test:e2e:quality`. Varsayılan `http://localhost:5173` iken Playwright gerekirse Vite’yi başlatır (`webServer`). Vite’yi yalnızca siz açacaksanız mevcut süreç kullanılır (`reuseExistingServer`). Başka origin: `PLAYWRIGHT_BASE_URL=...`; Vite’yi Playwright’un başlatmasını istemiyorsanız: `PLAYWRIGHT_SKIP_WEBSERVER=1`.

## Faz 2C (isteğe bağlı)

Proje kapsamlı `GET .../quality/stats` gibi bir aggregate **şu an uygulanmadı**; hub sayısı mevcut liste API `total` alanı ile yeterli.
