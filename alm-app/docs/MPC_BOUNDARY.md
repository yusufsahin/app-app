# MPC – ALM Sınır Belgesi

`manifest-platform-core-suite` (MPC) ile `alm-app` arasındaki sorumluluk ayrımı.

---

## 0. Artifact Nerede Olmalı? (Separation of Concerns)

**Artifact, alm-app'in domain nesnesidir; MPC'nin içinde olmamalı ve MPC Artifact'ı "tanımamalı".**

| Soru | Cevap |
|------|--------|
| Artifact entity/repository MPC'de mi? | **Hayır.** Artifact (CRUD, persistence, event'ler) tamamen **alm-app** bounded context'inde. |
| MPC Artifact'tan haberdar olmalı mı? | **Hayır.** MPC sadece **manifest** ve **generic entity snapshot** (örn. `dict`) görür; "Artifact" tipi veya ALM domain'i MPC API'sinde yok. |
| Doğru arayüz ne? | alm-app, geçiş/policy kontrolü istediğinde **Artifact'ı domain-agnostic bir dict'e çevirir** (`to_snapshot_dict()`) ve MPC'ye **manifest + snapshot + transition** bilgisini verir. MPC sadece "bu geçiş geçerli mi?", "policy ihlali var mı?" cevabını döner. |

**Özet:** MPC = manifest tabanlı **generic** motor (workflow, policy, ACL kuralları). ALM app = **Artifact, Task, Project** vb. domain entity'leri ve iş akışı. MPC'ye sadece kural (manifest) ve anlık durum (snapshot dict) gider; entity adı veya ALM modeli gitmez. Bu sayede separation of concerns korunur ve MPC başka uygulamalarda da (farklı entity isimleriyle) kullanılabilir.

**artifact_type nerede?**  
- **Manifest içinde:** "ArtifactType" bir **manifest kind**'ı (id, name, workflow_id, fields). Manifest'i parse eden / kural üreten taraf (MPC) bu tanımları **bilir** — yani "bu manifest'te şu artifact type'lar var, her birinin workflow'u şu" der. Yani **artifact_type tanımı** (tiplerin listesi ve şeması) manifest'in parçası, MPC manifest'i okuyup buna göre WorkflowEngine/PolicyEngine çalıştırır.  
- **Entity tarafında:** **Artifact** entity'sinin `artifact_type` alanı (örn. `"requirement"` string'i) tamamen **alm-app**'te; persistence, CRUD, API hep alm-app. MPC'ye sadece **parametre** olarak gider: "şu manifest + şu artifact_type için geçiş geçerli mi?"  
Yani: artifact_type **kavramı** manifest DSL'inde (MPC bunu bilir); **değer** (bu kaydın tipi) ALM entity'sinde (MPC bilmez, sadece çağrıda string alır).

---

## 1. MPC'de Olması Gerekenler (Platform Core)

| Modül | Sorumluluk | Not |
|-------|------------|-----|
| **Manifest DSL Parser** | Lark LALR, YAML/JSON parse | DomainMeta ile birlikte |
| **DomainMeta** | Kind/type/function tanımları, metadata-driven | |
| **WorkflowEngine** | Geçiş validasyonu, initial state, valid transitions | |
| **PolicyEngine** | `when state require assignee` vb. kurallar | |
| **ACLEngine** | RBAC, permission check, field masking | |
| **ExpressionEngine** | `len`, `contains`, `now`, `daysBetween` | |
| **Action Resolver** | `on_enter`, `on_leave` action isimlerini döner (handler değil) | |
| **Port'lar** | GuardPort, AuthPort, SigningPort, VerificationPort (interface) | |

---

## 2. alm-app'te Olması Gerekenler (Consuming Application)

| Modül | Sorumluluk | Not |
|-------|------------|-----|
| **DomainMeta tanımı** | `alm_meta/domain_meta.yaml` — ALM'e özel kind'lar | MPC'ye beslenir |
| **Doğrudan MPC import** | MPC engine'leri doğrudan import edilir; adapter katmanı yok | `from mpc_workflow import WorkflowEngine` |
| **Port implementasyonları** | GuardPort, AuthPort — ALM DB/session ile | MPC interface'ini implement eder |
| **Artifact BC** | Entity, repository, CRUD, persistence | Uygulama mantığı |
| **Process Template** | Proje–template ilişkisi, manifest_bundle depolama | |
| **API / CQRS** | Router, Command/Query handler'lar | MPC sonucunu yorumlar |

---

## 3. Şu An Yanlış Yerde Olanlar (alm-app → MPC taşınacak)

Aşağıdaki kod **geçici** olarak alm-app içinde; MPC hazır olduğunda oraya taşınacak:

| alm-app dosyası | Taşınacak MPC modülü |
|-----------------|----------------------|
| `artifact/domain/workflow_engine.py` | MPC WorkflowEngine + PolicyEngine |
| `artifact/domain/action_runner.py` | alm-app'te kalır (run_actions); sadece resolver MPC'ye taşınır |
| `docs/manifest-dsl.md` (grammar/semantics) | MPC dokümantasyonu |

**Geçiş stratejisi:** alm-app, MPC'yi dependency olarak ekleyip doğrudan import ile kullanacak. Adapter katmanı yok.

---

## 4. MPC API Kullanımı (Doğrudan Library)

alm-app, MPC hazır olduğunda şu şekilde kullanacak:

```python
from mpc_workflow import WorkflowEngine
from mpc_policy import PolicyEngine
from mpc_action import get_transition_actions

wf = WorkflowEngine()
policy = PolicyEngine()

# Geçiş geçerli mi? (generic: type_id + type_kind; ALM type_kind="ArtifactType")
wf.is_valid_transition(manifest, type_id, from_state, to_state, type_kind=type_kind)

# Policy ihlalleri? (entity_snapshot: domain-agnostic dict — MPC "Artifact" bilmez)
violations = policy.check(manifest, to_state, entity_snapshot, type_id=type_id, type_kind=type_kind)

# İlk state?
wf.get_initial_state(manifest, type_id, type_kind=type_kind)

# Geçerli hedef state'ler?
wf.get_valid_transitions(manifest, type_id, current_state, type_kind=type_kind)

# Hiyerarşi (parent_types, child_types)?
wf.is_valid_parent_child(manifest, parent_type, child_type, type_kind=type_kind)

# Transition actions? (on_leave, on_enter isimleri)
actions = get_transition_actions(manifest, type_id, from_state, to_state, type_kind=type_kind)
# run_actions() alm-app'te — bildirim, log, vb.
```

---

## 4b. Generic isimlendirme önerisi (MPC’de “artifact” olmasın)

MPC’nin ALM’e özel “artifact” kelimesini taşımaması için:

| Şu an (alm-app’te) | MPC’de önerilen | Açıklama |
|--------------------|------------------|----------|
| Parametre `artifact_type` | **`type_id`** | Hangi tip (örn. `"requirement"`). Çağıran verir; MPC sadece string kullanır. |
| Sabit kind `"ArtifactType"` | **`type_kind`** (parametre) | Manifest’teki def kind adı. ALM `type_kind="ArtifactType"` geçer; başka uygulama farklı kind kullanabilir. |
| `get_artifact_type_def(...)` | **`get_type_def(manifest, type_kind, type_id)`** | Generic: kind + id ile manifest’ten tip tanımı. |
| Flat çıktı key `artifact_types` | **`types`** veya çağıranın belirttiği key | MPC generic “types” listesi döner; ALM isterse bunu `artifact_types` olarak map eder. |

**Önerilen MPC API (generic):**

- `get_workflow_engine(manifest, type_id, type_kind, ast=None)` — kind sabit değil, çağırandan gelir.
- `get_type_def(manifest, type_kind, type_id, ast=None)` — tip tanımı.
- `check_transition_policies(manifest, type_id, to_state, entity_snapshot, type_kind, ast=None)`.
- ALM çağrıları: `type_kind="ArtifactType"`, `type_id=artifact.artifact_type`.

Böylece MPC içinde “Artifact” / “artifact_type” isimleri kalmaz; kind ve tip id’yi uygulama sağlar.

---

## 5. MPC Kurulumu

MPC workspace'e eklendiğinde:

1. `c:\source\manifest-platform-core-suite` veya `alm-manifest-app/manifest-platform-core-suite` (submodule)
2. `pyproject.toml`:

   ```toml
   [tool.uv.sources]
   manifest-platform-core-suite = { path = "../manifest-platform-core-suite" }
   ```

3. Command handler'lar doğrudan MPC import'larına geçirilir.

---

## 6. Kural

**alm-app içinde yeni workflow/policy/DSL mantığı YAZILMAZ.**
Tüm bu mantık MPC'de olur; alm-app doğrudan MPC kütüphanelerini kullanır. Action handler'lar (`run_actions`) alm-app'te kalır.

— ↑ [Dokümanlar](README.md)
