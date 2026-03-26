"""KPI eşikleri — plan: alarm / kalite kapısı (tek koşum özeti)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected mapping YAML: {path}")
    return data


def _load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected object JSON: {path}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="Check KPI snapshot vs thresholds")
    parser.add_argument("--thresholds", default="alm_meta/kpi_thresholds.yaml")
    parser.add_argument("--kpi-snapshot", default="artifacts/kpi-snapshot.json")
    parser.add_argument("--execution-report", default="artifacts/test-execution.json")
    args = parser.parse_args()

    try:
        thr_data = _load_yaml(Path(args.thresholds))
        thr = thr_data.get("thresholds", {})
        if not isinstance(thr, dict):
            raise ValueError("kpi_thresholds.yaml: thresholds must be a mapping")

        snap_path = Path(args.kpi_snapshot)
        exec_path = Path(args.execution_report)
        snapshot = _load_json(snap_path) if snap_path.exists() else {}
        execution = _load_json(exec_path) if exec_path.exists() else {}

        critical_min = int(thr.get("critical_pass_rate_min", 100))
        compat_min = int(thr.get("compatibility_success_rate_min", 95))

        cp = execution.get("critical_pass_rate")
        if cp is None:
            cp = snapshot.get("critical_pass_rate")
        if cp is not None and int(cp) < critical_min:
            print(f"[kpi_threshold_check] FAIL: critical_pass_rate {cp} < {critical_min}")
            return 1

        compat_status = execution.get("compatibility_suite_status") or snapshot.get(
            "compatibility_suite_status"
        )
        if compat_status == "failed":
            print(
                f"[kpi_threshold_check] FAIL: compatibility suite failed "
                f"(threshold min success rate {compat_min}%)"
            )
            return 1

        print("[kpi_threshold_check] OK (critical + compatibility checks)")
        print(
            "[kpi_threshold_check] NOTE: flaky_rate, coverage, traceability KPI’ları "
            "tarihsel veri gerektirir — docs/KPI_ARTIFACT_GATES.md"
        )
    except (ValueError, OSError, json.JSONDecodeError, TypeError) as exc:
        print(f"[kpi_threshold_check] FAILED: {exc}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
