# MPC – ALM Sınır Belgesi

`manifest-platform-core-suite` (MPC) ile `alm-app` arasındaki sorumluluk ayrımı.

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

# Geçiş geçerli mi?
wf.is_valid_transition(manifest, artifact_type, from_state, to_state)

# Policy ihlalleri? (entity_snapshot: artifact.to_snapshot_dict())
violations = policy.check(manifest, artifact_type, from_state, to_state, artifact.to_snapshot_dict())

# İlk state?
wf.get_initial_state(manifest, artifact_type)

# Geçerli hedef state'ler?
wf.get_valid_transitions(manifest, artifact_type, current_state)

# Hiyerarşi (parent_types, child_types)?
wf.is_valid_parent_child(manifest, parent_type, child_type)

# Transition actions? (on_leave, on_enter isimleri)
actions = get_transition_actions(manifest, artifact_type, from_state, to_state)
# run_actions() alm-app'te — bildirim, log, vb.
```

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
