from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date

from app.database import get_db
from app.core.rbac import get_current_user, require_permission
from app.models.announcements import Announcement, AnnouncementTarget
from app.models.users import User
from app.schemas.announcements import AnnouncementIn, AnnouncementOut

router = APIRouter(prefix='/announcements', tags=['Announcements'])


# ── list announcements ───────────────────────────────────────────────

@router.get('', response_model=List[AnnouncementOut])
def list_announcements(
    category: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()

    query = (
        db.query(Announcement)
        .filter(
            Announcement.university_id == user.university_id,
            Announcement.status == 'PUBLISHED',
            or_(Announcement.expiry_date.is_(None), Announcement.expiry_date >= today),
        )
    )

    if category:
        query = query.filter(Announcement.category == category)

    rows = query.order_by(Announcement.posted_at.desc()).limit(limit).all()

    # batch-fetch author names
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
            author_name=names.get(r.author_user_id, "Unknown"),
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
