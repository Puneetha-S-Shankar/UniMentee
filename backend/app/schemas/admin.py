from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import date, datetime


# ── roles / users ────────────────────────────────────────────────────

class RoleOut(BaseModel):
    role_id: int
    name: str
    display_name: Optional[str]
    class Config: from_attributes = True

class AdminUserOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    status: str
    roles: List[RoleOut]
    class Config: from_attributes = True


class AdminUserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role_ids: List[int]

class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role_ids: Optional[List[int]] = None

class StatusUpdate(BaseModel):
    status: Literal['ACTIVE', 'INACTIVE', 'SUSPENDED']


# ── student onboarding ───────────────────────────────────────────────

class AdminStudentCreate(BaseModel):
    full_name: str
    email: str
    initial_password: str
    usn: str
    program_id: int
    batch_id: int
    section_id: Optional[int] = None
    admission_date: date


class AdminStudentCreatedOut(BaseModel):
    student_id: int
    user_id: int


class StudentAdminPatch(BaseModel):
    section_id: Optional[int] = None
    status: Optional[str] = None


# ── mentor assignments ───────────────────────────────────────────────

class MentorBriefOut(BaseModel):
    user_id: int
    full_name: str


class StudentBriefOut(BaseModel):
    student_id: int
    full_name: str
    usn: str
    batch_id: int


class MentorAssignmentDetailOut(BaseModel):
    assignment_id: int
    mentor: MentorBriefOut
    student: StudentBriefOut
    academic_year_id: int
    status: str
    assigned_at: Optional[datetime] = None


class MentorLoadRowOut(BaseModel):
    mentor_user_id: int
    full_name: str
    active_mentees: int
    at_risk_mentees: int
    sessions_this_month: int


class MentorAssignmentCreate(BaseModel):
    mentor_user_id: int
    student_ids: List[int]
    academic_year_id: int

class AssignmentStatusUpdate(BaseModel):
    status: Literal['RELIEVED']


# ── university settings ──────────────────────────────────────────────

class UniversitySettingsOut(BaseModel):
    setting_id: Optional[int] = None
    university_id: int
    attendance_threshold: float = 75.0
    warning_threshold: float = 80.0
    auto_lock_hours: int = 24
    cgpa_good_standing: float = 7.5
    cgpa_warning: float = 5.5
    max_mentees_per_mentor: int = 20
    university_name: Optional[str] = None
    university_logo_url: Optional[str] = None
    class Config: from_attributes = True

class UniversitySettingsUpdate(BaseModel):
    attendance_threshold: Optional[float] = None
    warning_threshold: Optional[float] = None
    auto_lock_hours: Optional[int] = None
    cgpa_good_standing: Optional[float] = None
    cgpa_warning: Optional[float] = None
    max_mentees_per_mentor: Optional[int] = None
    university_name: Optional[str] = None
    university_logo_url: Optional[str] = None


# ── analytics ────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_students: int
    total_faculty: int
    at_risk_students: int
    low_attendance_students: int
    active_offerings: int
    pending_portfolio_verifications: int
    pending_mark_verifications: int
    total_users: int
    current_term_enrollment: int = Field(
        0,
        description="Sum of current_enrollment on active offerings (placeholder until term scoping exists).",
    )


# ── audit logs ───────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    log_id: int
    actor_name: Optional[str] = None
    actor_user_id: Optional[int] = None
    actor_roles: List[str] = Field(default_factory=list)
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    created_at: datetime
    ip_address: Optional[str] = None
    class Config: from_attributes = True

class AuditLogPage(BaseModel):
    logs: List[AuditLogOut]
    next_cursor: Optional[str] = None
