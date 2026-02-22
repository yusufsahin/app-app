from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_prefix": "ALM_"}

    app_name: str = "ALM"
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

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_from: str = "noreply@alm.local"
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_tls: bool = False
    base_url: str = "http://localhost:5173"


settings = Settings()
