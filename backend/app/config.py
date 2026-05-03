import os
from dotenv import load_dotenv

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development")

_SECRET_GENERATE_HINT = (
    "Generate one with:\n"
    "  python -c \"import secrets; print(secrets.token_hex(32))\""
)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set.\n"
        "Add it to your .env file:\n"
        "  DATABASE_URL=postgresql://user:password@host:5432/dbname"
    )
if DATABASE_URL == "supersecret":
    raise RuntimeError(
        "DATABASE_URL is set to the placeholder value 'supersecret'.\n"
        "Set it to a real PostgreSQL connection string:\n"
        "  DATABASE_URL=postgresql://user:password@host:5432/dbname"
    )

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set.\n"
        f"Add it to your .env file. {_SECRET_GENERATE_HINT}"
    )
_jwt_insecure_always = {"supersecret"}
_jwt_insecure_prod = _jwt_insecure_always | {"dev-only-change-me"}
_bad_jwt = _jwt_insecure_prod if APP_ENV == "production" else _jwt_insecure_always
if JWT_SECRET in _bad_jwt:
    raise RuntimeError(
        f"JWT_SECRET='{JWT_SECRET}' is not safe"
        + (" in production" if APP_ENV == "production" else "")
        + f".\n{_SECRET_GENERATE_HINT}"
    )

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

# Passed to PostgreSQL connection (require, disable, prefer, …)
DATABASE_SSLMODE = os.getenv("DATABASE_SSLMODE", "require")