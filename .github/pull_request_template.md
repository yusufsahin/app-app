## Değişim sınıflandırması (zorunlu)

- [ ] `non-breaking` — mevcut manifestler uyumlu kalır
- [ ] `breaking` — uyumluluk / migration gerektirir

**Açıklama (kısa):**


## Etkilenen artifact’lar

`alm-app/backend/alm_meta/artifact_catalog.yaml` içindeki `artifact_id` değerlerini listeleyin:

-
-

> CI gate için `alm-app/backend/alm_meta/change_manifest.yaml` bu PR ile **senkron** güncellenmeli (`change_type`, `affected_artifacts`, `change_set_id`).

## Checklist

- [ ] `change_manifest.yaml` güncellendi
- [ ] Gerekirse `test_manifest.yaml` / `traceability_graph.yaml` güncellendi
- [ ] Breaking ise compatibility / migration test senaryoları gözden geçirildi
