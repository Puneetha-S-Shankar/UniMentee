from datetime import datetime

from sqlalchemy import (
    Column, BigInteger, String, Integer, Numeric, Text,
    TIMESTAMP, ForeignKey,
)
from app.database import Base


class UniversitySettings(Base):
    __tablename__ = 'university_settings'

    setting_id            = Column(BigInteger, primary_key=True, index=True)
    university_id         = Column(BigInteger, nullable=False, unique=True)
    attendance_threshold  = Column(Numeric(5, 2), default=75)
    warning_threshold     = Column(Numeric(5, 2), default=80)
    auto_lock_hours       = Column(Integer, default=24)
    cgpa_good_standing    = Column(Numeric(4, 2), default=7.5)
    cgpa_warning          = Column(Numeric(4, 2), default=5.5)
    max_mentees_per_mentor = Column(Integer, default=20)
    university_name       = Column(String(255))


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    log_id        = Column(BigInteger, primary_key=True, index=True)
    university_id = Column(BigInteger, nullable=False, index=True)
    entity_type   = Column(String(50), nullable=False, index=True)
    entity_id     = Column(BigInteger)
    action        = Column(String(50), nullable=False)
    actor_id      = Column(BigInteger, ForeignKey('users.user_id'), index=True)
    changes       = Column(Text)
    created_at    = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
