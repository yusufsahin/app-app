# Quality & Campaign (kalite ve kampanya çalışma alanı)

## Amaç

Proje içinde kalite çalışması için ayrı giriş noktaları:

**Test case parametreleri (`test_params_json`, adımlarda `${name}`):** [QUALITY_TEST_PARAMS_USER_GUIDE.md](./QUALITY_TEST_PARAMS_USER_GUIDE.md)

| Route | Açıklama |
|-------|----------|
| `/:orgSlug/:projectSlug/quality` | Hub + artifact listesi (Artifacts ile aynı API) |
| `/:orgSlug/:projectSlug/quality/catalog` | **Catalog** — test case’ler (`tree_id: quality`, `quality-folder` grupları) |
| `/:orgSlug/:projectSlug/quality/campaign` | **Campaign** — `test-suite` (collections = `testsuite-folder`) |
| `/:orgSlug/:projectSlug/quality/runs` | `test-run` |
| `/:orgSlug/:projectSlug/quality/campaigns` | `test-campaign` |
| `/:orgSlug/:projectSlug/quality/traceability` | Quality ağacı; sayfalama + arama; detayda link yönetimi |

Liste ve API **Artifacts ile aynıdır**; kalite altındaki sayfalar manifest ağaçlarına filtre uygular: **`quality`** (**Catalog** — `root-quality`, test-case + grup klasörleri) ve **`testsuites`** (**Campaign** — koleksiyonlar + suite/run/`test-campaign`). (Bazı şablonlarda ayrıca `tests` / `root-tests` ağacı da tanımlanabilir.)

## Davranış

- **İzin:** `artifact:read` (Artifacts / Board ile aynı).
- **Artifacts listesi:** Varsayılan ağaç filtresi **Requirements** (`tree=requirement`); kalite öğeleri ilgili ağaçlarda (`quality`, `testsuites`, isteğe bağlı `tests`) tutulur. Hepsini görmek için filtrede **All trees** (`?tree=all`).
- **Varsayılan ağaç:** `tree_roots` içinde ilgili ağaç (`quality` / `testsuites` / …) yoksa sayfa bu ağaca filtre uygulamaz.
- **Breadcrumb:** Quality sayfasında "Quality"; traceability’de "Traceability".
- **Hub (Faz 2B):** Üstte özet; Quality ağacı tanımlıysa `useArtifacts` ile `limit=1` sorgusundan gelen **toplam sayı** gösterilir (ayrı aggregate endpoint yok).
- **Traceability:** API proje genelinde link listesi sunmaz; linkler artifact başına. Sayfa Quality ağacını **sayfalar** (`limit`/`offset`, URL `?page=`); **arama** `?q=` ile `Artifacts` ile aynı parametre. **Details** ile `?artifact=` üzerinden detay çekmecesinde linkler düzenlenir.

## Kod

- URL yardımcıları: [frontend/src/shared/utils/appPaths.ts](../frontend/src/shared/utils/appPaths.ts) — `qualityPath`, `qualityCampaignPath`, `qualityTraceabilityPath` (birim test: `appPaths.test.ts`).
- Route: [frontend/src/app/router.tsx](../frontend/src/app/router.tsx) — `QualityPage`, `QualityTraceabilityPage` lazy; `quality/traceability` route’u `quality`’den önce tanımlıdır.
- Hub: [frontend/src/features/quality/pages/QualityPage.tsx](../frontend/src/features/quality/pages/QualityPage.tsx), [QualityHubHeader.tsx](../frontend/src/features/quality/components/QualityHubHeader.tsx).
- Tip sayfaları: `QualityCatalogPage` / `QualityCampaignPage` / `QualityRunsPage` / `QualityCampaignsPage` ([frontend/src/features/quality/pages](../frontend/src/features/quality/pages)).
- Liste: [ArtifactsPage.tsx](../frontend/src/features/artifacts/pages/ArtifactsPage.tsx) — `variant="quality"`.
- Traceability: [QualityTraceabilityPage.tsx](../frontend/src/features/quality/pages/QualityTraceabilityPage.tsx).

## Prototip eşlemesi (Metadatadriventestmanagement)

Kalite testleri / suite / run / campaign / klasör kavramları tek **artifact motoru** ve manifest ile modellenir. Tablo ve kararlar: [QUALITY_DOMAIN_MANIFEST_MAP.md](./QUALITY_DOMAIN_MANIFEST_MAP.md). API özeti: [QUALITY_API_NOTES.md](./QUALITY_API_NOTES.md).

**Repo notu:** `Metadatadriventestmanagement/.git` iç içe repo oluşturabilir; kök `.gitignore` ile yok sayılabilir veya ayrı submodule olarak yönetilir.

## Manifest: Tests / Campaign (`testsuites`) ağaçları ve link tipleri

`tree_roots` içinde `tree_id: tests` + `root-tests` ve `tree_id: testsuites` + `root-testsuites` tanımlı olmalı. Varsayılanlar: [manifestTreeRoots.ts](../frontend/src/shared/lib/manifestTreeRoots.ts).

Yerleşik süreç şablonlarında (Basic, Scrum, Kanban, Azure DevOps Basic) ayrıştırılmış türler seed ile enjekte edilir: `test-folder` + `test-case` (tests ağacı) ve **`testsuite-folder` (koleksiyon)** + `test-suite` / `test-run` / `test-campaign` — manifest’te `tree_id: testsuites`, UI’da **Campaign**. Demo kurulum örnek test case’ler, suite/run/campaign ve `suite_includes_test` / `run_for_suite` / `campaign_includes_suite` linklerini içerir.

**Örnek** (`defs` içinde LinkType satırları flat yanıtta `link_types` olur; ayrıntı [manifest-schema.md](./manifest-schema.md) — Link types):

```yaml
# Özet — tam manifest şablonu proje ihtiyacına göre
tree_roots:
  - tree_id: tests
    root_artifact_type: root-tests
    label: Tests
  - tree_id: testsuites
    root_artifact_type: root-testsuites
    label: Campaign

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

- Frontend (Vitest): [manifestTreeRoots.test.ts](../frontend/src/shared/lib/manifestTreeRoots.test.ts) (`getTreeRootsFromManifestBundle`, varsayılan `tests` + `testsuites` ağaçları), [appPaths.test.ts](../frontend/src/shared/utils/appPaths.test.ts) (`qualityPath` / `qualityTraceabilityPath`); [artifactApi.test.ts](../frontend/src/shared/api/artifactApi.test.ts) içinde `buildArtifactListParams` + `tree`.
- Backend (pytest): [test_artifact_flow.py](../backend/tests/test_artifact_flow.py) — `test_list_artifacts_tree_tests_param_ok` (`GET .../artifacts?tree=tests`) ve `...tree=testsuites`.

## E2E

- Genel Playwright notları: [frontend/e2e/README.md](../frontend/e2e/README.md).
- [frontend/e2e/quality-campaign.spec.ts](../frontend/e2e/quality-campaign.spec.ts) — Campaign workspace, koleksiyonlar, Traceability (`playwright` project: `quality-campaign`; `setup` bağımlılığı, `e2e/.auth/user.json`).
- **Önkoşul:** Backend çalışıyor olmalı (Vite `/api` proxy’si → API; `auth.setup` gerçek giriş yapar).
- **Çalıştırma:** `alm-app/frontend` içinde `npm run test:e2e:quality`. Varsayılan `http://localhost:5173` iken Playwright gerekirse Vite’yi başlatır (`webServer`). Vite’yi yalnızca siz açacaksanız mevcut süreç kullanılır (`reuseExistingServer`). Başka origin: `PLAYWRIGHT_BASE_URL=...`; Vite’yi Playwright’un başlatmasını istemiyorsanız: `PLAYWRIGHT_SKIP_WEBSERVER=1`.

## Faz 2C (isteğe bağlı)

Proje kapsamlı `GET .../quality/stats` gibi bir aggregate **şu an uygulanmadı**; hub sayısı mevcut liste API `total` alanı ile yeterli.
