from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time

class SessionIn(BaseModel):
    session_date: date
    start_time: time
    end_time: time
    session_type: str = 'THEORY'
    topic_covered: Optional[str]

class SessionOut(SessionIn):
    session_id: int
    offering_id: int
    is_locked: bool
    total_present: Optional[int]
    class Config: from_attributes = True

class AttendanceRecordIn(BaseModel):
    student_id: int
    status: str  # PRESENT | ABSENT | LATE | ON_LEAVE

class BulkAttendanceIn(BaseModel):
    records: List[AttendanceRecordIn]
