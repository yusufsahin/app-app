# Release gate rutini (`GATE_TIER=release`)

## Ne zaman

- Ana dala merge öncesi veya sürüm etiketi öncesi, tam regresyon + release-tier flaky kontrolü gerektiğinde.

İlgili: haftalık KPI toplantısı için [`docs/calendar/quality-sync-weekly.ics`](calendar/quality-sync-weekly.ics); PR çıktı indirme [`docs/CI_DOWNLOAD_GATE_ARTIFACTS.md`](CI_DOWNLOAD_GATE_ARTIFACTS.md).

## Adımlar

1. GitHub **Actions** → **Gate Release** workflow → **Run workflow** (manuel `workflow_dispatch`).
2. İş tamamlanınca artifact **gate-release-artifacts** indirilir (`backend/artifacts/` yapısı).
3. Özellikle şu dosyalar gözden geçilir:
   - `gate-report.json` — `gate_decision`, `block_reasons`, `gate_tier`
   - `pytest-report.xml` — kırmızı testler
   - `kpi-snapshot.json` — özet (varsa)

## Monorepo kökü

Depo kökünden push edilen repolarda workflow dosyası: `.github/workflows/gate-release.yml` (`alm-app/backend` çalışma dizini).

## Başarısızlık

- `block_reasons` ve seçili test listesini inceleyin; `change_manifest.yaml` / `test_manifest.yaml` uyumunu doğrulayın.
- Acil durumda yalnızca geçici olarak `docs/PILOT_ROLLOUT_ARTIFACT_GATES.md` içindeki rollback notuna uygun hareket edin.
