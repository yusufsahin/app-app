"""Run Ruff on ``tests/`` with CI/Gate-select rules (select/ignore live here — keep workflows in sync)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TESTS_SELECT = "E,W,F,I,SIM,UP,N,RUF,PLC,TRY,PTH"
TESTS_IGNORE = "E501,PLC0415,TRY003"


def main() -> int:
    cmd = [
        sys.executable,
        "-m",
        "ruff",
        "check",
        "tests",
        "--select",
        TESTS_SELECT,
        "--ignore",
        TESTS_IGNORE,
    ]
    return subprocess.run(cmd, cwd=ROOT, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
