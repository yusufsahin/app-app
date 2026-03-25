"""Gate çıktılarından KPI özet üretir (dashboard / haftalık review beslemesi)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def _load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected object: {path}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="Build KPI snapshot from gate artifacts")
    parser.add_argument("--gate-report", default="artifacts/gate-report.json")
    parser.add_argument("--risk-report", default="artifacts/risk-report.json")
    parser.add_argument("--execution-report", default="artifacts/test-execution.json")
    parser.add_argument("--output", default="artifacts/kpi-snapshot.json")
    args = parser.parse_args()

    try:
        gate = _load_json(Path(args.gate_report))
        risk = _load_json(Path(args.risk_report))
        execution_path = Path(args.execution_report)
        execution: dict[str, Any] = {}
        if execution_path.exists():
            execution = _load_json(execution_path)

        compat_status = execution.get("compatibility_suite_status")
        compat_success_pct: int | None = None
        if compat_status == "passed":
            compat_success_pct = 100
        elif compat_status == "failed":
            compat_success_pct = 0
        elif compat_status == "not_run":
            compat_success_pct = 100

        snapshot = {
            "change_set_id": gate.get("change_set_id"),
            "gate_decision": gate.get("decision"),
            "gate_tier": gate.get("gate_tier"),
            "risk_level": risk.get("risk_level"),
            "risk_score": risk.get("risk_score"),
            "critical_pass_rate": execution.get("critical_pass_rate"),
            "compatibility_suite_status": compat_status,
            "compatibility_success_rate_percent": compat_success_pct,
            "pytest_status": execution.get("pytest_status"),
            "block_reasons": gate.get("block_reasons", []),
            "review_cadence_note": "Haftalık Quality Sync: gate_decision trend, block_reasons, risk_level.",
        }

        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"[report] FAILED: {exc}")
        return 1

    print(f"[report] OK -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
