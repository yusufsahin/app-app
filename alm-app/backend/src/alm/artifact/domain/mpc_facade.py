"""Optional MPC package: normalize, policy, ACL, redaction engines."""

from __future__ import annotations

from typing import Any

try:
    from mpc.features.acl import ACLEngine
    from mpc.features.policy import PolicyEngine, PolicyResult
    from mpc.features.redaction import RedactionConfig, RedactionEngine
    from mpc.kernel.ast import ASTNode, ManifestAST, normalize
    from mpc.kernel.meta import DomainMeta

    Redactor = RedactionEngine
    HAS_MPC = True
except ModuleNotFoundError:
    HAS_MPC = False
    ManifestAST = Any  # type: ignore[misc, assignment]
    ASTNode = Any  # type: ignore[misc, assignment]
    PolicyEngine = None  # type: ignore[misc, assignment]
    PolicyResult = Any  # type: ignore[misc, assignment]
    DomainMeta = None  # type: ignore[misc, assignment]
    ACLEngine = None  # type: ignore[misc, assignment]
    RedactionConfig = Any  # type: ignore[misc, assignment]
    RedactionEngine = None  # type: ignore[misc, assignment]
    Redactor = None  # type: ignore[misc, assignment]
    normalize = None  # type: ignore[misc, assignment]


def mpc_normalize(manifest_bundle: dict[str, Any]) -> Any:
    """Parse manifest with MPC kernel; caller must ensure HAS_MPC."""
    if not HAS_MPC or normalize is None:
        raise RuntimeError("MPC normalize requested but mpc package is not available")
    return normalize(manifest_bundle)


def policy_engine_evaluate(
    ast: Any,
    event: dict[str, Any],
    actor_roles: list[str],
) -> tuple[bool, list[str]]:
    """Returns (allow, denial messages). On engine error, returns (False, [msg])."""
    if not HAS_MPC or PolicyEngine is None or DomainMeta is None:
        raise RuntimeError("MPC PolicyEngine not available")
    meta = DomainMeta()
    engine = PolicyEngine(ast=ast, meta=meta)
    result: PolicyResult = engine.evaluate(event, actor_roles=actor_roles)
    if result.allow:
        return (True, [])
    return (False, [str(getattr(r, "summary", "") or "") for r in result.reasons])


def acl_engine_check(
    ast: Any,
    action: str,
    resource: str,
    actor_roles: list[str],
) -> tuple[bool, list[str]]:
    if not HAS_MPC or ACLEngine is None:
        raise RuntimeError("MPC ACLEngine not available")
    engine = ACLEngine(ast)
    result = engine.check(
        action=action,
        resource=resource,
        actor_roles=actor_roles or [],
    )
    allowed = getattr(result, "allowed", getattr(result, "allow", True))
    if allowed:
        return (True, [])
    reasons = getattr(result, "reasons", [])
    if isinstance(reasons, list) and reasons:
        return (False, [str(getattr(r, "summary", str(r))) for r in reasons])
    return (False, ["ACL denied"])


def redaction_engine_redact(ast: Any, data: dict[str, Any], actor_roles: list[str]) -> dict[str, Any]:
    if not HAS_MPC or RedactionEngine is None or RedactionConfig is None:
        raise RuntimeError("MPC RedactionEngine not available")
    from alm.artifact.domain.manifest_ast import get_defs_by_kind  # noqa: PLC0415

    deny_keys: set[str] = set()
    redact_defs = get_defs_by_kind(ast, "Redact")
    for rd in redact_defs:
        rules = rd.properties.get("rules", [])
        for rule in rules:
            field_name = rule.get("field")
            if not field_name:
                continue
            rule_roles = rule.get("roles", [rule.get("role")]) if "roles" in rule or "role" in rule else []
            if not rule_roles or any(r in actor_roles for r in rule_roles):
                effect = rule.get("effect", "mask")
                if effect == "mask":
                    deny_keys.add(field_name)

    config = RedactionConfig(deny_keys=frozenset(deny_keys))
    engine = RedactionEngine(config=config)
    return engine.redact(data)
