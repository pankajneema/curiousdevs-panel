from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://mac@localhost:5432/agentguard_console"
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12 hours, matches the old mock session lifetime
    pending_2fa_token_expire_minutes: int = 5
    cors_origins: list[str] = ["http://localhost:5173"]
    frontend_url: str = "http://localhost:5173"

    smtp_server: str = ""
    smtp_port: int = 587
    smtp_email: str = ""
    smtp_password: str = ""

    # Live, publicly reachable — email clients (Gmail included) fetch images
    # server-side and can't reach localhost, and Gmail also strips data: URI
    # images outright, so the logo has to be a real hosted asset.
    brand_logo_url: str = "https://www.curiousdevs.com/apple-touch-icon.png"


settings = Settings()
