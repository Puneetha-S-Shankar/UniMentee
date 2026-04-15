"""Attendance persistence. Uses PostgreSQL-specific INSERT ... ON CONFLICT (see bulk_upsert_records)."""
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.models.attendance import AttendanceSession, AttendanceRecord
from datetime import datetime, timezone

def create_session(db: Session, university_id: int, offering_id: int,
                   conducted_by: int, data: dict):
    s = AttendanceSession(
        university_id=university_id,
        offering_id=offering_id,
        conducted_by=conducted_by,
        **data
    )
    db.add(s)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise  # 409 handled by router catching IntegrityError
    db.refresh(s)
    return s

def get_sessions(db: Session, offering_id: int, university_id: int):
    return db.query(AttendanceSession).filter(
        AttendanceSession.offering_id == offering_id,
        AttendanceSession.university_id == university_id
    ).order_by(
        AttendanceSession.session_date.desc(),
        AttendanceSession.start_time.desc()
    ).all()

def get_session(db, session_id, university_id):
    return db.query(AttendanceSession).filter(
        AttendanceSession.session_id == session_id,
        AttendanceSession.university_id == university_id
    ).first()

def bulk_upsert_records(db: Session, session_id: int,
                        university_id: int, records: list):

    now = datetime.now(timezone.utc)   # ← added line

    for r in records:
        stmt = pg_insert(AttendanceRecord).values(
            session_id=session_id,
            university_id=university_id,
            student_id=r['student_id'],
            status=r['status'],
            marked_at=now                     # ← changed
        ).on_conflict_do_update(
            index_elements=['session_id', 'student_id'],
            set_={
                'status': r['status'],
                'marked_at': now              # ← changed
            }
        )

        db.execute(stmt)

    present_count = sum(
        1 for r in records if r['status'] in ('PRESENT', 'LATE')
    )

    db.query(AttendanceSession).filter(
        AttendanceSession.session_id == session_id
    ).update({'total_present': present_count})

    db.commit()

def lock_session(db: Session, session: AttendanceSession, by: str = 'MANUAL'):
    session.is_locked = True
    session.locked_at = datetime.now(timezone.utc)
    session.locked_by = by
    db.commit()
    db.refresh(session)
    return session

def auto_lock_expired(db: Session, university_id: int, lock_after_hours: int):
    """Lock all sessions older than lock_after_hours that are not yet locked."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lock_after_hours)
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.university_id == university_id,
        AttendanceSession.is_locked == False,
        AttendanceSession.locked_at == None
    ).all()
    for s in sessions:
     if s.session_date and s.start_time:
        session_datetime = datetime.combine(s.session_date, s.start_time)
        if session_datetime < cutoff:
            lock_session(db, s, by='AUTO')
