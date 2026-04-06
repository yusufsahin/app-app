from alm.project.api.public_settings import (
    redact_sensitive_project_settings,
    scm_webhook_secret_configured_flags,
)


def test_flags_empty() -> None:
    assert scm_webhook_secret_configured_flags(None) == (False, False)
    assert scm_webhook_secret_configured_flags({}) == (False, False)


def test_flags_and_redact() -> None:
    s = {
        "scm_github_webhook_secret": " x ",
        "scm_gitlab_webhook_secret": "",
        "other": 1,
    }
    assert scm_webhook_secret_configured_flags(s) == (True, False)
    out = redact_sensitive_project_settings(s)
    assert out == {"other": 1}
    assert "scm_github_webhook_secret" not in out
