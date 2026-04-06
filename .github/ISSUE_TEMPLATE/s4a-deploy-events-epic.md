---
name: "Epic: S4a — Deploy events (SCM hizalı)"
about: Ortam × commit × artifact; PLAN_SCM_S4_DEPLOY_TRACEABILITY
title: "[Epic] S4a — Deploy events + ortam özeti (SCM ile hizalı)"
labels: []
assignees: []
---

## Amaç

Artifact başına **hangi ortamda hangi commit / image** ile canlı olduğunu göstermek.

**Tasarım:** `alm-app/docs/PLAN_SCM_S4_DEPLOY_TRACEABILITY.md` (monorepo köküne göre)

## Kapsam (S4a)

- [ ] **S4a-1** — `deployment_event` (veya eşdeğeri) tablo + migration; indeks `(project_id, environment, occurred_at)`
- [ ] **S4a-2** — Ingestion: `POST` API (JWT, dar izin) ve/veya CI webhook (HMAC secret); idempotency
- [ ] **S4a-3** — Okuma API: artifact veya `artifact_key` için son bilinen ortamlar özeti
- [ ] **S4a-4** — UI: artifact detayda “Dağıtım / Ortamlar” veya Kaynak sekmesi genişlemesi; en az staging + prod akışı dokümante

## Bu epic dışında

- **S4b** (etki analizi / stale traceability) → ayrı issue şablonu

## Bağımlılıklar

- Mevcut `scm_links`, `commit_sha` ve `canonical_web_url` normalizasyonu

## İlgili dokümanlar

- `alm-app/docs/PLAN_SCM_TRACEABILITY.md` — Faz S4 giriş
- `alm-app/docs/PLAN_ADVANCED_ANALYTICS.md` — §6 SCM/DevOps
