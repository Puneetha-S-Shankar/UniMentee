from pydantic import BaseModel
from typing import Optional, List
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
    status: str


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


# ── mentor assignments ───────────────────────────────────────────────

class MentorAssignmentAdminOut(BaseModel):
    assignment_id: int
    mentor_user_id: int
    mentor_name: str
    student_id: int
    student_name: str
    student_usn: str
    batch_id: int
    academic_year_id: int
    status: str
    class Config: from_attributes = True

class MentorAssignmentCreate(BaseModel):
    mentor_user_id: int
    student_ids: List[int]
    academic_year_id: int

class AssignmentStatusUpdate(BaseModel):
    status: str


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
    class Config: from_attributes = True

class UniversitySettingsUpdate(BaseModel):
    attendance_threshold: Optional[float] = None
    warning_threshold: Optional[float] = None
    auto_lock_hours: Optional[int] = None
    cgpa_good_standing: Optional[float] = None
    cgpa_warning: Optional[float] = None
    max_mentees_per_mentor: Optional[int] = None
    university_name: Optional[str] = None


# ── analytics ────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_students: int
    total_users: int
    pending_portfolio_items: int
    submitted_assessments: int
    active_offerings: int


# ── audit logs ───────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    log_id: int
    university_id: int
    entity_type: str
    entity_id: Optional[int]
    action: str
    actor_id: int
    actor_name: Optional[str]
    changes: Optional[str]
    created_at: datetime
    class Config: from_attributes = True

class AuditLogPage(BaseModel):
    logs: List[AuditLogOut]
    next_cursor: Optional[str]
