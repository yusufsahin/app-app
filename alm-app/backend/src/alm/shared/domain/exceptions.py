from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import uuid


class DomainException(Exception):  # noqa: N818
    """Base for all domain exceptions. Maps to Problem Details RFC 9457."""

    status_code: int = 500
    error_type: str = "/errors/internal"
    title: str = "Internal Error"

    def __init__(self, detail: str = "") -> None:
        self.detail = detail
        super().__init__(detail)


class EntityNotFound(DomainException):
    status_code = 404
    error_type = "/errors/entity-not-found"
    title = "Entity Not Found"

    def __init__(self, entity_type: str, entity_id: uuid.UUID | str) -> None:
        super().__init__(f"{entity_type} with id '{entity_id}' does not exist or has been deleted.")


class ValidationError(DomainException):
    status_code = 422
    error_type = "/errors/validation-error"
    title = "Validation Error"


class AccessDenied(DomainException):
    status_code = 403
    error_type = "/errors/access-denied"
    title = "Access Denied"


class ConflictError(DomainException):
    status_code = 409
    error_type = "/errors/conflict"
    title = "Conflict"


class RateLimitExceeded(DomainException):
    status_code = 429
    error_type = "/errors/rate-limit-exceeded"
    title = "Rate Limit Exceeded"


class TenantQuotaExceeded(DomainException):
    status_code = 429
    error_type = "/errors/quota-exceeded"
    title = "Tenant Quota Exceeded"


class WorkflowTransitionError(DomainException):
    status_code = 422
    error_type = "/errors/invalid-transition"
    title = "Invalid Workflow Transition"


class PolicyDeniedError(ValidationError):
    """Raised when transition is valid per workflow but denied by policy/ACL (MPC)."""

    error_type = "/errors/policy-denied"
    title = "Policy Denied"


class GuardDeniedError(ValidationError):
    """Raised when transition is valid on the graph but the manifest transition guard fails."""

    error_type = "/errors/guard-denied"
    title = "Workflow Guard Failed"
