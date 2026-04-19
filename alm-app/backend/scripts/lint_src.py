"""Run Ruff on ``src/`` using ``pyproject.toml`` defaults — same entry point as CI."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    cmd = [sys.executable, "-m", "ruff", "check", "src"]
    return subprocess.run(cmd, cwd=ROOT, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
