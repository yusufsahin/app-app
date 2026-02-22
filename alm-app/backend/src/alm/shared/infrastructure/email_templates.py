from __future__ import annotations

from alm.config.settings import settings


def invitation_email_html(
    email: str,
    tenant_name: str,
    inviter_name: str,
    invite_token: str,
    roles: list[str],
) -> tuple[str, str]:
    """Returns (subject, html_body) for an invitation email."""
    accept_url = f"{settings.base_url}/accept-invite?token={invite_token}"
    role_list = ", ".join(roles) if roles else "Member"

    subject = f"You've been invited to {tenant_name}"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Inter', 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 40px 0; }}
            .container {{ max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #1565c0, #0d47a1); padding: 32px; text-align: center; }}
            .header h1 {{ color: #fff; margin: 0; font-size: 24px; font-weight: 700; }}
            .body {{ padding: 32px; color: #333; line-height: 1.6; }}
            .body h2 {{ color: #1565c0; margin-top: 0; }}
            .role-badge {{ display: inline-block; background: #e3f2fd; color: #1565c0; padding: 4px 12px; border-radius: 16px; font-size: 13px; font-weight: 600; margin: 2px; }}
            .btn {{ display: inline-block; background: #1565c0; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }}
            .btn:hover {{ background: #0d47a1; }}
            .footer {{ padding: 20px 32px; background: #fafafa; font-size: 13px; color: #999; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>ALM</h1>
            </div>
            <div class="body">
                <h2>You're invited!</h2>
                <p><strong>{inviter_name}</strong> has invited you to join <strong>{tenant_name}</strong> on ALM.</p>
                <p>Your role: <span class="role-badge">{role_list}</span></p>
                <p style="text-align: center;">
                    <a href="{accept_url}" class="btn">Accept Invitation</a>
                </p>
                <p style="font-size: 13px; color: #666;">Or copy this link: {accept_url}</p>
                <p style="font-size: 13px; color: #999;">This invitation expires in 7 days.</p>
            </div>
            <div class="footer">
                &copy; ALM &mdash; Application Lifecycle Management
            </div>
        </div>
    </body>
    </html>
    """
    return subject, html
