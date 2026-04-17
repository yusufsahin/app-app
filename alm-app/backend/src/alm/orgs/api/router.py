"""Azure DevOps-style org router: /orgs/{org_slug}/..."""

from fastapi import APIRouter

from alm.orgs.api.routes_area_nodes_project_area_tree_pamera_areanode_like import router as _r11
from alm.orgs.api.routes_artifact_relationships import router as _r20
from alm.orgs.api.routes_attachments_artifact_file_upload_download import router as _r5
from alm.orgs.api.routes_capacity_p7 import router as _r17
from alm.orgs.api.routes_comments_by_artifact import router as _r3
from alm.orgs.api.routes_cycle_nodes_planning_tree_pamera_iterationnode_like import router as _r8
from alm.orgs.api.routes_artifact_traceability_summary import router as _r12b
from alm.orgs.api.routes_deploy_webhook import router as _r26
from alm.orgs.api.routes_dashboard import router as _r12
from alm.orgs.api.routes_deployment_events import router as _r25
from alm.orgs.api.routes_github_webhook import router as _r21
from alm.orgs.api.routes_gitlab_webhook import router as _r22
from alm.orgs.api.routes_members import router as _r13
from alm.orgs.api.routes_org_tenant import router as _r0
from alm.orgs.api.routes_project_tags import router as _r15
from alm.orgs.api.routes_projects import (
    batch_transition_artifacts,  # noqa: F401 — tests
)
from alm.orgs.api.routes_projects import (
    router as _r1,
)
from alm.orgs.api.routes_quality_execution_resolve import router as _r19
from alm.orgs.api.routes_quality_last_execution import router as _r16
from alm.orgs.api.routes_requirement_coverage import router as _r18
from alm.orgs.api.routes_report_definitions import router as _r28
from alm.orgs.api.routes_reporting import router as _r27
from alm.orgs.api.routes_roles import router as _r14
from alm.orgs.api.routes_saved_queries import router as _r6
from alm.orgs.api.routes_scm_links_by_artifact import router as _r23
from alm.orgs.api.routes_scm_webhook_unmatched import router as _r24
from alm.orgs.api.routes_tasks_by_artifact import router as _r2
from alm.orgs.api.routes_teams_p6 import router as _r9
from alm.orgs.api.routes_velocity_p4 import router as _r10
from alm.orgs.api.routes_workflow_rules_automation import router as _r7

router = APIRouter(prefix="/orgs/{org_slug}", tags=["orgs"])
router.include_router(_r0)
router.include_router(_r1)
router.include_router(_r15)
router.include_router(_r2)
router.include_router(_r3)
router.include_router(_r20)
router.include_router(_r5)
router.include_router(_r6)
router.include_router(_r7)
router.include_router(_r8)
router.include_router(_r9)
router.include_router(_r10)
router.include_router(_r11)
router.include_router(_r12)
router.include_router(_r12b)
router.include_router(_r13)
router.include_router(_r14)
router.include_router(_r16)
router.include_router(_r17)
router.include_router(_r18)
router.include_router(_r27)
router.include_router(_r28)
router.include_router(_r19)
router.include_router(_r21)
router.include_router(_r22)
router.include_router(_r26)
router.include_router(_r23)
router.include_router(_r24)
router.include_router(_r25)
