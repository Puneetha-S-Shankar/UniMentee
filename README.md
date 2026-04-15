# UniMentee ERP

Monorepo for the UniMentee university ERP: a **FastAPI** backend and a **React + Vite** frontend.

## Repository layout

| Path | Description |
|------|-------------|
| [`backend/`](backend/) | FastAPI app (`app/`), SQL migrations, environment template |
| [`frontend/`](frontend/) | React SPA (Vite + TypeScript) |

## Prerequisites

- **Python 3.11+** (3.13 used in development)
- **Node.js 20+** and npm
- **PostgreSQL** (production and recommended for local dev; the API uses PostgreSQL-specific features in places)

## Backend

### Configuration

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and set at least:

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. The app fails fast at startup if unset. |
| `JWT_SECRET` | In production | Required when `APP_ENV=production`. |
| `APP_ENV` | No | `development` (default) or `production`. |
| `DATABASE_SSLMODE` | No | Default `require`. Use `disable` for local Postgres without TLS. |
| `SQLALCHEMY_ECHO` | No | Set to `1` / `true` to log SQL. |

### Database migrations

Incremental SQL lives under [`backend/migrations/`](backend/migrations/). See [`backend/migrations/README.md`](backend/migrations/README.md) for **run order** and prerequisites: core tables (`users`, `students`, `subject_offerings`, etc.) must already exist before applying `001`–`006`.

There is **no Alembic** in this repo; apply scripts manually or with your migration runner.

### Run the API

Install Python dependencies your project uses (FastAPI, SQLAlchemy, etc.), then from `backend/`:

```bash
uvicorn app.main:app --reload
```

Ensure the working directory is `backend` so `app` resolves, or set `PYTHONPATH` accordingly. API docs: `http://127.0.0.1:8000/docs`.

## Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

Dev server defaults to Vite’s usual port (e.g. `5173`). More detail: [`frontend/README.md`](frontend/README.md).

## Security notes

- Never commit `.env` files with real secrets.
- Use strong `JWT_SECRET` in production and set `APP_ENV=production` so weak defaults are rejected.

## License

Add your license here if applicable.
