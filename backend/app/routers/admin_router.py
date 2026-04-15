import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text, or_, extract
from sqlalchemy.exc import IntegrityError
from typing import Optional, List, Any, Dict
from datetime import date, timedelta

from app.database import get_db
# Auth: require_permission / require_any_permission depend on get_current_user (JWT) in rbac.py
from app.core.rbac import (
    require_permission,
    require_any_permission,
    require_analytics_summary_access,
    require_faculty_directory_access,
)
from app.core.security import hash_password
from app.models.users import User
from app.models.roles import Role
from app.models.user_roles import UserRole
from app.models.students import Student
from app.models.mentorship import MentorAssignment, MentoringSession
from app.models.academic import SubjectOffering, Section
from app.models.portfolio import PortfolioItem
from app.models.marks import Assessment
from app.models.admin import UniversitySettings, AuditLog
from app.schemas.admin import (
    AdminUserOut, RoleOut, AdminUserCreate, AdminUserUpdate, StatusUpdate,
    AdminStudentCreate, AdminStudentCreatedOut, StudentAdminPatch,
    MentorBriefOut,
    StudentBriefOut,
    MentorAssignmentDetailOut,
    MentorLoadRowOut,
    MentorAssignmentCreate,
    AssignmentStatusUpdate,
    UniversitySettingsOut, UniversitySettingsUpdate,
    AnalyticsSummary,
    AuditLogOut, AuditLogPage,
)
from app.schemas.students import StudentOut

router = APIRouter(prefix='/admin', tags=['Admin'])


# ── helper ───────────────────────────────────────────────────────────

def _parse_audit_json_blob(raw: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    try:
        val = json.loads(raw)
        if isinstance(val, dict):
            return val
        return {"value": val}
    except Exception:
        return {"_raw": raw}


def _actor_roles_batch(db: Session, user_ids: set) -> dict:
    if not user_ids:
        return {}
    rows = (
        db.query(UserRole.user_id, Role.name)
        .join(Role, Role.role_id == UserRole.role_id)
        .filter(UserRole.user_id.in_(user_ids))
        .order_by(Role.name)
        .all()
    )
    out: dict = {}
    for uid, rname in rows:
        out.setdefault(uid, []).append(rname)
    return out


def _student_to_out(db: Session, s: Student) -> StudentOut:
    u = db.query(User).filter(User.user_id == s.user_id).first()
    return StudentOut(
        student_id=s.student_id,
        usn=s.usn,
        program_id=s.program_id,
        batch_id=s.batch_id,
        section_id=s.section_id,
        admission_date=s.admission_date,
        current_semester_number=s.current_semester_number,
        cgpa=float(s.cgpa) if s.cgpa is not None else None,
        status=s.status,
        full_name=u.full_name if u else None,
        email=u.email if u else None,
    )


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


def _assignment_detail_out(db: Session, ma: MentorAssignment) -> MentorAssignmentDetailOut:
    mentor = db.query(User).filter(User.user_id == ma.mentor_user_id).first()
    student = db.query(Student).filter(Student.student_id == ma.student_id).first()
    if not student:
        stu_user = None
    else:
        stu_user = db.query(User).filter(User.user_id == student.user_id).first()
    return MentorAssignmentDetailOut(
        assignment_id=ma.assignment_id,
        mentor=MentorBriefOut(
            user_id=ma.mentor_user_id,
            full_name=mentor.full_name if mentor else "Unknown",
        ),
        student=StudentBriefOut(
            student_id=student.student_id,
            full_name=stu_user.full_name if stu_user else "Unknown",
            usn=student.usn,
            batch_id=student.batch_id,
        ) if student else StudentBriefOut(
            student_id=0,
            full_name="Unknown",
            usn="",
            batch_id=0,
        ),
        academic_year_id=ma.academic_year_id,
        status=ma.status,
        assigned_at=None,
    )


# ── 1. list roles (for assign-role UI) ───────────────────────────────

@router.get('/roles', response_model=List[RoleOut])
def list_roles(
    user=Depends(require_any_permission('USER_MANAGE', 'USER_ASSIGN_ROLES')),
    db: Session = Depends(get_db),
):
    roles = db.query(Role).order_by(Role.name.asc()).all()
    return [RoleOut(role_id=r.role_id, name=r.name, display_name=r.display_name) for r in roles]


# ── 2. list users (role / status filters; optional search for admin UI) ─

@router.get('/users', response_model=List[AdminUserOut])
def list_users(
    role: Optional[str] = Query(None, description="Filter by role name, e.g. FACULTY"),
    status: Optional[str] = Query(None, description="ACTIVE, INACTIVE, or SUSPENDED"),
    search: Optional[str] = Query(None, description="Optional: match full_name or email (substring)"),
    user=Depends(require_faculty_directory_access()),
    db: Session = Depends(get_db),
):
    roles = getattr(user, "roles", []) or []
    if "HOD" in roles and "USER_MANAGE" not in user.permissions:
        if role != "FACULTY":
            raise HTTPException(
                status_code=403,
                detail="HOD directory access is limited to role=FACULTY",
            )

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

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.full_name.ilike(term), User.email.ilike(term)))

    rows = query.order_by(User.full_name.asc()).all()
    return [_user_with_roles(db, u) for u in rows]


# ── 3. create user ──────────────────────────────────────────────────

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


# ── 4. update user ──────────────────────────────────────────────────

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


# ── 5. patch user status ────────────────────────────────────────────

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


# ── 6. onboard student ──────────────────────────────────────────────

@router.post('/students', response_model=AdminStudentCreatedOut, status_code=201)
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

    st = (
        db.query(Student)
        .filter(
            Student.user_id == new_user.user_id,
            Student.university_id == user.university_id,
        )
        .first()
    )
    if not st:
        raise HTTPException(status_code=500, detail="Student record not found after create")

    return AdminStudentCreatedOut(student_id=st.student_id, user_id=new_user.user_id)


@router.patch('/students/{student_id}', response_model=StudentOut)
def patch_student_admin(
    student_id: int,
    body: StudentAdminPatch,
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    st = db.query(Student).filter(
        Student.student_id == student_id,
        Student.university_id == user.university_id,
    ).first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")

    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=422, detail="No fields to update")

    if 'section_id' in patch:
        sid = patch['section_id']
        if sid is not None:
            sec = db.query(Section).filter(
                Section.section_id == sid,
                Section.university_id == user.university_id,
            ).first()
            if not sec:
                raise HTTPException(status_code=404, detail="Section not found")
            if sec.batch_id != st.batch_id:
                raise HTTPException(
                    status_code=400,
                    detail="Section must belong to the student's batch",
                )
        st.section_id = sid

    if 'status' in patch and patch['status'] is not None:
        st.status = patch['status']

    try:
        db.commit()
        db.refresh(st)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Update failed")

    return _student_to_out(db, st)


# ── 7. mentor load overview (per mentor stats) ─────────────────────

@router.get('/mentor-assignments/mentor-load', response_model=List[MentorLoadRowOut])
def mentor_load_overview(
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    uid = user.university_id
    mentor_role = db.query(Role).filter(Role.name == 'MENTOR').first()
    if not mentor_role:
        return []

    mentors = (
        db.query(User)
        .join(UserRole, User.user_id == UserRole.user_id)
        .filter(
            UserRole.role_id == mentor_role.role_id,
            User.university_id == uid,
            User.status == 'ACTIVE',
        )
        .order_by(User.full_name.asc())
        .all()
    )

    settings = db.query(UniversitySettings).filter(UniversitySettings.university_id == uid).first()
    cgpa_warn = float(settings.cgpa_warning) if settings and settings.cgpa_warning else 5.5

    today = date.today()
    out: List[MentorLoadRowOut] = []

    for m in mentors:
        active_assignments = (
            db.query(MentorAssignment)
            .filter(
                MentorAssignment.university_id == uid,
                MentorAssignment.mentor_user_id == m.user_id,
                MentorAssignment.status == 'ACTIVE',
            )
            .all()
        )
        active_count = len(active_assignments)
        at_risk = 0
        for a in active_assignments:
            st = db.query(Student).filter(Student.student_id == a.student_id).first()
            if st and st.cgpa is not None and float(st.cgpa) < cgpa_warn:
                at_risk += 1

        sess_count = (
            db.query(func.count(MentoringSession.session_id))
            .join(
                MentorAssignment,
                MentoringSession.assignment_id == MentorAssignment.assignment_id,
            )
            .filter(
                MentorAssignment.mentor_user_id == m.user_id,
                MentorAssignment.university_id == uid,
                extract('year', MentoringSession.session_date) == today.year,
                extract('month', MentoringSession.session_date) == today.month,
            )
            .scalar()
        )
        sess_count = int(sess_count or 0)

        out.append(
            MentorLoadRowOut(
                mentor_user_id=m.user_id,
                full_name=m.full_name,
                active_mentees=active_count,
                at_risk_mentees=at_risk,
                sessions_this_month=sess_count,
            )
        )

    return out


# ── 8. list mentor assignments ───────────────────────────────────────

@router.get('/mentor-assignments', response_model=List[MentorAssignmentDetailOut])
def list_mentor_assignments(
    mentor_id: Optional[int] = Query(None),
    batch_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="ACTIVE or RELIEVED"),
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

    if status:
        query = query.filter(MentorAssignment.status == status)

    assignments = query.order_by(MentorAssignment.assignment_id.desc()).all()
    result: List[MentorAssignmentDetailOut] = []

    for a in assignments:
        student = db.query(Student).filter(Student.student_id == a.student_id).first()
        if not student:
            continue
        result.append(_assignment_detail_out(db, a))

    return result


# ── 9. bulk create mentor assignments ───────────────────────────────

@router.post('/mentor-assignments', response_model=List[MentorAssignmentDetailOut], status_code=201)
def create_mentor_assignments(
    body: MentorAssignmentCreate,
    user=Depends(require_permission('USER_MANAGE')),
    db: Session = Depends(get_db),
):
    student_ids = list(dict.fromkeys(body.student_ids))
    if not student_ids:
        raise HTTPException(status_code=422, detail="No students selected")

    settings_row = db.query(UniversitySettings).filter(
        UniversitySettings.university_id == user.university_id,
    ).first()
    max_m = settings_row.max_mentees_per_mentor if settings_row and settings_row.max_mentees_per_mentor else 20

    current_active = (
        db.query(func.count(MentorAssignment.assignment_id))
        .filter(
            MentorAssignment.university_id == user.university_id,
            MentorAssignment.mentor_user_id == body.mentor_user_id,
            MentorAssignment.status == 'ACTIVE',
        )
        .scalar()
        or 0
    )

    if int(current_active) + len(student_ids) > int(max_m):
        raise HTTPException(
            status_code=400,
            detail=f"Mentor cannot exceed {max_m} active mentees (including this request)",
        )

    created = []
    try:
        for sid in student_ids:
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
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate or invalid mentor assignment")

    for ma in created:
        db.refresh(ma)

    return [_assignment_detail_out(db, ma) for ma in created]


# ── 10. patch mentor assignment status ───────────────────────────────

@router.patch('/mentor-assignments/{assignment_id}/status', response_model=MentorAssignmentDetailOut)
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

    return _assignment_detail_out(db, ma)


# ── 11. get settings ─────────────────────────────────────────────────

@router.get('/settings', response_model=UniversitySettingsOut)
def get_settings(
    user=Depends(require_any_permission('ORG_VIEW', 'ORG_MANAGE')),
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
            university_logo_url=row.university_logo_url,
        )

    return UniversitySettingsOut(university_id=user.university_id, university_logo_url=None)


# ── 12. upsert settings ─────────────────────────────────────────────

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
        university_logo_url=row.university_logo_url,
    )


# ── 13. analytics summary ───────────────────────────────────────────

def _low_attendance_student_count(db: Session, university_id: int, attendance_threshold: float) -> int:
    """Distinct active students with at least one enrolled offering below attendance threshold."""
    q = text(
        """
        WITH stu AS (
          SELECT student_id FROM students
          WHERE university_id = :uid AND status = 'ACTIVE'
        ),
        sess AS (
          SELECT offering_id, session_id FROM attendance_sessions
          WHERE university_id = :uid
        ),
        enr AS (
          SELECT e.student_id, e.offering_id
          FROM student_subject_enrollments e
          INNER JOIN stu ON stu.student_id = e.student_id
          WHERE e.university_id = :uid AND e.status = 'ENROLLED'
        ),
        per_offering AS (
          SELECT enr.student_id, enr.offering_id,
            COUNT(sess.session_id)::float AS total_sess,
            COALESCE(SUM(CASE WHEN ar.status IN ('PRESENT','LATE') THEN 1 ELSE 0 END), 0) AS present_cnt
          FROM enr
          JOIN sess ON sess.offering_id = enr.offering_id
          LEFT JOIN attendance_records ar
            ON ar.session_id = sess.session_id
            AND ar.student_id = enr.student_id
            AND ar.university_id = :uid
          GROUP BY enr.student_id, enr.offering_id
        )
        SELECT COUNT(DISTINCT student_id)::int FROM per_offering
        WHERE total_sess > 0 AND (present_cnt / total_sess * 100) < :thresh
        """
    )
    row = db.execute(
        q,
        {"uid": university_id, "thresh": float(attendance_threshold)},
    ).scalar()
    return int(row or 0)


@router.get('/analytics/summary', response_model=AnalyticsSummary)
def analytics_summary(
    user=Depends(require_analytics_summary_access()),
    db: Session = Depends(get_db),
):
    uid = user.university_id

    settings_row = db.query(UniversitySettings).filter(
        UniversitySettings.university_id == uid,
    ).first()
    attendance_threshold = float(settings_row.attendance_threshold) if settings_row and settings_row.attendance_threshold else 75.0
    cgpa_warning = float(settings_row.cgpa_warning) if settings_row and settings_row.cgpa_warning else 5.5

    total_students = db.query(func.count(Student.student_id)).filter(
        Student.university_id == uid, Student.status == 'ACTIVE',
    ).scalar() or 0

    total_users = db.query(func.count(User.user_id)).filter(
        User.university_id == uid,
    ).scalar() or 0

    faculty_role = db.query(Role).filter(Role.name == 'FACULTY').first()
    if faculty_role:
        total_faculty = (
            db.query(func.count(User.user_id))
            .join(UserRole, User.user_id == UserRole.user_id)
            .filter(
                User.university_id == uid,
                User.status == 'ACTIVE',
                UserRole.role_id == faculty_role.role_id,
            )
            .scalar()
            or 0
        )
    else:
        total_faculty = 0

    at_risk_students = (
        db.query(func.count(Student.student_id))
        .filter(
            Student.university_id == uid,
            Student.status == 'ACTIVE',
            Student.cgpa.isnot(None),
            Student.cgpa < cgpa_warning,
        )
        .scalar()
        or 0
    )

    low_attendance_students = _low_attendance_student_count(db, uid, attendance_threshold)

    pending_portfolio_verifications = db.query(func.count(PortfolioItem.item_id)).filter(
        PortfolioItem.university_id == uid, PortfolioItem.status == 'PENDING',
    ).scalar() or 0

    pending_mark_verifications = db.query(func.count(Assessment.assessment_id)).filter(
        Assessment.university_id == uid, Assessment.status == 'SUBMITTED',
    ).scalar() or 0

    active_offerings = db.query(func.count(SubjectOffering.offering_id)).filter(
        SubjectOffering.university_id == uid, SubjectOffering.status == 'ACTIVE',
    ).scalar() or 0

    current_term_enrollment = (
        db.query(func.coalesce(func.sum(SubjectOffering.current_enrollment), 0))
        .filter(SubjectOffering.university_id == uid, SubjectOffering.status == 'ACTIVE')
        .scalar()
        or 0
    )
    if hasattr(current_term_enrollment, '__int__'):
        current_term_enrollment = int(current_term_enrollment)

    return AnalyticsSummary(
        total_students=total_students,
        total_faculty=total_faculty,
        at_risk_students=at_risk_students,
        low_attendance_students=low_attendance_students,
        active_offerings=active_offerings,
        pending_portfolio_verifications=pending_portfolio_verifications,
        pending_mark_verifications=pending_mark_verifications,
        total_users=total_users,
        current_term_enrollment=current_term_enrollment,
    )


# ── 14. audit logs (cursor pagination) ──────────────────────────────

@router.get('/audit-logs', response_model=AuditLogPage)
def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    actor_id: Optional[int] = Query(None, description="Filter by actor user id"),
    actor_name: Optional[str] = Query(None, description="Partial match on actor full name"),
    action: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_any_permission('AUDIT_VIEW', 'ORG_VIEW')),
    db: Session = Depends(get_db),
):
    uid = user.university_id
    query = db.query(AuditLog).filter(AuditLog.university_id == uid)

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if actor_id is not None:
        query = query.filter(AuditLog.actor_user_id == actor_id)
    if actor_name and actor_name.strip():
        term = f"%{actor_name.strip()}%"
        matching = [
            row[0]
            for row in db.query(User.user_id)
            .filter(User.university_id == uid, User.full_name.ilike(term))
            .all()
        ]
        if not matching:
            return AuditLogPage(logs=[], next_cursor=None)
        query = query.filter(AuditLog.actor_user_id.in_(matching))
    if action:
        query = query.filter(AuditLog.action == action)
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at < to_date + timedelta(days=1))
    if cursor:
        query = query.filter(AuditLog.log_id < int(cursor))

    rows = query.order_by(AuditLog.log_id.desc()).limit(limit).all()

    actor_ids = {r.actor_user_id for r in rows if r.actor_user_id}
    actors: dict = {}
    if actor_ids:
        for u in db.query(User).filter(User.user_id.in_(actor_ids)).all():
            actors[u.user_id] = u.full_name
    roles_map = _actor_roles_batch(db, actor_ids)

    logs = [
        AuditLogOut(
            log_id=r.log_id,
            actor_name=actors.get(r.actor_user_id) if r.actor_user_id else None,
            actor_user_id=r.actor_user_id,
            actor_roles=roles_map.get(r.actor_user_id, []) if r.actor_user_id else [],
            action=r.action,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            old_value=_parse_audit_json_blob(r.old_value),
            new_value=_parse_audit_json_blob(r.new_value),
            created_at=r.created_at,
            ip_address=r.ip_address,
        )
        for r in rows
    ]

    next_cursor = str(rows[-1].log_id) if len(rows) == limit else None
    return AuditLogPage(logs=logs, next_cursor=next_cursor)
