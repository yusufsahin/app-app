from __future__ import annotations

from unittest.mock import patch

from alm.shared.infrastructure.email_templates import invitation_email_html


class TestInvitationEmailHtml:
    def test_generates_subject_and_accept_link(self) -> None:
        with patch("alm.shared.infrastructure.email_templates.settings.base_url", "https://app.example"):
            subject, html = invitation_email_html(
                email="u@example.com",
                tenant_name="Acme",
                inviter_name="Admin",
                invite_token="tok-123",
                roles=["admin", "member"],
            )

        assert subject == "You've been invited to Acme"
        assert "https://app.example/accept-invite?token=tok-123" in html
        assert "Admin" in html
        assert "admin, member" in html

    def test_defaults_role_text_when_roles_empty(self) -> None:
        with patch("alm.shared.infrastructure.email_templates.settings.base_url", "https://app.example"):
            _, html = invitation_email_html(
                email="u@example.com",
                tenant_name="Acme",
                inviter_name="Admin",
                invite_token="tok-123",
                roles=[],
            )

        assert "Member" in html
