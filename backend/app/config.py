import os
from dotenv import load_dotenv

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is required. Set it in the environment or a .env file."
    )

if APP_ENV == "production":
    _jwt = os.getenv("JWT_SECRET")
    if not _jwt:
        raise RuntimeError("JWT_SECRET is required when APP_ENV=production")
    JWT_SECRET = _jwt
else:
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

# Passed to PostgreSQL connection (require, disable, prefer, …)
DATABASE_SSLMODE = os.getenv("DATABASE_SSLMODE", "require")