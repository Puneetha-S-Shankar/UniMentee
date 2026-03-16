from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class OfferingBasic(BaseModel):
    offering_id: int
    class Config: from_attributes = True


class LeaveRequestIn(BaseModel):
    from_date: date
    to_date: date
    reason: str
    subject_ids: List[int]
    document_url: Optional[str] = None


class LeaveRequestOut(BaseModel):
    leave_id: int
    from_date: date
    to_date: date
    reason: str
    status: str
    applied_at: datetime
    document_url: Optional[str]
    subjects: List[OfferingBasic]
    class Config: from_attributes = True
