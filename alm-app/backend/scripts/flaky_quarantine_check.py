"""Release tier: quarantine listesindeki kritik testler seçiliyse gate öncesi fail."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import yaml


def _load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected object JSON: {path}")
    return data


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected mapping YAML: {path}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="Block release gate if quarantined critical tests are selected")
    parser.add_argument("--quarantine-file", default="alm_meta/flaky_quarantine.yaml")
    parser.add_argument("--selected-tests", default="artifacts/selected-tests.json")
    parser.add_argument("--test-manifest", default="alm_meta/test_manifest.yaml")
    args = parser.parse_args()

    tier = (os.environ.get("GATE_TIER") or "pr").strip().lower()
    if tier != "release":
        print(f"[flaky_quarantine] SKIP (GATE_TIER={tier!r}, need release)")
        return 0

    try:
        quarantine = _load_yaml(Path(args.quarantine_file))
        selected = _load_json(Path(args.selected_tests))
        manifest = _load_yaml(Path(args.test_manifest))

        raw_list = quarantine.get("quarantined_test_ids", [])
        if not isinstance(raw_list, list):
            raise ValueError("quarantined_test_ids must be a list")
        quarantined = {str(x) for x in raw_list}

        tests = manifest.get("tests", [])
        if not isinstance(tests, list):
            raise ValueError("test_manifest.tests must be a list")
        critical_by_id = {
            str(t.get("test_id")): str(t.get("criticality"))
            for t in tests
            if isinstance(t, dict) and t.get("test_id")
        }

        selected_ids = selected.get("selected_tests", [])
        if not isinstance(selected_ids, list):
            raise ValueError("selected_tests.selected_tests must be a list")

        conflicts: list[str] = []
        for tid in selected_ids:
            tid_s = str(tid)
            if tid_s not in quarantined:
                continue
            if critical_by_id.get(tid_s) == "critical":
                conflicts.append(tid_s)

        if conflicts:
            print(
                "[flaky_quarantine] FAIL: critical tests are quarantined and must not run on release tier: "
                f"{conflicts}"
            )
            return 1
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"[flaky_quarantine] FAILED: {exc}")
        return 1

    print("[flaky_quarantine] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
