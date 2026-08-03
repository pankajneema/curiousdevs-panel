from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://mac@localhost:5432/agentguard_console"
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12 hours, matches the old mock session lifetime
    pending_2fa_token_expire_minutes: int = 5
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
