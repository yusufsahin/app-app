from alm.ai.application.sanitization import redact_pii


def test_redact_pii_masks_email_and_tokens() -> None:
    text = "contact me at test@example.com token sk-1234567890abcdef1234"
    redacted = redact_pii(text)
    assert "test@example.com" not in redacted
    assert "sk-1234567890abcdef1234" not in redacted
    assert "[redacted-email]" in redacted
    assert "[redacted-token]" in redacted
