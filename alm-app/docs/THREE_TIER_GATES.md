# Üç katmanlı gate (PR / Nightly / Release)

| Tier | Tetikleyici | `GATE_TIER` | Açıklama |
|------|-------------|-------------|----------|
| PR | `ci.yml` push/PR | `pr` | Dar suite seçimi, hızlı geri bildirim |
| Nightly | `gate-nightly.yml` cron / manuel | `nightly` | `compat` + `negative` dahil geniş seçim |
| Release | `gate-release.yml` manuel | `release` | Tam kapsam + `regression`; flaky quarantine kuralı |

Uygulama: `scripts/select_tests.py` + `scripts/risk_gate.py`.
