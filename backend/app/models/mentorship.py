from sqlalchemy import Column, BigInteger, String, Date, Time, Integer, Boolean, Text, ForeignKey

from app.database import Base


class MentorAssignment(Base):
    __tablename__ = 'mentor_assignments'

    assignment_id    = Column(BigInteger, primary_key=True, index=True)
    university_id    = Column(BigInteger, nullable=False)
    student_id       = Column(BigInteger, ForeignKey('students.student_id'), index=True)
    mentor_user_id   = Column(BigInteger, ForeignKey('users.user_id'), index=True)
    academic_year_id = Column(BigInteger, nullable=False)
    assigned_by      = Column(BigInteger)
    status           = Column(String(20), default='ACTIVE')
    version          = Column(Integer, default=1)

class MentoringSession(Base):
    __tablename__ = 'mentoring_sessions'

    session_id          = Column(BigInteger, primary_key=True, index=True)
    university_id       = Column(BigInteger, nullable=False)
    assignment_id       = Column(BigInteger, ForeignKey('mentor_assignments.assignment_id'), index=True)
    session_date        = Column(Date, nullable=False)
    session_time        = Column(Time)
    duration_minutes    = Column(Integer)
    session_type        = Column(String(20), default='IN_PERSON')
    topics_discussed    = Column(Text)
    action_items        = Column(Text)
    follow_up_required  = Column(Boolean, default=False)
    follow_up_date      = Column(Date)
    career_notes        = Column(Text)
    created_by          = Column(BigInteger, ForeignKey('users.user_id'))