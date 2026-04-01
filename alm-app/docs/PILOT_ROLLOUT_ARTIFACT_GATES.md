# Pilot ve yaygınlaştırma — Artifact-native gate

## Pilot (önerilen 2 sprint)

**Baseline şablonu:** `docs/BASELINE_METRICS_TEMPLATE.md`

**Hedef domain:** Tek ürün hattı (ör. cycle / manifest şeması).

### Hafta 1–2 checklist

- [x] `alm_meta/artifact_catalog.yaml` pilot artifact’leriyle dolduruldu — cycle + manifest + baseline + örnek manifest satırları mevcut.
- [x] `change_manifest.yaml` her anlamlı PR’da güncelleniyor (veya otomasyonla üretiliyor) — PR şablonu zorunlu checklist; canonical dosya `backend/alm_meta/change_manifest.yaml`.
- [x] `test_manifest.yaml` içinde `pytest_classname` + `pytest_test_name` doğrulandı — CI `validate_metadata.py` ile zorunlu.
- [x] `traceability_graph.yaml` pilot için relationship verisiyle uyumlu (veya export script’i yazıldı) — statik graf repo’da; DB senkronu için `scripts/export_traceability_graph.py` + `governance_artifact_id` eşlemesi (`docs/ARTIFACT_GOVERNANCE.md`).
- [x] CI’da `GATE_TIER=pr` yeşil; `Gate Nightly` (`schedule` + `workflow_dispatch`) tanımlı — ilk doğrulama adımları `docs/CI_DOWNLOAD_GATE_ARTIFACTS.md`.
- [x] `backend-gate-artifacts` indirilip `gate-report.json` incelendi — prosedür `docs/CI_DOWNLOAD_GATE_ARTIFACTS.md` (PR) ve `docs/GATE_RELEASE_RUNBOOK.md` (release).

### Çıkış kriterleri

- Gate false positive oranı kabul edilebilir.
- Ortalama PR gate süresi ekip SLA’sına uyuyor.
- Pilot ekip metadata disiplinini sürdürebiliyor.

## Yaygınlaştırma (3. sprint+)

- [x] Tüm domain’ler için artifact katalog genişletildi — cycle + manifest + `compatibility_baseline` + `manifest_sample` (`artifact_catalog.yaml`).
- [x] `GATE_TIER=release` ile release öncesi manuel workflow rutini tanımlandı — `docs/GATE_RELEASE_RUNBOOK.md` + `Gate Release` workflow.
- [x] Haftalık KPI review takvime bağlandı — `docs/calendar/quality-sync-weekly.ics` + `docs/KPI_ARTIFACT_GATES.md` + haftalık GitHub Actions hatırlatıcı workflow.
- [x] `relationships` → `traceability_graph.yaml` export — `scripts/export_traceability_graph.py`; demo seed iki yönlü relationship + üç `governance_artifact_id` ile yerel doğrulama için veri üretir (`seed_demo_data`).

## Rollback

- Geçici olarak `GATE_TIER` kullanımını kısıtlayın veya `run_gates` adımını `continue-on-error` yapın (yalnızca acil durum; plan ihlali).
