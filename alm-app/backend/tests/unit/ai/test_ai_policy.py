from __future__ import annotations

import pytest

from alm.ai.application.policy import AiPolicyEvaluator
from alm.ai.domain.value_objects import AutonomyLevel
from alm.shared.domain.exceptions import PolicyDeniedError, ValidationError


def test_validate_user_content_rejects_empty() -> None:
    policy = AiPolicyEvaluator()
    with pytest.raises(ValidationError):
        policy.validate_user_content("   ")


def test_can_use_autonomy_blocks_auto_when_disabled() -> None:
    policy = AiPolicyEvaluator()
    with pytest.raises(PolicyDeniedError):
        policy.can_use_autonomy(AutonomyLevel.AUTO)
