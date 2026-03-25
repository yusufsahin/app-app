"""MPC-unavailable / degraded-mode behavior for policy and ACL."""

from __future__ import annotations

import logging
from typing import Literal

from alm.config.settings import settings

_log = logging.getLogger(__name__)

MPCMode = Literal["strict", "degraded", "disabled"]

_STRICT_POLICY_MSG = "Manifest policy engine (MPC) is not available; strict mode cannot evaluate Policy rules."
_STRICT_ACL_MSG = "Manifest ACL engine (MPC) is not available; strict mode denies access checks."


def effective_mpc_mode() -> MPCMode:
    """Production always behaves as strict for policy/ACL; non-prod uses ALM_MPC_MODE."""
    if settings.is_production:
        return "strict"
    m = (settings.mpc_mode or "degraded").lower()
    if m in ("strict", "degraded", "disabled"):
        return m  # type: ignore[return-value]
    _log.warning("invalid_mpc_mode", raw=settings.mpc_mode, fallback="degraded")
    return "degraded"


def audit_mpc_degraded(operation: str, *, mpc_available: bool, detail: str = "") -> None:
    _log.warning(
        "mpc_degraded_mode operation=%s mpc_available=%s effective_mode=%s detail=%s",
        operation,
        mpc_available,
        effective_mpc_mode(),
        detail or "-",
    )


def policy_result_without_mpc_engine() -> tuple[bool, list[str]]:
    if effective_mpc_mode() == "strict":
        return (False, [_STRICT_POLICY_MSG])
    audit_mpc_degraded("evaluate_transition_policy", mpc_available=False)
    return (True, [])


def acl_result_without_mpc_engine() -> tuple[bool, list[str]]:
    if effective_mpc_mode() == "strict":
        return (False, [_STRICT_ACL_MSG])
    audit_mpc_degraded("acl_check", mpc_available=False)
    return (True, [])
