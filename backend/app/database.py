"""SQLAlchemy engine and session. PostgreSQL is the supported production database."""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL, DATABASE_SSLMODE

_VALID_SCHEMES = ("postgresql://", "postgresql+", "postgres://")
if not any(DATABASE_URL.startswith(s) for s in _VALID_SCHEMES):
    raise RuntimeError(
        "DATABASE_URL must be a PostgreSQL connection string "
        "(e.g. postgresql://user:password@host:5432/dbname).\n"
        "Check your .env file — the current value does not look like a valid URL."
    )

_connect_args = {}
_ssl = (DATABASE_SSLMODE or "").strip().lower()
if _ssl and _ssl not in ("disable", "false", "0", "no"):
    _connect_args["sslmode"] = DATABASE_SSLMODE

_engine_kwargs = dict(
    pool_pre_ping=True,
    connect_args=_connect_args,
    echo=os.getenv("SQLALCHEMY_ECHO", "").lower() in ("1", "true", "yes"),
)
engine = create_engine(DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()