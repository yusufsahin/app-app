from typing import Literal

from pydantic_settings import BaseSettings

# Weak defaults — rejected when ALM_ENVIRONMENT=production (see startup validation in main.py).
_FORBIDDEN_JWT_SECRET_VALUES = frozenset(
    {
        "CHANGE-ME-IN-PRODUCTION",
        "change-me-in-production",
        "",
    },
)


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_prefix": "ALM_", "extra": "ignore"}

    app_name: str = "ALM"
    app_version: str = ""  # G4: optional, set via ALM_APP_VERSION
    environment: str = "development"  # development, staging, production (ALM_ENVIRONMENT)
    debug: bool = False

    database_url: str = "postgresql+asyncpg://alm:alm_dev_password@localhost:5433/alm"
    db_pool_size: int = 20
    db_max_overflow: int = 10

    # Background retry for transactional domain-event outbox (same DB transaction as aggregates).
    domain_event_outbox_poll_interval_seconds: float = 5.0  # ALM_DOMAIN_EVENT_OUTBOX_POLL_INTERVAL_SECONDS; <=0 disables worker
    domain_event_outbox_batch_size: int = 50  # ALM_DOMAIN_EVENT_OUTBOX_BATCH_SIZE
    domain_event_outbox_max_attempts: int = 50  # ALM_DOMAIN_EVENT_OUTBOX_MAX_ATTEMPTS — rows stop polling after this
    domain_event_outbox_lease_seconds: int = 300  # ALM_DOMAIN_EVENT_OUTBOX_LEASE_SECONDS — claim TTL; exceed only if handlers stay shorter
    # If set, /health/ready returns status=degraded when domain_event_outbox row count exceeds this (ALM_...).
    domain_event_outbox_readiness_max_pending: int | None = None
    # If true, readiness is degraded when attempts >= max_attempts rows exist (ALM_DOMAIN_EVENT_OUTBOX_READINESS_DEGRADE_ON_EXHAUSTED).
    domain_event_outbox_readiness_degrade_on_exhausted: bool = False
    # Hard cap for POST .../requeue-exhausted per request (ALM_DOMAIN_EVENT_OUTBOX_REQUEUE_MAX_PER_REQUEST).
    domain_event_outbox_requeue_max_per_request: int = 500

    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    cors_origins: list[str] = ["http://localhost:5173"]

    rate_limit_requests_per_minute: int = 60
    rate_limit_window_seconds: int = 60  # Sliding window size (Faz D2)

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_from: str = "noreply@alm.local"
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_tls: bool = False
    base_url: str = "http://localhost:5173"

    upload_dir: str = "uploads"  # Local directory for artifact attachments (ALM_UPLOAD_DIR)

    # Demo tenant/user/projects only (non-production); privilege + process template seeds run regardless.
    seed_demo_data: bool = False  # ALM_SEED_DEMO_DATA — set true for local demo seed

    # PostgreSQL text search config for artifact FTS (whitelist enforced in repository). ALM_FULLTEXT_SEARCH_CONFIG
    fulltext_search_config: str = "english"

    # Default process template slug when creating a project without template. ALM_DEFAULT_PROCESS_TEMPLATE_SLUG
    # Org override: tenant.settings["default_process_template_slug"] (see CreateProjectHandler).
    default_process_template_slug: str = "basic"

    # strict: deny policy/ACL when MPC missing; degraded|disabled: permissive fallback + audit (non-prod only)
    mpc_mode: Literal["strict", "degraded", "disabled"] = "degraded"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def is_dev(self) -> bool:
        return self.environment.lower() == "development"

    def validate_production_config(self) -> None:
        """Refuse weak JWT secrets and demo seeding in production. Call during application startup."""
        if not self.is_production:
            return
        if self.seed_demo_data:
            msg = "ALM_SEED_DEMO_DATA must be false in production"
            raise RuntimeError(msg)
        key = self.jwt_secret_key.strip()
        if len(key) < 32:
            msg = "ALM_JWT_SECRET_KEY must be set to a strong secret (at least 32 characters) in production"
            raise RuntimeError(msg)
        if key in _FORBIDDEN_JWT_SECRET_VALUES or key.lower() == "change-me-in-production":
            msg = (
                "ALM_JWT_SECRET_KEY uses a documented placeholder value; set a unique secret in production "
                "(see deployment docs)."
            )
            raise RuntimeError(msg)


settings = Settings()
