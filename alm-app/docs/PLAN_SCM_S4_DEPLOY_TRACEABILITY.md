# Plan — Faz S4: Deploy × SCM izlenebilirliği (tasarım)

Bu doküman, [PLAN_SCM_TRACEABILITY.md](./PLAN_SCM_TRACEABILITY.md) **Faz S4** için uygulanabilir bir **epik çerçevesi** ve **deploy event** şeması önerir. [PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) §6 ile uyumludur: dağıtım/ortam metrikleri burada tanımlanır; analitik dashboard’lara ikinci aşamada bağlanır.

**Durum:** S4a çekirdeği (052 + deployment-events API) üründe. **S4a-4** (artifact Ortamlar UI), **traceability-summary** GET, **imzalı deploy webhook** ve **S4b** (`stale_traceability`, migration 053) uygulandı; ayrıntı [PLAN_SCM_TRACEABILITY.md](./PLAN_SCM_TRACEABILITY.md) Faz S4.

---

## 1. Problem ve değer

| Soru | Çözüm yönü |
|------|------------|
| Bu iş kalemi (artifact) **hangi ortamda** hangi commit/image ile canlı? | Ortam bazlı deploy kaydı + SCM `commit_sha` / image digest ile ilişki |
| Release mühendisi release notunu ALM ile nasıl hizalar? | Deploy olayı isteğe bağlı `release_label` / `build_id` taşır |
| Üst gereksinim değişince hangi testler “şüpheli”? | S4b: ArtifactLink grafiği + kural (ayrı bölüm) |

---

## 2. Epik parçaları (önerilen sıra)

| Parça | İçerik | Kabul (özet) |
|-------|--------|----------------|
| **S4a-1** | `deployment_events` tablosu + project scope | **Üründe:** migration 052; indeks `(project_id, environment, occurred_at)` |
| **S4a-2** | Ingestion API: `POST` (JWT + `project:update`) veya CI webhook (HMAC) | **Üründe:** `POST …/deployment-events` + `POST …/webhooks/deploy` (HMAC, `deploy_webhook_secret`) |
| **S4a-3** | Okuma API: proje listesi / artifact özeti | **Üründe:** `GET …/deployment-events` + `GET …/artifacts/{id}/traceability-summary` |
| **S4a-4** | UI: artifact detayda “Dağıtım / Ortamlar” sekmesi veya mevcut Kaynak sekmesi genişlemesi | **Üründe:** Dağıtım sekmesi (traceability-summary) |
| **S4b-1** | Etki analizi: üst tip (ör. Requirement) değişince, bağlı test/case artifact’larına `stale_traceability` bayrağı (veya ayrı tablo) | **Üründe:** migration 053; `ArtifactStateChanged` + planlama içerik güncellemesi (`ArtifactUpdated`); ilişki türleri `verifies` / `covers` / …; PATCH `clear_stale_traceability` |

S4a tamamlanmadan S4b zorunlu değildir.

---

## 3. Deploy event — mantıksal şema (öneri)

Alanlar tenant ve proje ile scope’lanır (`tenant_id`, `project_id`).

| Alan | Tip / not |
|------|-----------|
| `id` | UUID |
| `environment` | `string` — örn. `dev`, `staging`, `prod` (konvansiyon proje/manifest ile sabitlenebilir) |
| `occurred_at` | `timestamptz` — deploy’un bittiği an (CI’dan gelen) |
| `commit_sha` | `string` nullable — repo kökü veya ana bileşen SHA’sı (kısa veya uzun; normalize: küçük harf, max 40) |
| `image_digest` | `string` nullable — konteyner dağıtımları için `sha256:…` |
| `repo_full_name` | `string` nullable — hangi repo’dan geldiği (GitHub `owner/repo`) |
| `artifact_keys` | `text[]` veya ayrı junction — CI’ın bildirdiği doğrudan iş kalemi anahtarları (opsiyonel; yoksa sadece SHA ile SCM satırlarından türetme) |
| `release_label` | `string` nullable — örn. `v1.4.0`, `2026.04.06` |
| `build_id` | `string` nullable — pipeline run id |
| `source` | `ci_webhook` \| `api` \| `manual` |
| `raw_context` | `jsonb` nullable — hata ayıklama; PII saklamama politikası |
| `created_at` | sunucu zamanı |

**İlişki SCM ile:** `commit_sha` + `repo_full_name` (varsa) ile mevcut `scm_links` satırları üzerinden ters sorgu: “bu SHA hangi artifact’lara bağlı?” Çoklu artifact için aynı deploy satırı veya junction tablosu ürün kararı.

**Idempotency:** Aynı pipeline run’ın tekrar bildirimi çift kayıt oluşturmamalı; `build_id` + `environment` veya sağlayıcı teslimat kimliği ile deduplikasyon.

---

## 4. Güvenlik (özet)

- Webhook secret proje ayarında (`settings.deploy_webhook_secret` benzeri) — [manifest-schema.md](./manifest-schema.md) ile genişletme.
- Ham gövde boyutu üst sınırı (SCM ile aynı sipariş: ~1 MiB).
- Okuma: `artifact:read` veya `project:read` ile hizalı; yazma: dar izin.

---

## 5. GitHub issue şablonları (depoda)

Repoda hazır şablonlar (GitHub → **Issues → New issue**):

| Şablon | Dosya |
|--------|--------|
| S4a epic | [`.github/ISSUE_TEMPLATE/s4a-deploy-events-epic.md`](../../.github/ISSUE_TEMPLATE/s4a-deploy-events-epic.md) |
| S4b epic | [`.github/ISSUE_TEMPLATE/s4b-impact-analysis.md`](../../.github/ISSUE_TEMPLATE/s4b-impact-analysis.md) |

CLI ile oluşturmak için: `gh issue create --template s4a-deploy-events-epic.md` (depo kökünde, `gh` kurulu olmalı).

---

## 6. İlgili dokümanlar

- [PLAN_SCM_TRACEABILITY.md](./PLAN_SCM_TRACEABILITY.md) — S1–S3 özeti, Faz S4 giriş
- [PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) — §6 SCM/DevOps kesişimi
- [manifest-schema.md](./manifest-schema.md) — `projects.settings` genişletmeleri

— ↑ [Dokümanlar](README.md)
