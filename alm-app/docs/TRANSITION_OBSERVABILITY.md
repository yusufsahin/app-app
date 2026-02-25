# Artifact Transition Observability

Metrikler, loglama ve tracing — artifact workflow geçişleri için.

---

## 1. Prometheus metrikleri

| Metrik | Tip | Açıklama |
|--------|-----|----------|
| `alm_artifact_transition_total` | Counter | Sonuç etiketine göre toplam geçiş sayısı. |
| `alm_artifact_transition_duration_seconds` | Histogram | Geçiş handler işlem süresi (saniye). |

### alm_artifact_transition_total labels

- **result:** `success` | `validation_error` | `policy_denied` | `conflict_error`
  - `success`: Geçiş uygulandı.
  - `validation_error`: Geçersiz trigger/state, guard sağlanmadı veya diğer validasyon hataları.
  - `policy_denied`: Geçiş grafikte geçerli ancak TransitionPolicy veya MPC PolicyEngine reddetti.
  - `conflict_error`: Optimistic lock uyuşmazlığı (expected_updated_at).

### alm_artifact_transition_duration_seconds

- Buckets: 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0 (saniye).
- Başarılı ve hata durumlarında her iki yolda da ölçülür.

**Konum:** `alm.artifact.infrastructure.metrics`; sayaçlar `TransitionArtifactHandler` içinde güncellenir.

**Endpoint:** Uygulama köküne mount edilmiş Prometheus ASGI uygulaması: `GET /metrics/` (FastAPI mount nedeniyle trailing slash kullanın). Prometheus scrape URL örneği: `http://localhost:8000/metrics/`.

---

## 2. Yapılandırılmış log

Başarılı geçişte:

- **Event:** `artifact_transition`
- **Alanlar:** `artifact_id`, `from_state`, `to_state`, `trigger` (varsa), `project_id`

Hata durumunda mevcut exception log’a düşer (handler dışında).

---

## 3. OpenTelemetry span attributes

Geçiş handler çalışırken mevcut span’e (varsa) eklenen attribute’lar:

- `artifact.id`
- `artifact.transition.from_state`
- `artifact.transition.to_state`
- `artifact.transition.trigger` (istemde trigger gönderildiyse)

Dağıtık izlemede geçiş akışını filtrelemek için kullanılabilir.

---

## 4. İlgili dokümanlar

- [WORKFLOW_ENGINE_BOUNDARY.md](WORKFLOW_ENGINE_BOUNDARY.md) — Handler sırası, Statelesspy vs MPC.
- [WORKFLOW_API.md](WORKFLOW_API.md) — Transition ve batch-transition API.
