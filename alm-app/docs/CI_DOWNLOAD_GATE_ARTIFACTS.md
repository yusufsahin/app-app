# CI’dan gate çıktılarını indirme

## PR / push (CI workflow)

1. GitHub **Actions** → son başarılı veya başarısız **CI** çalıştırması.
2. Sayfanın altındaki **Artifacts** bölümünde **backend-gate-artifacts** ögesini indirin.
3. Zip içinde özellikle:
   - `gate-report.json`
   - `pytest-report.xml` (varsa)
   - `kpi-snapshot.json` (varsa)

## Gate Nightly / Gate Release

- **Gate Nightly:** artifact adı **`gate-nightly-artifacts`** (workflow: `Gate Nightly`).
- **Gate Release:** `gate-release-artifacts` — ayrıntı `docs/GATE_RELEASE_RUNBOOK.md`.

## İlk kez doğrulama (ekip)

1. **Actions** → **Gate Nightly** → **Run workflow** ile manuel tetikleyin.
2. İş bittiğinde artifact’i indirip `gate-report.json` içindeki `gate_decision` ve `block_reasons` alanlarını okuyun.

Monorepo kökünden push edilen repolarda workflow dosyaları `.github/workflows/` altında; çalışma dizini `alm-app/backend`’dir.
