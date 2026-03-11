from sqlalchemy import Column, BigInteger, String, Date, Integer, Numeric, Boolean, ForeignKey
from app.database import Base

class Student(Base):
    __tablename__ = 'students'
    student_id              = Column(BigInteger, primary_key=True)
    university_id           = Column(BigInteger, nullable=False)
    user_id                 = Column(BigInteger, ForeignKey('users.user_id'), unique=True)
    usn                     = Column(String(50), nullable=False)
    program_id              = Column(BigInteger, ForeignKey('programs.program_id'), nullable=False, index=True)
    batch_id                = Column(BigInteger, ForeignKey('batches.batch_id'), nullable=False, index=True)
    section_id              = Column(BigInteger, ForeignKey('sections.section_id'), index=True)
    admission_date          = Column(Date, nullable=False)
    current_semester_number = Column(Integer)
    cgpa                    = Column(Numeric(4,2))
    status                  = Column(String(20), default='ACTIVE')
    version                 = Column(Integer, default=1)

class StudentSubjectEnrollment(Base):
    __tablename__ = 'student_subject_enrollments'
    enrollment_id   = Column(BigInteger, primary_key=True)
    university_id   = Column(BigInteger, nullable=False)
    student_id      = Column(BigInteger, ForeignKey('students.student_id'))
    offering_id     = Column(BigInteger, ForeignKey('subject_offerings.offering_id'))
    enrollment_type = Column(String(20), default='REGULAR')
    status          = Column(String(20), default='ENROLLED')
    version         = Column(Integer, default=1)

