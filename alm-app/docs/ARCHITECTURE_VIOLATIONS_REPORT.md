# ALM App — DDD / CQRS / DTO / Clean Architecture İhlal Raporu

Bu doküman **alm-manifest-app/alm-app** backend'inde tespit edilen **bounded context**, **DDD**, **CQRS**, **DTO** ve **Clean Architecture** ihlallerini özetler ve **yapılan düzeltmeleri** kaydeder.

---

## Kapsam Dışı (Out of Scope)

Aşağıdaki konular bu mimari refactor **kapsamı dışındadır**; doküman veya ihlal listesinde refactor hedefi olarak yer almaz:

- **Field masking** (`alm.shared.infrastructure.security.field_masking`): Artifact yanıtları için ACL tabanlı alan maskeleme ve `allowed_actions`. Shared katmanının `alm.artifact.api.schemas.ArtifactResponse` kullanımı **bilinçli olarak kabul edilir**; taşıma veya port refactor’u yapılmayacaktır.

---

## Yapılan Düzeltmeler (Özet)

| Konu | Durum |
|------|--------|
| **Tenant domain → Auth domain** | TenantOnboardingSaga `tenant.application.sagas` içine taşındı; domain yalnızca PermissionResolver içeriyor. |
| **Tenant application → Auth entity** | IUserCreationPort + UserCreationResult + CreateUserService; Tenant handler artık sadece port kullanıyor. |
| **ProjectMember entity API’ye sızması** | ProjectMemberDTO eklendi; List/Add/Update project member handler’lar DTO döndürüyor. |
| **Application → Infrastructure (metrik, session, security, email, cache)** | IArtifactTransitionMetrics, IWorkflowRuleRunner, IPasswordHasher, ITokenService, IEmailSender, IPermissionCache port’ları ve adapter’lar eklendi; handler’lar port kullanıyor. |
| **FormSchema / orgs → Artifact domain (manifest_defs_to_flat)** | IManifestDefsFlattener port’u ve ManifestDefsFlattenerAdapter; FormSchema ve orgs API artifact.domain’e bağımlı değil. |
| **Shared → Artifact domain (manifest ACL)** | IManifestACLChecker port’u ve ManifestACLCheckerAdapter; require_manifest_acl port üzerinden çalışıyor. |

---

## 1. Bounded Context / Modül İhlalleri

### 1.1 Domain → Domain (Cross-Context) — ✅ Düzeltildi

TenantOnboardingSaga artık **tenant.application.sagas.tenant_onboarding** içinde. Domain(Tenant) → Domain(Auth) bağımlılığı kaldırıldı.

### 1.2 Application → Domain (Başka Context) — ✅ İlgili maddeler düzeltildi

- **create_user_by_admin:** IUserCreationPort + CreateUserService ile Tenant, Auth entity’sine bağımlı değil.
- **FormSchema → Artifact domain:** IManifestDefsFlattener ile FormSchema application artifact.domain’e bağımlı değil.
- **soft_delete_user:** UserRepository port kullanımı kabul edilebilir.

---

## 2. Clean Architecture İhlalleri — ✅ İlgili maddeler düzeltildi

- **transition_artifact + metrics:** IArtifactTransitionMetrics port ve PrometheusArtifactTransitionMetrics.
- **workflow_rule event_handlers + session:** IWorkflowRuleRunner port ve WorkflowRuleRunner (session kullanımı infrastructure’da).
- **Auth/tenant: password, JWT, email, cache:** IPasswordHasher, ITokenService, IEmailSender, IPermissionCache (shared.domain.ports) ve adapter’lar; handler_registry singleton enjeksiyonu.
- **Shared → Artifact domain (manifest_acl):** IManifestACLChecker ve ManifestACLCheckerAdapter; shared artifact.domain import etmiyor.

---

## 3. DTO İhlalleri — ✅ Düzeltildi

- ListProjectMembersHandler, AddProjectMemberHandler, UpdateProjectMemberHandler artık ProjectMemberDTO kullanıyor; API DTO → schema dönüşümü yapıyor.

---

## 4. CQRS ve Genel Mimari

- CQRS, event-driven yapı ve Mediator akışı dokümantasyonla uyumlu; ihlal yok.

---

## 5. Özet Tablo (Düzeltmeler Sonrası)

| İhlal Türü | Düzeltme öncesi | Düzeltme sonrası |
|------------|------------------|-------------------|
| Domain → Domain (cross-context) | 1 | 0 |
| Application → Domain (başka context) entity | 1 | 0 |
| Application → Infrastructure | 12+ | 0 |
| Query’de entity dönme (DTO yerine) | 1 | 0 |
| FormSchema/orgs → Artifact domain | 2 | 0 |
| Shared → Artifact domain (ACL) | 1 | 0 |

**Kapsam dışı (refactor edilmez):** Field masking (shared → artifact.api bağımlılığı).

Bu rapor, yapılan düzeltmelerle güncellenmiştir. Kapsam dışı maddeler dokümanın başında belirtilir.
