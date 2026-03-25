# Artifact envanteri ve sürümleme

Bu doküman **Artifact + Risk-Based Gate** planındaki *artifact-inventory* çıktısını somutlaştırır. Canlı kaynak: `backend/alm_meta/artifact_catalog.yaml`.

## Artifact tipleri

| `artifact_type` | Açıklama | Tipik sahip |
|-----------------|----------|-------------|
| `schema` | DSL / manifest şeması | platform-team |
| `rule_pack` | Anlamsal kurallar | platform-team |
| `manifest_sample` | Golden / örnek manifestler | platform-team |
| `migration_spec` | Sürüm dönüşüm tanımı | platform-team |
| `compatibility_baseline` | Uyumluluk baz çizgisi | platform-team |

## Sürümleme (`version_policy`)

- Varsayılan: **SemVer** (`major.minor.patch`).
- `artifact_version` alanı katalogda isteğe bağlı; set edildiğinde boş olamaz.
- **Breaking** değişiklikler: `change_manifest.yaml` içinde `change_type: breaking` ve uyumluluk suite’i (gate) zorunlu.

## Sahiplik

- Her satırda `owner` alanı (takım veya kod sahibi grubu).
- Genişletme: yeni artifact eklerken aynı dosyada PR ile güncellenir; CI `validate_metadata.py` ile doğrular.

## Matris (örnek — güncel liste YAML’da)

| artifact_id | type | criticality | owner |
|-------------|------|-------------|--------|
| `manifest_sample.cycle.minimal` | manifest_sample | medium | platform-team |
| `schema.cycle.v1` | schema | critical | platform-team |
| `rule_pack.cycle.v1` | rule_pack | high | platform-team |
| `migration_spec.cycle.v1_to_v2` | migration_spec | high | platform-team |
| `schema.manifest.v1` | schema | high | platform-team |
| `rule_pack.manifest.v1` | rule_pack | medium | platform-team |
| `compatibility_baseline.alm.v1` | compatibility_baseline | high | platform-team |
