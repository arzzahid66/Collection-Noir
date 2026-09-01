from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration.

    Read from `.env` at the repository root, then from `backend/.env` if it
    exists, which wins. Paths are absolute so the values load the same whether
    the server is started from the repository root or from `backend`.

    The administrator credential lives here rather than in source so it stays
    out of the repository. From the administrator's point of view it behaves as
    a single fixed login.
    """

    model_config = SettingsConfigDict(
        env_file=(_REPO_ROOT / ".env", _BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://localhost/collectionnoir"

    admin_email: str = "admin@collectionnoir.com"
    admin_password: str = "change-this-before-any-deploy"

    session_secret: str = "development-only-secret"
    session_max_age: int = 60 * 60 * 12  # twelve hours
    cookie_secure: bool = False

    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """The connection string with an explicit driver.

        Neon hands out a plain `postgresql://` string. SQLAlchemy maps that to
        psycopg2, which is not installed and is not what this project uses, so
        the psycopg3 driver is named explicitly. Pasting the string straight
        from the Neon dashboard therefore works without editing it.
        """
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
