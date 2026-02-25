"""D1: Field masking (ACL) for artifact responses.

Masks sensitive fields based on user privileges. Users without
artifact:read_sensitive cannot see configured sensitive custom_fields keys.
See docs/D1_POLICY_ACL_INTEGRATION.md.
"""

from __future__ import annotations

# Custom field keys that require artifact:read_sensitive to be visible
SENSITIVE_CUSTOM_FIELD_KEYS: frozenset[str] = frozenset({"internal_notes", "confidential"})

PERMISSION_READ_SENSITIVE = "artifact:read_sensitive"


def mask_artifact_response(data: dict, user_privileges: list[str]) -> dict:
    """Return a copy of artifact response dict with sensitive fields masked for the user."""
    if _has_sensitive_permission(user_privileges):
        return dict(data)
    out = dict(data)
    custom = out.get("custom_fields")
    if isinstance(custom, dict) and custom:
        out["custom_fields"] = {
            k: v for k, v in custom.items() if k not in SENSITIVE_CUSTOM_FIELD_KEYS
        }
    return out


def _has_sensitive_permission(codes: list[str]) -> bool:
    from alm.shared.infrastructure.security.dependencies import _matches_permission
    return _matches_permission(codes, PERMISSION_READ_SENSITIVE)


# Permission-aware UI: map privilege codes to allowed action names for artifact
_ARTIFACT_ACTION_PERMISSIONS: list[tuple[str, str]] = [
    ("read", "artifact:read"),
    ("update", "artifact:update"),
    ("delete", "artifact:delete"),
    ("transition", "artifact:transition"),
    ("create", "artifact:create"),
    ("comment", "artifact:comment"),
]


def allowed_actions_for_artifact(privileges: list[str]) -> list[str]:
    """Return list of action names the user can perform on artifacts (for Permission-aware UI)."""
    from alm.shared.infrastructure.security.dependencies import _matches_permission
    actions: list[str] = []
    for action, perm in _ARTIFACT_ACTION_PERMISSIONS:
        if _matches_permission(privileges, perm):
            actions.append(action)
    # Restore uses artifact:update
    if "update" in actions and "restore" not in actions:
        actions.append("restore")
    return actions


async def mask_artifact_for_user(resp: "ArtifactResponse", user: "CurrentUser") -> "ArtifactResponse":
    """Async helper: resolve user privileges, mask sensitive fields, add allowed_actions."""
    from alm.shared.infrastructure.security.dependencies import get_user_privileges
    from alm.artifact.api.schemas import ArtifactResponse

    codes = await get_user_privileges(user.tenant_id, user.id)
    data = resp.model_dump()
    masked = mask_artifact_response(data, codes)
    masked["allowed_actions"] = allowed_actions_for_artifact(codes)
    return ArtifactResponse(**masked)


async def mask_artifact_list_for_user(
    items: list["ArtifactResponse"], user: "CurrentUser"
) -> list["ArtifactResponse"]:
    """Mask a list of artifact responses and add allowed_actions (fetches user privileges once)."""
    from alm.shared.infrastructure.security.dependencies import get_user_privileges
    from alm.artifact.api.schemas import ArtifactResponse

    codes = await get_user_privileges(user.tenant_id, user.id)
    actions = allowed_actions_for_artifact(codes)
    result: list["ArtifactResponse"] = []
    for i in items:
        data = mask_artifact_response(i.model_dump(), codes)
        data["allowed_actions"] = actions
        result.append(ArtifactResponse(**data))
    return result
