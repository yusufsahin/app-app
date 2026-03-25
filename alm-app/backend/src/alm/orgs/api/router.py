"""Azure DevOps-style org router: /orgs/{org_slug}/..."""

from fastapi import APIRouter

from alm.orgs.api.routes_area_nodes_project_area_tree_pamera_areanode_like import router as _r11
from alm.orgs.api.routes_artifact_links_traceability import router as _r4
from alm.orgs.api.routes_attachments_artifact_file_upload_download import router as _r5
from alm.orgs.api.routes_comments_artifact_linked import router as _r3
from alm.orgs.api.routes_cycle_nodes_planning_tree_pamera_iterationnode_like import router as _r8
from alm.orgs.api.routes_dashboard import router as _r12
from alm.orgs.api.routes_members import router as _r13
from alm.orgs.api.routes_org_tenant import router as _r0
from alm.orgs.api.routes_projects import (
    batch_transition_artifacts,  # noqa: F401 — tests
)
from alm.orgs.api.routes_projects import (
    router as _r1,
)
from alm.orgs.api.routes_roles import router as _r14
from alm.orgs.api.routes_saved_queries import router as _r6
from alm.orgs.api.routes_tasks_artifact_linked import router as _r2
from alm.orgs.api.routes_teams_p6 import router as _r9
from alm.orgs.api.routes_velocity_p4 import router as _r10
from alm.orgs.api.routes_workflow_rules_automation import router as _r7

router = APIRouter(prefix="/orgs/{org_slug}", tags=["orgs"])
router.include_router(_r0)
router.include_router(_r1)
router.include_router(_r2)
router.include_router(_r3)
router.include_router(_r4)
router.include_router(_r5)
router.include_router(_r6)
router.include_router(_r7)
router.include_router(_r8)
router.include_router(_r9)
router.include_router(_r10)
router.include_router(_r11)
router.include_router(_r12)
router.include_router(_r13)
router.include_router(_r14)
