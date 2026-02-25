# Guard Evaluator Security

When workflow transitions in the manifest include **guard** expressions (e.g. "only if assignee is set"), those expressions must be evaluated in a **safe** way. This document defines the security rules and the intended evaluator design.

---

## 1. Security Rules

| Rule | Requirement |
|------|-------------|
| **No eval()** | Do not use Python's `eval()` or `exec()` on user- or tenant-provided strings. |
| **No arbitrary code** | Guard expressions must not execute arbitrary Python or shell code. |
| **Whitelist only** | Only a fixed set of operators and field accesses (e.g. `assignee_id` is set, `state` equals X) are allowed. |
| **Sandbox or MPC** | Prefer MPC's expression engine if available (whitelist operators, restricted field access); otherwise use a minimal predicate evaluator with a strict whitelist. |

---

## 2. Intended Design

- **Evaluator module:** A dedicated module (e.g. `alm.artifact.domain.guard_evaluator`) that:
  - Takes a guard expression reference from the manifest and the current entity snapshot (dict).
  - Returns a boolean (guard passed or not).
  - Uses only whitelisted operations: e.g. "field present", "field equals value", "field in list". No general-purpose expression language unless provided by MPC and documented as safe.
- **Integration with Statelesspy:** When guards are added to manifest transitions, the workflow adapter will call this evaluator inside `permit_if(trigger, to_state, guard_fn)`. The guard function is a thin wrapper that calls the evaluator with the snapshot.
- **Code review:** Any change that introduces `eval`, `exec`, `compile`, or dynamic code execution on manifest/tenant data must be rejected in review.

---

## 3. Implemented Guard Types

The evaluator (`alm.artifact.domain.guard_evaluator`) supports only the following (whitelist):

| Guard (string or `{"type": "..."}`) | Meaning |
|-------------------------------------|--------|
| `assignee_required` | `entity_snapshot["assignee_id"]` is truthy |
| `field_present` with `field` | Allowed top-level or `custom_fields.<key>` (key alphanumeric + underscore); value must be truthy |
| `field_equals` with `field` and `value` | Same field rules; value must equal snapshot value |

Allowed top-level snapshot keys: `assignee_id`, `state`, `state_reason`, `resolution`, `custom_fields`. Unknown guard types evaluate to **false** (fail closed).

---

## 4. Future Work

- If using MPC's expression engine later: document allowed operators and fields; ensure tenant isolation.
- Optional: return guard failure reason in API (e.g. "Assignee required") for UX.
