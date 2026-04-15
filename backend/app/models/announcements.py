from datetime import datetime

from sqlalchemy import Column, BigInteger, String, Date, Text, TIMESTAMP, ForeignKey
from app.database import Base


class Announcement(Base):
    __tablename__ = 'announcements'

    announcement_id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    university_id   = Column(BigInteger, nullable=False)
    author_user_id  = Column(BigInteger, ForeignKey('users.user_id'), nullable=False, index=True)
    title           = Column(String(255), nullable=False)
    body            = Column(Text, nullable=False)
    category        = Column(String(30), nullable=False, default='ACADEMIC')
    priority        = Column(String(20), nullable=False, default='NORMAL')
    posted_at       = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    expiry_date     = Column(Date)
    status          = Column(String(20), default='PUBLISHED')


class AnnouncementTarget(Base):
    __tablename__ = 'announcement_targets'

    id              = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    announcement_id = Column(BigInteger, ForeignKey('announcements.announcement_id'), nullable=False, index=True)
    target_type     = Column(String(20), nullable=False)
    target_id       = Column(BigInteger)
