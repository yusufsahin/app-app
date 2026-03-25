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

**ALM'de güncel durum:** Geçiş grafiği, permitted triggers ve transition action isimleri **`alm.artifact.domain.workflow_sm`** içinde; bu modül manifestten **`mpc.features.workflow.WorkflowEngine`** kurar. **TransitionPolicy** ve **`Policy`** kind değerlendirmesi **`mpc_resolver`**: `check_transition_policies` + `evaluate_transition_policy` → `PolicyEngine`. Ayrıntı: [WORKFLOW_ENGINE_BOUNDARY.md](WORKFLOW_ENGINE_BOUNDARY.md).

| Modül | Sorumluluk | Not |
|-------|------------|-----|
| **Manifest DSL Parser** | Lark LALR, YAML/JSON parse | DomainMeta ile birlikte |
| **DomainMeta** | Kind/type/function tanımları, metadata-driven | |
| **WorkflowEngine** | Geçiş validasyonu, initial state, permitted triggers | ALM `workflow_sm` üzerinden kullanılır |
| **PolicyEngine** | `kind: Policy` — event + `match` / `effect` | `TransitionPolicy` ayrı: `check_transition_policies` |
| **ACLEngine** | RBAC, permission check, field masking | |
| **ExpressionEngine** | `len`, `contains`, `now`, `daysBetween` | |
| **Action Resolver** | `on_enter`, `on_leave` action isimlerini döner (handler değil) | |
| **Port'lar** | GuardPort, AuthPort, SigningPort, VerificationPort (interface) | |

---

## 2. alm-app'te Olması Gerekenler (Consuming Application)

| Modül | Sorumluluk | Not |
|-------|------------|-----|
| **DomainMeta tanımı** | `alm_meta/domain_meta.yaml` — ALM'e özel kind'lar | MPC'ye beslenir |
| **Doğrudan MPC import** | `workflow_sm` ve `mpc_resolver` içinde `mpc.features.*` / `mpc.kernel.*` | Örn. `from mpc.features.workflow import WorkflowEngine` |
| **Port implementasyonları** | GuardPort, AuthPort — ALM DB/session ile | MPC interface'ini implement eder |
| **Artifact BC** | Entity, repository, CRUD, persistence | Uygulama mantığı |
| **Process Template** | Proje–template ilişkisi, manifest_bundle depolama | |
| **API / CQRS** | Router, Command/Query handler'lar | MPC sonucunu yorumlar |

---

## 3. alm-app'te kalan domain kodu

| alm-app dosyası | Rol |
|-----------------|-----|
| `artifact/domain/workflow_sm.py` | Manifest → MPC `WorkflowEngine`; tek giriş noktası grafik için |
| `artifact/domain/mpc_resolver.py` | AST cache, `check_transition_policies`, `evaluate_transition_policy`, ACL/redaction |
| `artifact/domain/action_runner.py` | `run_actions` — yan etkiler ALM'de kalır |
| `docs/manifest-dsl.md` | DSL referansı (MPC ile hizalı) |

---

## 4. MPC API — alm-app kullanım özeti

Gerçek importlar birleşik `mpc` paketinden (path: `manifest-platform-core-suite`):

```python
from mpc.kernel.ast import normalize
from mpc.kernel.meta import DomainMeta
from mpc.features.workflow import WorkflowEngine
from mpc.features.policy import PolicyEngine

# workflow_sm: WorkflowEngine.from_fixture_input(wf_def, expr_engine=...) ile grafik
# mpc_resolver: ast = normalize(manifest_bundle)
# PolicyEngine(ast=ast, meta=DomainMeta()).evaluate(event, actor_roles=[...])
# TransitionPolicy: mpc_resolver.check_transition_policies(ast, event)
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

**Önerilen ALM yüzeyi (generic type_kind):**

- Grafik: `workflow_sm`: `is_valid_transition`, `get_permitted_triggers`, `get_initial_state`, `get_transition_actions` (`type_kind="ArtifactType"`).
- Tip tanımı: `mpc_resolver.get_type_def` / `get_artifact_type_def`.
- Policy event: `mpc_resolver.build_artifact_transition_policy_event` + `check_transition_policies(ast, event)` + `evaluate_transition_policy(ast, event, actor_roles)`.

Böylece MPC içinde “Artifact” / “artifact_type” isimleri kalmaz; kind ve tip id’yi uygulama sağlar.

---

## 4c. Policy fallback (MPC kurulu değilken)

MPC yüklü olmadığında (örn. Docker build'te path dependency eksik) alm-app sınırlı bir fallback ile çalışır:

| Ne | MPC varken | Fallback (MPC paketi yok) |
|----|-------------|------------------------|
| **TransitionPolicy (manifest)** | `check_transition_policies(ast, event)` — AST fallback ile `defs` okunur | Aynı fonksiyon fallback AST üzerinde çalışır |
| **Policy (kind)** | `evaluate_transition_policy` → `PolicyEngine` | `PolicyEngine` atlanır; `(True, [])` |
| **ACL** | `acl_check` → ACLEngine | `(True, [])` |

**Kural:** `TransitionPolicy` basit kuralları `check_transition_policies` içinde tutulur; tam `Policy` / ACL için `mpc` kurulu olmalı.

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
