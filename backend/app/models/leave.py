from datetime import datetime

from sqlalchemy import Column, BigInteger, String, Date, Text, TIMESTAMP, ForeignKey
from app.database import Base


class LeaveRequest(Base):
    __tablename__ = 'leave_requests'

    leave_id      = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    university_id = Column(BigInteger, nullable=False)
    student_id    = Column(BigInteger, ForeignKey('students.student_id'), nullable=False, index=True)
    from_date     = Column(Date, nullable=False)
    to_date       = Column(Date, nullable=False)
    reason        = Column(Text, nullable=False)
    document_url  = Column(String(500))
    status        = Column(String(20), nullable=False, default='PENDING')
    applied_at    = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    reviewed_by   = Column(BigInteger, ForeignKey('users.user_id'))
    review_note   = Column(Text)


class LeaveRequestSubject(Base):
    __tablename__ = 'leave_request_subjects'

    id               = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    leave_request_id = Column(BigInteger, ForeignKey('leave_requests.leave_id'), nullable=False, index=True)
    offering_id      = Column(BigInteger, ForeignKey('subject_offerings.offering_id'), nullable=False)
