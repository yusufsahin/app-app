from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml

BLAST_RADIUS_SCORE = {"single": 1, "multi": 2, "cross_domain": 3}
RUNTIME_IMPACT_SCORE = {"low": 0, "medium": 1, "high": 2}
ROLLBACK_COMPLEXITY_SCORE = {"low": 0, "medium": 1, "high": 2}
RISK_LEVELS = (
    (2, "low"),
    (4, "medium"),
    (6, "high"),
    (999, "critical"),
)


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Top-level YAML object must be a mapping: {path}")
    return data


def _risk_level(score: int) -> str:
    for threshold, level in RISK_LEVELS:
        if score <= threshold:
            return level
    return "critical"


def main() -> int:
    parser = argparse.ArgumentParser(description="Compute risk score for artifact change set")
    parser.add_argument("--change-manifest", default="alm_meta/change_manifest.yaml")
    parser.add_argument("--output", default="artifacts/risk-report.json")
    args = parser.parse_args()

    try:
        change_manifest = _load_yaml(Path(args.change_manifest))
        risk_inputs = change_manifest.get("risk_inputs", {})
        if not isinstance(risk_inputs, dict):
            raise ValueError("risk_inputs must be a mapping")

        blast_radius = str(risk_inputs.get("blast_radius"))
        runtime_impact = str(risk_inputs.get("runtime_impact"))
        rollback_complexity = str(risk_inputs.get("rollback_complexity"))

        if blast_radius not in BLAST_RADIUS_SCORE:
            raise ValueError(f"Invalid blast_radius: {blast_radius}")
        if runtime_impact not in RUNTIME_IMPACT_SCORE:
            raise ValueError(f"Invalid runtime_impact: {runtime_impact}")
        if rollback_complexity not in ROLLBACK_COMPLEXITY_SCORE:
            raise ValueError(f"Invalid rollback_complexity: {rollback_complexity}")

        score = (
            BLAST_RADIUS_SCORE[blast_radius]
            + RUNTIME_IMPACT_SCORE[runtime_impact]
            + ROLLBACK_COMPLEXITY_SCORE[rollback_complexity]
        )
        level = _risk_level(score)

        report = {
            "change_set_id": change_manifest.get("change_set_id"),
            "risk_inputs": risk_inputs,
            "risk_score": score,
            "risk_level": level,
        }

        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    except (ValueError, OSError) as exc:
        print(f"[compute_risk] FAILED: {exc}")
        return 1

    print(f"[compute_risk] OK -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
