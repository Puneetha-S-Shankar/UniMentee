from datetime import datetime 

from sqlalchemy import TIMESTAMP, Column, BigInteger, String, Date, Time, Integer, Boolean, Text, ForeignKey

from app.database import Base

class AttendanceSession(Base):
    __tablename__ = 'attendance_sessions'
    session_id    = Column(BigInteger, primary_key=True, index=True)
    university_id = Column(BigInteger, nullable=False)
    offering_id   = Column(BigInteger, ForeignKey('subject_offerings.offering_id'), index=True)
    session_date  = Column(Date, nullable=False)
    start_time    = Column(Time, nullable=False)
    end_time      = Column(Time, nullable=False)
    session_type  = Column(String(20), default='THEORY')
    topic_covered = Column(Text)
    conducted_by  = Column(BigInteger, ForeignKey('users.user_id'))
    total_present = Column(Integer)
    is_locked     = Column(Boolean, default=False)
    locked_at     = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    locked_by     = Column(String(20))

class AttendanceRecord(Base):
    __tablename__ = 'attendance_records'
    attendance_id = Column(BigInteger, primary_key=True, index=True)
    university_id = Column(BigInteger, nullable=False)
    session_id    = Column(BigInteger, ForeignKey('attendance_sessions.session_id'), index=True)
    student_id    = Column(BigInteger, ForeignKey('students.student_id'), index=True    )
    status        = Column(String(20), default='ABSENT')
    marked_at     = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    note          = Column(Text)

