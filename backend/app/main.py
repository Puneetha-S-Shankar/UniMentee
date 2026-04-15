import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

import asyncio

load_dotenv()

from app.config import APP_ENV

from app.routers import (
    academic_router,
    student_router,
    mentor_router,
    attendance_router,
    marks_router,
    portfolio_router,
    admin_router,
    leave_router,
    announcements_router,
    faculty_router,
)
from app.routers.auth import router as auth_router

async def auto_lock_loop():
    from app.database import SessionLocal
    from app.repositories.attendance_repository import auto_lock_expired
    from app.models.admin import UniversitySettings
    from app.models.attendance import AttendanceSession

    while True:
        await asyncio.sleep(3600)
        db = SessionLocal()
        try:
            auto_lock_hours = 24
            uids = set()
            try:
                uids.update(
                    r[0]
                    for r in db.query(UniversitySettings.university_id).distinct().all()
                )
            except Exception:
                pass
            try:
                uids.update(
                    r[0]
                    for r in db.query(AttendanceSession.university_id).distinct().all()
                )
            except Exception:
                pass
            for uid in sorted(uids):
                auto_lock_expired(
                    db,
                    university_id=uid,
                    lock_after_hours=auto_lock_hours,
                )
        finally:
            db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(auto_lock_loop())
    yield
    task.cancel()

app = FastAPI(title='UniMentee ERP API', version='1.0.0', lifespan=lifespan)

_cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_extra = os.getenv("CORS_EXTRA_ORIGINS", "")
if _extra.strip():
    _cors_origins.extend(o.strip() for o in _extra.split(",") if o.strip())

_cors_kw = dict(
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# In development, allow any port on localhost / 127.0.0.1 so Vite port changes still work
# and error responses still get CORS headers (avoids "blocked by CORS" masking real 500s).
if APP_ENV != "production":
    _cors_kw["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

app.add_middleware(CORSMiddleware, **_cors_kw)

app.include_router(auth_router)
app.include_router(academic_router.router)
app.include_router(student_router.router)
app.include_router(mentor_router.router)
app.include_router(attendance_router.router)
app.include_router(marks_router.router)
app.include_router(portfolio_router.router)
app.include_router(admin_router.router)
app.include_router(leave_router.router)
app.include_router(announcements_router.router)
app.include_router(faculty_router.router)

@app.get('/')
def root():
    return {'status': 'UniMentee ERP API running', 'docs': '/docs'}

@app.get("/health")
def health():
    return {"status": "healthy"}

