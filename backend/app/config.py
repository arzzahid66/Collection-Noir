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

    # ---------------------------------------------------------------------
    # Object storage for photography, Cloudflare R2.
    #
    # Every field defaults to empty, and empty means "not configured": the
    # image routes then keep the binaries in Postgres exactly as before. That
    # is what lets the test suite and a fresh clone run with no
    # credentials and no network, and it is why the migration can be deployed
    # before the bucket exists.
    #
    # `r2_public_base_url` is the bucket's public hostname, either the
    # r2.dev development URL or a custom domain, without a trailing slash.
    # It is separate from the S3 endpoint because uploads are signed against
    # the API endpoint while reads go straight to the public host.
    # ---------------------------------------------------------------------
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_base_url: str = ""

    # Overrides the derived Cloudflare endpoint. Left empty in production.
    # Set it to point the same code at S3, MinIO, or a local emulator, which
    # is how the storage path is verified end to end without a real bucket.
    r2_endpoint: str = ""

    # ---------------------------------------------------------------------
    # Enquiry notification.
    #
    # Without `resend_api_key` the notification is a logged no-op, so an
    # enquiry is still recorded and nothing fails. The address defaults to the
    # studio address the site already publishes in frontend/lib/studio.ts.
    # ---------------------------------------------------------------------
    resend_api_key: str = ""
    enquiry_notify_to: str = "info@collectionnoir.com"
    enquiry_notify_from: str = "Collection Noir <onboarding@resend.dev>"

    @property
    def storage_configured(self) -> bool:
        """Whether photography should go to R2 rather than into Postgres."""
        return bool(
            self.r2_account_id
            and self.r2_access_key_id
            and self.r2_secret_access_key
            and self.r2_bucket
        )

    @property
    def r2_endpoint_url(self) -> str:
        return self.r2_endpoint or f"https://{self.r2_account_id}.r2.cloudflarestorage.com"

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
