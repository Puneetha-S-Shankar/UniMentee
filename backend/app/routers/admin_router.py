from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import date, timedelta

from app.database import get_db
from app.core.rbac import require_permission
from app.core.security import hash_password
from app.models.users import User
from app.models.roles import Role
from app.models.user_roles import UserRole
from app.models.students import Student
from app.models.mentorship import MentorAssignment
from app.models.academic import SubjectOffering
from app.models.portfolio import PortfolioItem
from app.models.marks import Assessment
from app.models.admin import UniversitySettings, AuditLog
from app.schemas.admin import (
    AdminUserOut, RoleOut, AdminUserCreate, AdminUserUpdate, StatusUpdate,
    AdminStudentCreate,
    MentorAssignmentAdminOut, MentorAssignmentCreate, AssignmentStatusUpdate,
    UniversitySettingsOut, UniversitySettingsUpdate,
    AnalyticsSummary,
    AuditLogOut, AuditLogPage,
)

router = APIRouter(prefix='/admin', tags=['Admin'])


# ── helper ───────────────────────────────────────────────────────────

def _user_with_roles(db: Session, u: User) -> AdminUserOut:
    roles = (
        db.query(Role)
        .join(UserRole, Role.role_id == UserRole.role_id)
        .filter(UserRole.user_id == u.user_id)
        .all()
    )
    return AdminUserOut(
        user_id=u.user_id,
        full_name=u.full_name,
        email=u.email,
        status=u.status,
        roles=[RoleOut(role_id=r.role_id, name=r.name, display_name=r.display_name) for r in roles],
    )


# ── 1. list users ───────────────────────────────────────────────────

@router.get('/users', response_model=List[AdminUserOut])
def list_users(
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(User.university_id == user.university_id)

    if status:
        query = query.filter(User.status == status)

    if role:
        role_sub = (
            db.query(UserRole.user_id)
            .join(Role, Role.role_id == UserRole.role_id)
            .filter(Role.name == role)
            .subquery()
        )
        query = query.filter(User.user_id.in_(role_sub))

    return [_user_with_roles(db, u) for u in query.all()]


# ── 2. create user ──────────────────────────────────────────────────

@router.post('/users', response_model=AdminUserOut, status_code=201)
def create_user(
    body: AdminUserCreate,
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    new_user = User(
        university_id=user.university_id,
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        status='ACTIVE',
    )
    try:
        db.add(new_user)
        db.flush()
        for rid in body.role_ids:
            db.add(UserRole(user_id=new_user.user_id, role_id=rid))
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already exists")

    return _user_with_roles(db, new_user)


# ── 3. update user ──────────────────────────────────────────────────

@router.put('/users/{user_id}', response_model=AdminUserOut)
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(
        User.user_id == user_id,
        User.university_id == user.university_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if body.full_name is not None:
        target.full_name = body.full_name
    if body.email is not None:
        target.email = body.email

    if body.role_ids is not None:
        db.query(UserRole).filter(UserRole.user_id == user_id).delete()
        for rid in body.role_ids:
            db.add(UserRole(user_id=user_id, role_id=rid))

    try:
        db.commit()
        db.refresh(target)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already exists")

    return _user_with_roles(db, target)


# ── 4. patch user status ────────────────────────────────────────────

@router.patch('/users/{user_id}/status', response_model=AdminUserOut)
def patch_user_status(
    user_id: int,
    body: StatusUpdate,
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(
        User.user_id == user_id,
        User.university_id == user.university_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.status = body.status
    db.commit()
    db.refresh(target)
    return _user_with_roles(db, target)


# ── 5. onboard student ──────────────────────────────────────────────

@router.post('/students', response_model=AdminUserOut, status_code=201)
def create_student(
    body: AdminStudentCreate,
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    new_user = User(
        university_id=user.university_id,
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.initial_password),
        status='ACTIVE',
    )
    try:
        db.add(new_user)
        db.flush()

        student_role = db.query(Role).filter(Role.name == 'STUDENT').first()
        if not student_role:
            raise HTTPException(status_code=500, detail="STUDENT role not configured")

        db.add(UserRole(user_id=new_user.user_id, role_id=student_role.role_id))

        db.add(Student(
            university_id=user.university_id,
            user_id=new_user.user_id,
            usn=body.usn,
            program_id=body.program_id,
            batch_id=body.batch_id,
            section_id=body.section_id,
            admission_date=body.admission_date,
            status='ACTIVE',
        ))

        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email or USN already exists")

    return _user_with_roles(db, new_user)


# ── 6. list mentor assignments ──────────────────────────────────────

@router.get('/mentor-assignments', response_model=List[MentorAssignmentAdminOut])
def list_mentor_assignments(
    mentor_id: Optional[int] = Query(None),
    batch_id: Optional[int] = Query(None),
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    query = db.query(MentorAssignment).filter(
        MentorAssignment.university_id == user.university_id,
    )

    if mentor_id:
        query = query.filter(MentorAssignment.mentor_user_id == mentor_id)

    if batch_id:
        student_ids_sub = (
            db.query(Student.student_id)
            .filter(Student.batch_id == batch_id, Student.university_id == user.university_id)
            .subquery()
        )
        query = query.filter(MentorAssignment.student_id.in_(student_ids_sub))

    assignments = query.all()
    result = []

    for a in assignments:
        mentor = db.query(User).filter(User.user_id == a.mentor_user_id).first()
        student = db.query(Student).filter(Student.student_id == a.student_id).first()
        if not student:
            continue
        stu_user = db.query(User).filter(User.user_id == student.user_id).first()

        result.append(MentorAssignmentAdminOut(
            assignment_id=a.assignment_id,
            mentor_user_id=a.mentor_user_id,
            mentor_name=mentor.full_name if mentor else "Unknown",
            student_id=a.student_id,
            student_name=stu_user.full_name if stu_user else "Unknown",
            student_usn=student.usn,
            batch_id=student.batch_id,
            academic_year_id=a.academic_year_id,
            status=a.status,
        ))

    return result


# ── 7. bulk create mentor assignments ───────────────────────────────

@router.post('/mentor-assignments', response_model=List[MentorAssignmentAdminOut], status_code=201)
def create_mentor_assignments(
    body: MentorAssignmentCreate,
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    created = []
    for sid in body.student_ids:
        ma = MentorAssignment(
            university_id=user.university_id,
            student_id=sid,
            mentor_user_id=body.mentor_user_id,
            academic_year_id=body.academic_year_id,
            assigned_by=user.user_id,
            status='ACTIVE',
        )
        db.add(ma)
        created.append(ma)

    db.commit()
    for ma in created:
        db.refresh(ma)

    mentor = db.query(User).filter(User.user_id == body.mentor_user_id).first()
    result = []
    for ma in created:
        student = db.query(Student).filter(Student.student_id == ma.student_id).first()
        stu_user = db.query(User).filter(User.user_id == student.user_id).first() if student else None
        result.append(MentorAssignmentAdminOut(
            assignment_id=ma.assignment_id,
            mentor_user_id=ma.mentor_user_id,
            mentor_name=mentor.full_name if mentor else "Unknown",
            student_id=ma.student_id,
            student_name=stu_user.full_name if stu_user else "Unknown",
            student_usn=student.usn if student else "",
            batch_id=student.batch_id if student else 0,
            academic_year_id=ma.academic_year_id,
            status=ma.status,
        ))
    return result


# ── 8. patch mentor assignment status ────────────────────────────────

@router.patch('/mentor-assignments/{assignment_id}/status', response_model=MentorAssignmentAdminOut)
def patch_assignment_status(
    assignment_id: int,
    body: AssignmentStatusUpdate,
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    ma = db.query(MentorAssignment).filter(
        MentorAssignment.assignment_id == assignment_id,
        MentorAssignment.university_id == user.university_id,
    ).first()
    if not ma:
        raise HTTPException(status_code=404, detail="Assignment not found")

    ma.status = body.status
    db.commit()
    db.refresh(ma)

    mentor = db.query(User).filter(User.user_id == ma.mentor_user_id).first()
    student = db.query(Student).filter(Student.student_id == ma.student_id).first()
    stu_user = db.query(User).filter(User.user_id == student.user_id).first() if student else None

    return MentorAssignmentAdminOut(
        assignment_id=ma.assignment_id,
        mentor_user_id=ma.mentor_user_id,
        mentor_name=mentor.full_name if mentor else "Unknown",
        student_id=ma.student_id,
        student_name=stu_user.full_name if stu_user else "Unknown",
        student_usn=student.usn if student else "",
        batch_id=student.batch_id if student else 0,
        academic_year_id=ma.academic_year_id,
        status=ma.status,
    )


# ── 9. get settings ─────────────────────────────────────────────────

@router.get('/settings', response_model=UniversitySettingsOut)
def get_settings(
    user=Depends(require_permission('ORG_VIEW')),
    db: Session = Depends(get_db),
):
    row = db.query(UniversitySettings).filter(
        UniversitySettings.university_id == user.university_id,
    ).first()

    if row:
        return UniversitySettingsOut(
            setting_id=row.setting_id,
            university_id=row.university_id,
            attendance_threshold=float(row.attendance_threshold) if row.attendance_threshold else 75.0,
            warning_threshold=float(row.warning_threshold) if row.warning_threshold else 80.0,
            auto_lock_hours=row.auto_lock_hours or 24,
            cgpa_good_standing=float(row.cgpa_good_standing) if row.cgpa_good_standing else 7.5,
            cgpa_warning=float(row.cgpa_warning) if row.cgpa_warning else 5.5,
            max_mentees_per_mentor=row.max_mentees_per_mentor or 20,
            university_name=row.university_name,
        )

    return UniversitySettingsOut(university_id=user.university_id)


# ── 10. upsert settings ─────────────────────────────────────────────

@router.put('/settings', response_model=UniversitySettingsOut)
def update_settings(
    body: UniversitySettingsUpdate,
    user=Depends(require_permission('ORG_MANAGE')),
    db: Session = Depends(get_db),
):
    row = db.query(UniversitySettings).filter(
        UniversitySettings.university_id == user.university_id,
    ).first()

    if not row:
        row = UniversitySettings(university_id=user.university_id)
        db.add(row)

    updates = body.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)

    return UniversitySettingsOut(
        setting_id=row.setting_id,
        university_id=row.university_id,
        attendance_threshold=float(row.attendance_threshold) if row.attendance_threshold else 75.0,
        warning_threshold=float(row.warning_threshold) if row.warning_threshold else 80.0,
        auto_lock_hours=row.auto_lock_hours or 24,
        cgpa_good_standing=float(row.cgpa_good_standing) if row.cgpa_good_standing else 7.5,
        cgpa_warning=float(row.cgpa_warning) if row.cgpa_warning else 5.5,
        max_mentees_per_mentor=row.max_mentees_per_mentor or 20,
        university_name=row.university_name,
    )


# ── 11. analytics summary ───────────────────────────────────────────

@router.get('/analytics/summary', response_model=AnalyticsSummary)
def analytics_summary(
    user=Depends(require_permission('ORG_VIEW')),
    db: Session = Depends(get_db),
):
    uid = user.university_id

    total_students = db.query(func.count(Student.student_id)).filter(
        Student.university_id == uid, Student.status == 'ACTIVE',
    ).scalar() or 0

    total_users = db.query(func.count(User.user_id)).filter(
        User.university_id == uid,
    ).scalar() or 0

    pending_portfolio = db.query(func.count(PortfolioItem.item_id)).filter(
        PortfolioItem.university_id == uid, PortfolioItem.status == 'PENDING',
    ).scalar() or 0

    submitted_assessments = db.query(func.count(Assessment.assessment_id)).filter(
        Assessment.university_id == uid, Assessment.status == 'SUBMITTED',
    ).scalar() or 0

    active_offerings = db.query(func.count(SubjectOffering.offering_id)).filter(
        SubjectOffering.university_id == uid, SubjectOffering.status == 'ACTIVE',
    ).scalar() or 0

    return AnalyticsSummary(
        total_students=total_students,
        total_users=total_users,
        pending_portfolio_items=pending_portfolio,
        submitted_assessments=submitted_assessments,
        active_offerings=active_offerings,
    )


# ── 12. audit logs (cursor pagination) ──────────────────────────────

@router.get('/audit-logs', response_model=AuditLogPage)
def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    actor_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_permission('ORG_VIEW')),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).filter(
        AuditLog.university_id == user.university_id,
    )

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date + timedelta(days=1))
    if cursor:
        query = query.filter(AuditLog.log_id < int(cursor))

    rows = query.order_by(AuditLog.log_id.desc()).limit(limit).all()

    # batch-fetch actor names
    actor_ids = {r.actor_id for r in rows if r.actor_id}
    actors = {}
    if actor_ids:
        for u in db.query(User).filter(User.user_id.in_(actor_ids)).all():
            actors[u.user_id] = u.full_name

    logs = [
        AuditLogOut(
            log_id=r.log_id,
            university_id=r.university_id,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            action=r.action,
            actor_id=r.actor_id,
            actor_name=actors.get(r.actor_id),
            changes=r.changes,
            created_at=r.created_at,
        )
        for r in rows
    ]

    next_cursor = str(rows[-1].log_id) if len(rows) == limit else None
    return AuditLogPage(logs=logs, next_cursor=next_cursor)
