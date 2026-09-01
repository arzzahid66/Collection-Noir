from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

# pool_pre_ping matters on Neon: pooled connections are recycled aggressively
# and a stale socket otherwise surfaces as an OperationalError on first query.
engine = create_engine(
    settings.sqlalchemy_url,
    pool_pre_ping=True,
    pool_recycle=280,
)

if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _enforce_foreign_keys(connection, _record) -> None:  # pragma: no cover
        """Turn on foreign key enforcement for SQLite.

        Postgres enforces `ON DELETE CASCADE` as a matter of course. SQLite
        ignores foreign keys entirely unless asked, which means deleting an
        image would leave its `product_images` rows behind rather than removing
        them, and the next read of that product would fail on a link pointing at
        nothing.

        The production database is Neon Postgres, so this only affects a local
        or test run against SQLite. Without it, that run behaves differently
        from production in a way that hides real breakage rather than surfacing
        it.
        """
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
