from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_prefix": "ALM_", "extra": "ignore"}

    app_name: str = "ALM"
    app_version: str = ""  # G4: optional, set via ALM_APP_VERSION
    environment: str = "development"  # development, staging, production (ALM_ENVIRONMENT)
    debug: bool = False

    database_url: str = "postgresql+asyncpg://alm:alm_dev_password@localhost:5432/alm"
    db_pool_size: int = 20
    db_max_overflow: int = 10

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

    seed_demo_data: bool = True  # Create demo tenant/admin when DB is empty (ALM_SEED_DEMO_DATA)

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


settings = Settings()
