# D1 — Policy / ACL Entegrasyon Planı

MPC PolicyEngine ve ACLEngine ile alm-app entegrasyonu için yol haritası. Mevcut RBAC yapısı korunur; MPC hazır olduğunda GuardPort/AuthPort implementasyonu ve alan maskeleme eklenir.

---

## 1. Mevcut Durum

| Bileşen | Açıklama |
|--------|----------|
| **Kimlik** | JWT (access token), `CurrentUser` (id, tenant_id, roles) |
| **Yetki** | `require_permission(permission)` — FastAPI dependency; role→privilege DB + Redis cache |
| **Eşleşme** | `_matches_permission(codes, required)`: tam eşleşme veya `resource:*` |
| **Kapsam** | Endpoint bazlı: her route için tek bir permission (örn. `artifact:read`, `manifest:update`) |
| **GuardPort/AuthPort** | `mpc_ports.AlmAppAuthPort`, `AlmAppGuardPort`; `get_user_privileges` + `_matches_permission` ile implemente |
| **Field masking** | `field_masking`: `artifact:read_sensitive` yoksa `custom_fields` içinde `internal_notes`, `confidential` gizlenir; artifact GET/list/create/update/transition/restore response'larında uygulanır |
| **Transition policy** | Manifest `TransitionPolicy` (örn. assignee zorunlu) `check_transition_policies` ile; PolicyEngine hook transition handler'da yorum olarak işaretli |

Alan maskeleme veya kaynak bazlı (örn. “bu artifact’a yazma”) ayrıntılı kontrol yok; manifest tabanlı policy (örn. “active state’te assignee zorunlu”) henüz MPC PolicyEngine üzerinden değil, gerekirse alm-app içinde basit kontrol ile yapılıyor.

---

## 2. Hedef (MPC ile)

| Bileşen | Hedef |
|--------|--------|
| **GuardPort / AuthPort** | MPC’nin “bu kullanıcı bu aksiyonu yapabilir mi?” sorusu için alm-app tarafında implementasyon. Mevcut `PermissionResolver` + `_matches_permission` ile cevap verilir. |
| **PolicyEngine** | Geçiş öncesi manifest kuralları (örn. `when state = 'active' require assignee`). Transition handler içinde MPC PolicyEngine çağrılır; ihlal varsa 403/422. |
| **ACLEngine / field masking** | API response’ta alan filtreleme: kullanıcı rolüne göre belirli alanlar (örn. internal_notes) kaldırılır. Manifest’teki ACL kuralları veya alm-app’te rol bazlı alan listesi kullanılabilir. |
| **Permission-aware UI** | Frontend zaten JWT’deki permissions ile buton/route gizliyor; gerekirse endpoint’ten “allowed_actions” veya “visible_fields” dönülebilir. |

---

## 3. Entegrasyon Adımları

1. **GuardPort/AuthPort adapter (alm-app)**  
   MPC’nin beklediği interface’e uygun bir sınıf yazılır; içeride `get_current_user` + permission resolve (mevcut `PermissionResolver` veya `require_permission` mantığı) kullanılır. Böylece MPC “can(user_id, action, resource)” gibi bir soru sorduğunda alm-app cevap verir.

2. **PolicyEngine’i transition’da kullanma**  
   Artifact transition command’da, geçişi uygulamadan önce MPC PolicyEngine ile manifest + entity snapshot verilip kontrol yapılır; ihlal varsa anlamlı hata (403/422) dönülür. (Şu an workflow geçerli mi kontrolü var; policy “assignee zorunlu” vb. kurallar bu adımda eklenir.)

3. **Field masking (ACL)**  
   Artifact (ve gerekirse diğer entity) response dönmeden önce bir “mask” adımı eklenir: kullanıcı ve rol bilgisi + entity payload → maskelenmiş payload. İlk aşamada rol bazlı sabit alan listesi (örn. “internal_notes sadece admin”) yeterli; ileride manifest/ACLEngine kurallarına bağlanabilir.

4. **Permission-aware UI (isteğe bağlı)**  
   Gerekirse GET artifact (veya list) response’una `visible_fields` veya `allowed_actions` eklenir; frontend buna göre form/liste ve aksiyonları kısıtlar.

---

## 4. Bağımlılıklar

- MPC’nin GuardPort/AuthPort interface’lerini yayımlaması ve PolicyEngine/ACLEngine API’sinin netleşmesi.
- Mevcut `require_permission` ve tenant/role/privilege yapısı aynen kullanılabilir; GuardPort implementasyonu bunları çağırır.

---

## 4b. Genel ACL — MPC (manifest-platform-core-suite) durumu

**manifest-platform-core-suite** (`alm-manifest-app/manifest-platform-core-suite/src`) içinde **ACLEngine** mevcut: `mpc/acl/engine.py` — `ACLEngine(ast).check(action, resource, actor_roles=..., actor_attrs=...)` → `ACLResult(allowed, reasons, intents, errors)`. RBAC + opsiyonel ABAC; kurallarda `maskFields` ile **maskField** intent'leri (alm-app P2 kapsamında kullanılmayacak). alm-app'te manifest ACL ve ACLEngine.check kullanılmıyor; genel ACL entegrasyonu P2 kapsamında: **manifest ACL + ACLEngine.check (allow/deny)**; maskField P2 kapsamında değil. Ayrıntı: [PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md](./PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md) §5.4.

---

## 5. İlgili Dosyalar

- [MPC_BOUNDARY.md](./MPC_BOUNDARY.md) — MPC vs alm-app sınırı
- [REMAINING_PLAN.md](./REMAINING_PLAN.md) — D1 görevi
- Backend: `alm.shared.infrastructure.security.dependencies` (`require_permission`, `_matches_permission`, `get_user_privileges`), `alm.shared.infrastructure.security.field_masking` (mask_artifact_response, mask_artifact_for_user), `alm.shared.infrastructure.security.mpc_ports` (AuthPort, GuardPort, AlmAppAuthPort, AlmAppGuardPort), `alm.artifact.application.commands.transition_artifact` (policy hook), `alm.tenant.domain.services.PermissionResolver`
- Seed: `artifact:read_sensitive` privilege `alm_meta/seed/default_privileges.yaml` içinde tanımlı

— ↑ [Dokümanlar](README.md)
