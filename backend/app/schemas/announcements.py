from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class AnnouncementIn(BaseModel):
    title: str
    body: str
    category: str = 'ACADEMIC'
    priority: str = 'NORMAL'
    expiry_date: Optional[date] = None
    target_batch_ids: Optional[List[int]] = None
    target_section_ids: Optional[List[int]] = None


class AnnouncementOut(BaseModel):
    announcement_id: int
    title: str
    body: str
    category: str
    priority: str
    posted_at: datetime
    expiry_date: Optional[date]
    author_name: str
    class Config: from_attributes = True
