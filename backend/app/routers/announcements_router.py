from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, exists
from typing import Optional, List
from datetime import date, datetime, time, timezone

from app.database import get_db
from app.core.rbac import get_current_user, require_permission
from app.models.announcements import Announcement, AnnouncementTarget
from app.models.users import User
from app.models.students import Student
from app.schemas.announcements import AnnouncementIn, AnnouncementOut

router = APIRouter(prefix='/announcements', tags=['Announcements'])


def _student_target_visibility_filter(student: Student):
    """Visible if no targets, or BATCH matches, or SECTION matches."""
    AT = AnnouncementTarget
    no_targets = ~exists().where(AT.announcement_id == Announcement.announcement_id)
    batch_ok = exists().where(
        and_(
            AT.announcement_id == Announcement.announcement_id,
            AT.target_type == 'BATCH',
            AT.target_id == student.batch_id,
        )
    )
    if student.section_id is not None:
        section_ok = exists().where(
            and_(
                AT.announcement_id == Announcement.announcement_id,
                AT.target_type == 'SECTION',
                AT.target_id == student.section_id,
            )
        )
        return or_(no_targets, batch_ok, section_ok)
    return or_(no_targets, batch_ok)


# ── list announcements ───────────────────────────────────────────────

@router.get('', response_model=List[AnnouncementOut])
def list_announcements(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    posted_from: Optional[date] = Query(None),
    posted_to: Optional[date] = Query(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List published announcements for this university (non-expired). Read state is client-side."""
    today = date.today()

    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id,
    ).first()

    query = (
        db.query(Announcement)
        .filter(
            Announcement.university_id == user.university_id,
            Announcement.status == 'PUBLISHED',
            or_(Announcement.expiry_date.is_(None), Announcement.expiry_date >= today),
        )
    )

    # If the user is a student, restrict to announcements with no targets or matching batch/section.
    if student is not None:
        query = query.filter(_student_target_visibility_filter(student))

    if category:
        query = query.filter(Announcement.category == category)

    if search and search.strip():
        term = f'%{search.strip()}%'
        query = query.filter(
            or_(
                Announcement.title.ilike(term),
                Announcement.body.ilike(term),
            )
        )

    if posted_from is not None:
        start = datetime.combine(posted_from, time.min, tzinfo=timezone.utc)
        query = query.filter(Announcement.posted_at >= start)
    if posted_to is not None:
        end = datetime.combine(posted_to, time.max, tzinfo=timezone.utc)
        query = query.filter(Announcement.posted_at <= end)

    rows = query.order_by(Announcement.posted_at.desc()).limit(limit).all()

    author_ids = {r.author_user_id for r in rows}
    names: dict = {}
    if author_ids:
        for u in db.query(User).filter(User.user_id.in_(author_ids)).all():
            names[u.user_id] = u.full_name

    return [
        AnnouncementOut(
            announcement_id=r.announcement_id,
            title=r.title,
            body=r.body,
            category=r.category,
            priority=r.priority,
            posted_at=r.posted_at,
            expiry_date=r.expiry_date,
            author_name=names.get(r.author_user_id, 'Unknown'),
        )
        for r in rows
    ]


# ── create announcement ──────────────────────────────────────────────

@router.post('', response_model=AnnouncementOut, status_code=201)
def create_announcement(
    body: AnnouncementIn,
    user=Depends(require_permission('ANNOUNCEMENT_PUBLISH')),
    db: Session = Depends(get_db),
):
    ann = Announcement(
        university_id=user.university_id,
        author_user_id=user.user_id,
        title=body.title,
        body=body.body,
        category=body.category,
        priority=body.priority,
        expiry_date=body.expiry_date,
        status='PUBLISHED',
    )
    db.add(ann)
    db.flush()

    for bid in (body.target_batch_ids or []):
        db.add(AnnouncementTarget(
            announcement_id=ann.announcement_id, target_type='BATCH', target_id=bid,
        ))

    for sid in (body.target_section_ids or []):
        db.add(AnnouncementTarget(
            announcement_id=ann.announcement_id, target_type='SECTION', target_id=sid,
        ))

    db.commit()
    db.refresh(ann)

    return AnnouncementOut(
        announcement_id=ann.announcement_id,
        title=ann.title,
        body=ann.body,
        category=ann.category,
        priority=ann.priority,
        posted_at=ann.posted_at,
        expiry_date=ann.expiry_date,
        author_name=user.full_name,
    )
