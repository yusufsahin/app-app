"""One-off helper: split orgs/api/router.py into _router_deps + routes_*.py + thin router.py."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src" / "alm" / "orgs" / "api"
ROUTER = ROOT / "router.py"


def main() -> None:
    lines = ROUTER.read_text(encoding="utf-8").splitlines(keepends=True)
    if not lines[0].startswith('"""'):
        raise SystemExit("unexpected router.py format")
    deps = "".join(lines[1:206])
    if len(deps.strip()) < 500:
        raise SystemExit(
            "router.py looks too small to extract deps (already split?). Restore monolithic router before re-running.",
        )

    (ROOT / "_router_deps.py").write_text(
        '"""Shared imports for orgs API route modules (wildcard import)."""\n' + deps,
        encoding="utf-8",
    )

    body_lines = lines[210:]
    sections: list[list[str]] = []
    current: list[str] = []
    for line in body_lines:
        if line.startswith("# ── ") and current:
            sections.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        sections.append(current)

    route_modules: list[tuple[str, str]] = []
    batch_mod: str | None = None
    for sec in sections:
        header = sec[0].strip()
        m = re.match(r"# ── (.+) ──", header)
        title = m.group(1) if m else "misc"
        slug = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")
        mod = f"routes_{slug}.py"
        route_modules.append((mod, title))
        text = "".join(sec)
        if "async def batch_transition_artifacts" in text:
            batch_mod = mod
        body = text
        if slug == "org_tenant":
            body = body.replace('@router.get("")', '@router.get("/")').replace('@router.put("")', '@router.put("/")')
        out = (
            f'"""Org API routes: {title}."""\n\n'
            "from fastapi import APIRouter\n\n"
            "from alm.orgs.api._router_deps import *  # noqa: F403\n\n"
            "router = APIRouter()\n\n"
            + body
        )
        (ROOT / mod).write_text(out, encoding="utf-8")

    imports = "\n".join(
        f"from alm.orgs.api.{Path(mod).stem} import router as {alias}"
        for alias, (mod, _) in zip(_aliases(route_modules), route_modules)
    )
    batch_line = ""
    if batch_mod:
        batch_line = (
            f"\nfrom alm.orgs.api.{Path(batch_mod).stem} "
            "import batch_transition_artifacts  # noqa: F401 — tests\n"
        )

    main_router = (
        '"""Azure DevOps-style org router: /orgs/{org_slug}/..."""\n\n'
        f"{imports}\n"
        'from fastapi import APIRouter\n\n'
        "router = APIRouter(prefix=\"/orgs/{org_slug}\", tags=[\"orgs\"])\n"
        + "".join(
            f"router.include_router({alias})\n"
            for alias in _aliases(route_modules)
        )
        + batch_line
    )
    ROUTER.write_text(main_router, encoding="utf-8")


def _aliases(mods: list[tuple[str, str]]) -> list[str]:
    return [f"_r{i}" for i in range(len(mods))]


if __name__ == "__main__":
    main()
