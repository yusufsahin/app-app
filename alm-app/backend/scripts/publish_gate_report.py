from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import yaml

ENGINE_VERSION = "1.1.0"


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Top-level YAML object must be a mapping: {path}")
    return data


def _load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Top-level JSON object must be an object: {path}")
    return data


def _hash_inputs(files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.read_bytes())
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish unified artifact-native gate report")
    parser.add_argument("--change-manifest", default="alm_meta/change_manifest.yaml")
    parser.add_argument("--risk-report", default="artifacts/risk-report.json")
    parser.add_argument("--selected-tests", default="artifacts/selected-tests.json")
    parser.add_argument("--gate-evaluation", default="artifacts/gate-evaluation.json")
    parser.add_argument("--output", default="artifacts/gate-report.json")
    args = parser.parse_args()

    try:
        change_manifest_path = Path(args.change_manifest)
        risk_path = Path(args.risk_report)
        selected_path = Path(args.selected_tests)
        eval_path = Path(args.gate_evaluation)

        change_manifest = _load_yaml(change_manifest_path)
        risk_report = _load_json(risk_path)
        selected_tests = _load_json(selected_path)
        gate_evaluation = _load_json(eval_path)

        input_hash = _hash_inputs([change_manifest_path, risk_path, selected_path, eval_path])

        gate_report = {
            "change_set_id": change_manifest.get("change_set_id"),
            "engine_version": ENGINE_VERSION,
            "input_hash": input_hash,
            "gate_tier": selected_tests.get("gate_tier"),
            "selection_engine_version": selected_tests.get("selection_engine_version"),
            "computed_suites": selected_tests.get("computed_suites", []),
            "selected_suites": selected_tests.get("required_suites", []),
            "selected_tests": selected_tests.get("selected_tests", []),
            "results": {
                "risk_level": risk_report.get("risk_level"),
                "risk_score": risk_report.get("risk_score"),
                "gate_checks": gate_evaluation.get("gate_checks", {}),
            },
            "decision": gate_evaluation.get("decision", "fail"),
            "block_reasons": gate_evaluation.get("block_reasons", []),
        }

        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(gate_report, indent=2), encoding="utf-8")
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"[publish_gate_report] FAILED: {exc}")
        return 1

    print(f"[publish_gate_report] OK -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
