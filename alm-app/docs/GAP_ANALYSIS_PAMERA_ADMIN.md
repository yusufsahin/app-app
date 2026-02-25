# Pamera API — Admin Context Gap Analizi

Bu doküman **pamera/pameraapi** içindeki **Admin context**'inin mevcut durumunu özetler ve hedef (tipik admin panel / ALM platform beklentileri) ile arasındaki boşlukları listeler. Referans: [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md), [CONTEXT_COMPARISON_ALM_VS_PAMERA.md](./CONTEXT_COMPARISON_ALM_VS_PAMERA.md).

---

## 1. Admin Context Özeti (Pamera API)

Admin context, **ADMIN** rolüne sahip kullanıcıların eriştiği sistem genelindeki yönetim işlevlerini kapsar. İlgili API’ler:

- **`/api/v1/admin/*`** — `AdminController` (merkezi admin panel API’si)
- **`/api/v1/tenants`** — Tenant/organization create (ADMIN only)
- **`/api/v1/processes`** — Process CRUD, import, backfill (ADMIN only)
- **`/api/v1/registry/overrides`** — Code registry override CRUD (ADMIN only)

Form schema tarafında **admin-user** ve **admin-settings** context’leri ile metadata-driven form desteği var.

---

## 2. Mevcut Özellikler Tablosu

| Alan | Endpoint / Kaynak | Açıklama |
|------|-------------------|----------|
| **Kullanıcı listesi** | `GET /api/v1/admin/users` | Tüm kullanıcılar; id, username, displayName, email, roles, enabled |
| **Kullanıcı güncelleme** | `PATCH /api/v1/admin/users/{id}` | roles, enabled; son ADMIN kaldırılamaz, self disable yasak |
| **Roller** | `GET /api/v1/admin/roles` | Tüm roller ve ayrıcalıklar (read-only) |
| **Health özeti** | `GET /api/v1/admin/health-summary` | status, userCount, totalProjects, activeProjects, totalArtifacts, activeProcesses (BR-28 P3) |
| **Audit log** | `GET /api/v1/admin/audit` | JaVers tabanlı; entityType, fromDate, toDate, limit (max 500) |
| **Sistem ayarları** | `GET/PATCH /api/v1/admin/settings` | defaultLocale, defaultTimeZone (yazılabilir); rateLimit, jwt, cors (read-only) |
| **Process config durumu** | `GET /api/v1/admin/process-config-status` | Proje bazlı: hasActiveVersion, formSchemaAvailable |
| **Process özeti** | `GET /api/v1/admin/processes-summary` | Tüm process’ler + proje sayısı |
| **Manifest backfill** | `POST /api/v1/admin/processes/backfill-manifest-snapshots` | Canonical process’ler için manifest_snapshot doldurma |
| **Feature flags** | `GET/PATCH /api/v1/admin/feature-flags` | feature.* anahtarları (BR-28) |
| **Bildirim ayarları** | `GET/PATCH /api/v1/admin/notification-settings` | notification.enabled, notification.email.enabled |
| **Kayıt politikası** | `GET/PATCH /api/v1/admin/registration-policy` | Self-registration (POST /auth/register) açık/kapalı |
| **API token’lar** | `GET /api/v1/admin/api-tokens`, `DELETE .../api-tokens/{id}` | Tüm PAT listesi; admin herhangi bir token’ı iptal edebilir |
| **Bakım modu** | `GET/PATCH /api/v1/admin/maintenance` | Açıkken admin dışı isteklere 503; auth/health/docs izinli |
| **Tenant oluşturma** | `POST /api/v1/tenants` | ADMIN only |
| **Organization oluşturma** | `POST /api/v1/tenants/{id}/organizations` | ADMIN only |
| **Process CRUD / import** | `POST/GET/PUT/DELETE /api/v1/processes/*` | Tümü ADMIN only |
| **Registry override** | `POST/GET/DELETE /api/v1/registry/overrides*` | ADMIN only |
| **Form schema** | FormSchemaService | admin-user (roles, enabled), admin-settings (defaultLocale, defaultTimeZone) |

---

## 3. Gap Analizi: Mevcut vs Hedef

### 3.1 Özet Tablo (Admin Context)

| Özellik | Pamera mevcut | Hedef | Gap / öncelik |
|--------|----------------|-------|----------------|
| Kullanıcı listele / güncelle | Var (roles, enabled) | Var | — |
| Rol listesi | Var (read-only) | Var | — |
| **Admin tarafından kullanıcı oluşturma** | Yok (sadece self-register) | POST /admin/users veya eşdeğer | **G1:** Ayrı “admin create user” endpoint’i yok; registration kapalıyken admin kullanıcı eklemek için net akış belirsiz |
| **Kullanıcı silme / devre dışı bırakma** | enabled=false (soft) | Soft delete + isteğe bağlı hard delete | **G2:** Sadece enabled; silme (soft/hard) yok |
| Tenant CRUD | Create tenant/organization | Create + update + (soft) delete / arşiv | **G3:** Tenant güncelleme ve silme/arşiv yok |
| Health / istatistik | health-summary (sayılar) | + uygulama versiyonu, ortam bilgisi | **G4:** Versiyon/env alanı yok (opsiyonel) |
| Audit | JaVers (entity değişiklikleri) | + login/API erişim audit | **G5:** Kim kimin ne zaman giriş yaptığı / hangi endpoint’e istek attığı audit’i yok |
| Rate limit yönetimi | settings’te read-only (rateLimit.loginMaxPerMinute) | Tenant/tier bazlı limit, admin’den ayarlanabilir | **G6:** ALM’de tenant rate limit var; Pamera’da admin tarafında yapılandırma yok |
| Backup / export | Yok | Sistem/veri export veya yedekleme API | **G7:** Uzun vadeli |
| Process / config tanı | Var (process-config-status, processes-summary, backfill) | Var | — |
| Feature flags / maintenance / registration | Var | Var | — |
| API token yönetimi | List + revoke | Var | — |
| Form schema (admin-user, admin-settings) | Var | Var | — |

### 3.2 Detaylı Gap Açıklamaları

- **G1 — Admin kullanıcı oluşturma:** Şu an yeni kullanıcı yalnızca `POST /auth/register` ile ekleniyor. Kayıt kapalıyken “admins can still register” ifadesi var; ancak ayrı bir `POST /api/v1/admin/users` (admin’in başka kullanıcı oluşturması) yok. Hedef: Admin’in e-posta/username/rol ile doğrudan kullanıcı oluşturabilmesi veya davet akışı.
- **G2 — Kullanıcı silme:** Sadece `enabled=false` ile devre dışı bırakma var. Soft delete (deletedAt) veya hard delete endpoint’i yok.
- **G3 — Tenant güncelleme/silme:** Tenant ve organization için sadece create var; isim/status güncelleme ve silme/arşivleme API’si yok.
- **G4 — Health’ta versiyon/env:** health-summary’de uygulama versiyonu ve ortam (env) bilgisi eklenebilir (opsiyonel).
- **G5 — Erişim audit:** JaVers sadece entity değişikliklerini veriyor; login denemeleri, başarısız girişler, kritik API çağrıları için ayrı audit log/endpoint yok.
- **G6 — Rate limit yönetimi:** Tenant veya tier bazlı rate limit (ALM’deki gibi) ve admin panelinden yapılandırma hedeflenebilir; şu an sadece login rate limit env’den read-only görünüyor.

---

## 4. Admin’e Bağlı Diğer Context’ler

| Context | ADMIN-only uçlar | Not |
|---------|------------------|-----|
| **Tenant** | Create tenant, Create organization | List/get/members: erişim tenant membership’e göre; ADMIN tüm tenant’ları görebilir |
| **Process** | Tüm process CRUD, import, backfill | ProcessController tamamen ADMIN |
| **Registry** | Override create/list/delete | RegistryController override uçları ADMIN |
| **Auth** | — | Login/register/refresh herkese açık; admin user management admin controller üzerinden |

---

## 5. İlgili Dokümanlar

- [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md) — ALM uygulaması gap analizi
- [CONTEXT_COMPARISON_ALM_VS_PAMERA.md](./CONTEXT_COMPARISON_ALM_VS_PAMERA.md) — ALM vs Pamera context karşılaştırması
- [CONTEXTS_AND_PROGRESSION.md](./CONTEXTS_AND_PROGRESSION.md) — Context’ler ve ilerleyiş
- Pamera API: `AdminController`, `AdminSettingsService`, `AdminAuditService`, `AdminHealthService`, `ProcessConfigStatusService`

— ↑ [Dokümanlar](README.md)
