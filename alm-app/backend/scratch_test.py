import sys
import os

# Add src to path
sys.path.append(os.path.join(os.getcwd(), "src"))

from alm.artifact.domain.mpc_resolver import manifest_defs_to_flat

manifest = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "wf1",
            "states": ["new", "closed"],
            "transitions": [{"from": "new", "to": "closed", "trigger": "close"}]
        },
        {
            "kind": "ArtifactType",
            "id": "defect",
            "workflow_id": "wf1",
            "fields": [{"id": "title", "type": "string"}]
        }
    ]
}

flat = manifest_defs_to_flat(manifest)
print(f"Workflows: {len(flat['workflows'])}")
print(f"ArtifactTypes: {len(flat['artifact_types'])}")
assert len(flat['workflows']) == 1
assert flat['workflows'][0]['id'] == "wf1"
assert len(flat['artifact_types']) == 1
assert flat['artifact_types'][0]['id'] == "defect"
print("SUCCESS!")
