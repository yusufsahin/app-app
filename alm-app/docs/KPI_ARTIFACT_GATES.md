# Artifact gate KPI’ları ve haftalık review

## Otomatik üretim

CI veya yerel koşum sonrası:

- `backend/artifacts/gate-report.json` — nihai karar, `block_reasons`, `gate_tier`
- `backend/artifacts/kpi-snapshot.json` — `scripts/report.py` çıktısı (özet besleme)
- `backend/alm_meta/kpi_thresholds.yaml` — eşik tanımları
- `scripts/kpi_threshold_check.py` — tek koşumda critical + compatibility eşik kontrolü (alarm)

## Temel metrikler (plan ile hizalı)

| Metrik | Kaynak / not |
|--------|----------------|
| `critical_artifact_pass_rate` | `test-execution.json` — seçili kritik testlerin JUnit eşlemesi |
| `compatibility_success_rate` | `compatibility_suite_status` geçiş oranı (release/nightly toplu) |
| `artifact_coverage_ratio` | İleride: testlenen artifact / katalog (script genişletmesi) |
| `flaky_rate_by_suite` | Flaky quarantine + tekrarlayan kırmızı build takibi |
| `traceability_completeness` | `traceability_graph.yaml` + üretim relationship export senkronu |
| `orphan_artifact_rate` | Graf derecesi 0 olan linklenebilir artifact oranı |

## Haftalık review takvimi (repo rutini)

- **Takvim dosyası (içe aktarma):** [`docs/calendar/quality-sync-weekly.ics`](calendar/quality-sync-weekly.ics) — Outlook / Google / Apple Takvim’e ekleyin (her Çarşamba 07:00 UTC, 30 dk).
- **GitHub hatırlatıcı:** `.github/workflows/weekly-quality-sync-reminder.yml` — her Çarşamba Actions’da özet checklist (issue oluşturmaz).
- **Katılımcılar:** Tech Lead (veya delegate), QA Lead, DevOps rotasyonu.
- **Gündem:** aşağıdaki “Haftalık Quality Sync” maddeleri; çıktı olarak aksiyon maddeleri issue/board’a yazılır.

## Haftalık Quality Sync (önerilen 30 dk)

1. Son 7 gün `gate_decision` dağılımı (PR artifact’lerinden veya CI özetinden).
2. En sık `block_reasons` (top 3) ve sahiplik.
3. `flaky_quarantine.yaml` — SLA (`sla_days_to_fix`) aşımları.
4. Risk skor kalibrasyonu: yüksek risk + yeşil gate veya düşük risk + kırmızı gate örnekleri.

## Quarantine politikası

- **Release** tier: `flaky_quarantine.yaml` içindeki `test_id`, seçili **critical** testlerle çakışırsa pipeline fail.
- PR/nightly’de quarantine kontrolü atlanır (`GATE_TIER != release`).
