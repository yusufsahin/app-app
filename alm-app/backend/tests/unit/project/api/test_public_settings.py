from alm.project.api.public_settings import (
    redact_sensitive_project_settings,
    scm_webhook_secret_configured_flags,
)


def test_flags_empty() -> None:
    assert scm_webhook_secret_configured_flags(None) == (False, False, False)
    assert scm_webhook_secret_configured_flags({}) == (False, False, False)


def test_flags_and_redact() -> None:
    s = {
        "scm_github_webhook_secret": " x ",
        "scm_gitlab_webhook_secret": "",
        "other": 1,
    }
    assert scm_webhook_secret_configured_flags(s) == (True, False, False)
    out = redact_sensitive_project_settings(s)
    assert out == {"other": 1}
    assert "scm_github_webhook_secret" not in out


def test_flags_ado_configured() -> None:
    s = {"scm_azuredevops_webhook_secret": "secret"}
    assert scm_webhook_secret_configured_flags(s) == (False, False, True)
    out = redact_sensitive_project_settings(s)
    assert out == {}
