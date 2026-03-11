from pydantic import BaseModel
from typing import Optional
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
