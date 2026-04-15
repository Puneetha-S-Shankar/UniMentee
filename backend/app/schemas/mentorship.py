from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time

class AssignmentOut(BaseModel):
    assignment_id: int
    student_id: int
    mentor_user_id: int
    status: str
    class Config: from_attributes = True

class SessionIn(BaseModel):
    session_date: date
    session_time: Optional[time]
    duration_minutes: Optional[int]
    session_type: str = 'IN_PERSON'
    topics_discussed: Optional[str]
    action_items: Optional[str]
    follow_up_required: bool = False
    follow_up_date: Optional[date]
    career_notes: Optional[str]

class SessionOut(SessionIn):
    session_id: int
    assignment_id: int
    created_by: int
    class Config: from_attributes = True

# ── /mentor/mentees ──────────────────────────────────────────────────

class MenteeStudentInfo(BaseModel):
    student_id: int
    usn: str
    full_name: str
    email: str
    cgpa: Optional[float]
    batch_id: int
    section_id: Optional[int]
    status: str
    class Config: from_attributes = True

class AtRiskFlags(BaseModel):
    attendance: bool
    academic: bool

class MenteeOut(BaseModel):
    assignment_id: int
    student: MenteeStudentInfo
    at_risk: AtRiskFlags
    class Config: from_attributes = True

# ── /mentor/dashboard-stats ──────────────────────────────────────────

class RecentSessionOut(BaseModel):
    session_id: int
    assignment_id: int
    session_date: date
    session_type: str = 'IN_PERSON'
    student_name: str
    topics_discussed: Optional[str]
    class Config: from_attributes = True

class UpcomingFollowupOut(BaseModel):
    session_id: int
    assignment_id: int
    student_id: int
    student_name: str
    follow_up_date: date
    topics_discussed: Optional[str]
    action_items: Optional[str]
    class Config: from_attributes = True

class DashboardStats(BaseModel):
    total_mentees: int
    pending_followups: int
    sessions_this_month: int
    uncontacted_30days: int
    at_risk_count: int
    recent_sessions: List[RecentSessionOut]
    upcoming_followups: List[UpcomingFollowupOut]
    class Config: from_attributes = True
