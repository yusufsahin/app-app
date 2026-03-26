# Flaky quarantine akışı ve SLA

**Plan maddesi:** flaky testleri release kararından ayırma + SLA.

## Kaynak dosya

- `backend/alm_meta/flaky_quarantine.yaml`
  - `quarantined_test_ids`: `test_manifest.yaml` içindeki `test_id` değerleri
  - `sla_days_to_fix`: quarantine’de kalma üst süre hedefi (gün)

## Davranış

- **PR / Nightly** (`GATE_TIER` ≠ `release`): `flaky_quarantine_check.py` atlanır.
- **Release** (`GATE_TIER=release`): Seçili ve **critical** bir test quarantine listesindeyse pipeline **fail** — flaky sonuç release’i bloklamaz; test quarantine’e alınır ve release’ten çıkarılır.

## Takip (“board”)

Aşağıdakilerden biriyle operasyonelleştirin:

1. **GitHub Issues:** `flaky-quarantine` etiketi + `test_id` başlıkta; SLA tarihi gövdede.
2. **Proje panosu:** “Quarantine” sütunu.
3. Haftalık review: `docs/KPI_ARTIFACT_GATES.md` içindeki ritüelde quarantine listesi gözden geçirilir.

## SLA ihlali

- Quarantine süresi `sla_days_to_fix` aştıysa issue’yu `priority` yükselt veya release’i bloke edecek şekilde testi düzelt / kaldır.
