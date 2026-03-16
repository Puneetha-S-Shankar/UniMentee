import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

import asyncio
load_dotenv()
print("SUPABASE_KEY:", os.getenv("SUPABASE_KEY"))

from app.routers import (
    academic_router,
    student_router,
    mentor_router,
    attendance_router,
    marks_router,
    portfolio_router,
    admin_router,
)
from app.routers.auth import router as auth_router

async def auto_lock_loop():
    from app.database import SessionLocal
    from app.repositories.attendance_repository import auto_lock_expired
    while True:
        await asyncio.sleep(3600)
        db = SessionLocal()
        try:
            AUTO_LOCK_HOURS = 24
            DEFAULT_UNIVERSITY_ID = 1
            auto_lock_expired(db, university_id=DEFAULT_UNIVERSITY_ID, lock_after_hours=AUTO_LOCK_HOURS)
        finally:
            db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(auto_lock_loop())
    yield
    task.cancel()

app = FastAPI(title='UniMentee ERP API', version='1.0.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173',
                   'http://127.0.0.1:8000'],
      # Vite dev server
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth_router)
app.include_router(academic_router.router)
app.include_router(student_router.router)
app.include_router(mentor_router.router)
app.include_router(attendance_router.router)
app.include_router(marks_router.router)
app.include_router(portfolio_router.router)
app.include_router(admin_router.router)

@app.get('/')
def root():
    return {'status': 'UniMentee ERP API running', 'docs': '/docs'}

@app.get("/health")
def health():
    return {"status": "healthy"}

