"""Artifact gate zinciri: preflight (pytest öncesi) ve posttest (junit sonrası)."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _run(cmd: list[str]) -> int:
    print(f"+ {' '.join(cmd)}", flush=True)
    return subprocess.call(cmd, cwd=BACKEND_ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run artifact gate chain: preflight (before pytest) or posttest (after junit)"
    )
    parser.add_argument(
        "--phase",
        choices=("preflight", "posttest"),
        required=True,
        help=(
            "preflight: validate + risk + select + flaky_quarantine; "
            "posttest: derive + run_gates + publish + report + kpi_threshold_check"
        ),
    )
    args = parser.parse_args()

    if args.phase == "preflight":
        steps = [
            [sys.executable, "scripts/validate_metadata.py"],
            [sys.executable, "scripts/compute_risk.py"],
            [sys.executable, "scripts/select_tests.py"],
            [sys.executable, "scripts/flaky_quarantine_check.py"],
        ]
    else:
        steps = [
            [sys.executable, "scripts/derive_execution_report.py"],
            [sys.executable, "scripts/run_gates.py"],
            [sys.executable, "scripts/publish_gate_report.py"],
            [sys.executable, "scripts/report.py"],
            [sys.executable, "scripts/kpi_threshold_check.py"],
        ]

    for cmd in steps:
        code = _run(cmd)
        if code != 0:
            return code
    return 0


if __name__ == "__main__":
    sys.exit(main())
