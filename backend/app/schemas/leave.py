from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date, datetime


class OfferingBasic(BaseModel):
    """Subject offering attached to a leave request (for display)."""
    offering_id: int
    subject_name: str
    class Config: from_attributes = True


class LeaveRequestIn(BaseModel):
    from_date: date
    to_date: date
    reason: str
    subject_ids: List[int] = Field(..., min_length=1)
    document_url: Optional[str] = None

    @model_validator(mode="after")
    def dates_order(self):
        if self.to_date < self.from_date:
            raise ValueError("to_date must be >= from_date")
        return self


class LeaveRequestOut(BaseModel):
    leave_id: int
    from_date: date
    to_date: date
    reason: str
    status: str
    applied_at: datetime
    document_url: Optional[str] = None
    subjects: List[OfferingBasic]
    class Config: from_attributes = True
