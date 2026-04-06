"""Ensure LinkType from_types/to_types only reference defined ArtifactType ids."""

from __future__ import annotations

from typing import Any


def validate_link_type_artifact_refs(manifest_bundle: dict[str, Any] | None) -> list[str]:
    """Return human-readable errors; empty list means OK.

    Only ``defs`` entries with ``kind == "ArtifactType"`` and ``kind == "LinkType"`` are considered.
    Non-list ``from_types`` / ``to_types`` are skipped. Empty type ids are ignored.
    """
    if not manifest_bundle:
        return []
    defs = manifest_bundle.get("defs")
    if not isinstance(defs, list):
        return []

    artifact_ids: set[str] = set()
    for d in defs:
        if not isinstance(d, dict):
            continue
        if d.get("kind") != "ArtifactType":
            continue
        aid = d.get("id")
        if aid:
            artifact_ids.add(str(aid).strip().lower())

    errors: list[str] = []
    for d in defs:
        if not isinstance(d, dict) or d.get("kind") != "LinkType":
            continue
        lid = str(d.get("id") or "?").strip() or "?"
        for field, label in (("from_types", "from"), ("to_types", "to")):
            raw = d.get(field)
            if not isinstance(raw, list):
                continue
            for x in raw:
                tid = str(x or "").strip().lower()
                if not tid:
                    continue
                if tid not in artifact_ids:
                    errors.append(
                        f"LinkType {lid!r} {label}_types references unknown artifact type {tid!r}"
                    )
    return errors
