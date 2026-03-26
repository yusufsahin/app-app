# Artifact governance (repo contracts)

Bu doküman, **Artifact-Native Python+CI Risk Gate** planındaki normatif veri sözleşmelerinin uygulanabilir özetidir. Tek kaynak YAML dosyaları `backend/alm_meta/` altındadır.

İlgili: `docs/ARTIFACT_INVENTORY.md`, `docs/TEST_METADATA_STANDARD.md`, `docs/THREE_TIER_GATES.md`.

## Dosyalar

| Dosya | Amaç |
|--------|------|
| `backend/alm_meta/artifact_catalog.yaml` | Artifact envanteri: `artifact_id`, `artifact_type`, `owner`, `criticality`, `version_policy` |
| `backend/alm_meta/change_manifest.yaml` | Değişim seti: `change_set_id`, `change_type`, `affected_artifacts`, `risk_inputs` |
| `backend/alm_meta/test_manifest.yaml` | Test tanımları: `test_id`, `suite_type`, `artifact_refs`, `criticality`, `automation`, pytest eşlemesi |
| `backend/alm_meta/traceability_graph.yaml` | İsteğe bağlı statik link grafı (CI doğrulaması) |
| `backend/alm_meta/flaky_quarantine.yaml` | Release tier için quarantine listesi |
| `artifacts/*.json` | CI çıktıları (gitignore önerilir) |

## test_manifest (otomasyon)

`automation: true` ise zorunlu:

- `pytest_node_id`
- `pytest_classname` ve `pytest_test_name` (birlikte)

## Gate tier

- **pr**: Etkilenen artifact’lara göre dar suite seçimi (hızlı PR geri bildirimi).
- **nightly**: `compat` + `negative` dahil genişletilmiş seçim.
- **release**: Tüm gerekli suite’ler + `regression`; quarantine ile kritik çakışma kontrolü.

Ortam değişkeni: `GATE_TIER` (`pr` \| `nightly` \| `release`). Varsayılan: `pr`.

## Scriptler

- `scripts/validate_metadata.py` — Şema + isteğe bağlı traceability grafı
- `scripts/compute_risk.py` — Risk skoru
- `scripts/select_tests.py` — Tier’a göre suite/test seçimi
- `scripts/derive_execution_report.py` — JUnit → execution raporu
- `scripts/run_gates.py` — Gate kararı
- `scripts/publish_gate_report.py` — Birleşik `gate-report.json`
- `scripts/flaky_quarantine_check.py` — Release tier quarantine
- `scripts/report.py` — KPI özet çıktısı
- `scripts/risk_gate.py` — Zincir: `--phase preflight` (validate + risk + select + flaky_quarantine) veya `--phase posttest` (derive + run_gates + publish + report + kpi_threshold_check)
- `scripts/export_traceability_graph.py` — `artifact_links` + `artifacts.custom_fields.governance_artifact_id` → YAML (inceleme sonrası `traceability_graph.yaml` ile birleştirilir)

## artifact_link (ürün içi)

Çalışan uygulamada traceability için birincil kaynak `artifact_links` API/modelidir; CI’da graf doğrulaması için `traceability_graph.yaml` senkron tutulabilir veya export edilebilir.

**Export eşlemesi:** Uç artifact kayıtlarında `custom_fields.governance_artifact_id` değeri, `artifact_catalog.yaml` içindeki `artifact_id` ile aynı olmalıdır (aksi halde satır atlanır). `settings.seed_demo_data` açıkken demo kurulumu, örnek `artifact_link` satırları ve bu alanlarla doldurulmuş üç governance-anchor kaydı oluşturur (`seed_demo_data`).
