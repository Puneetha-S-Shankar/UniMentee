from sqlalchemy import Column, BigInteger, String, Numeric, Boolean, Integer, Text, Date
from sqlalchemy import ForeignKey

from app.database import Base

class AssessmentType(Base):
    __tablename__ = 'assessment_types'
    assessment_type_id = Column(BigInteger, primary_key=True, index=True)
    university_id      = Column(BigInteger, nullable=False)
    name               = Column(String(100), nullable=False)
    code               = Column(String(20), nullable=False)
    weightage          = Column(Numeric(5,2))
    is_internal        = Column(Boolean, default=True)

class Assessment(Base):
    __tablename__ = 'assessments'
    assessment_id      = Column(BigInteger, primary_key=True, index=True)
    university_id      = Column(BigInteger, nullable=False)
    offering_id        = Column(BigInteger, ForeignKey('subject_offerings.offering_id'), index=True)
    assessment_type_id = Column(BigInteger, ForeignKey('assessment_types.assessment_type_id'), index=True)
    title              = Column(String(255))
    max_marks          = Column(Numeric(6,2), nullable=False)
    passing_marks      = Column(Numeric(6,2))
    conducted_on       = Column(Date)
    status             = Column(String(20), default='DRAFT')
    submitted_by       = Column(BigInteger)
    verified_by        = Column(BigInteger)
    published_by       = Column(BigInteger)
    send_back_reason   = Column(Text)
    version            = Column(Integer, default=1)



class StudentMark(Base):
    __tablename__ = 'student_marks'
    mark_id        = Column(BigInteger, primary_key=True, index=True)
    university_id  = Column(BigInteger, nullable=False , index=True)
    assessment_id  = Column(BigInteger, ForeignKey('assessments.assessment_id'), index=True)
    student_id     = Column(BigInteger, ForeignKey('students.student_id'), index=True)
    marks_obtained = Column(Numeric(6,2))
    is_absent      = Column(Boolean, default=False)
    remark         = Column(Text)
    entered_by     = Column(BigInteger, ForeignKey('users.user_id'))
    version        = Column(Integer, default=1)

class StudentAcademicProgress(Base):
    __tablename__ = 'student_academic_progress'
    progress_id      = Column(BigInteger, primary_key=True, index=True)
    student_id       = Column(BigInteger, ForeignKey('students.student_id'), index=True)
    academic_year_id = Column(BigInteger, nullable=False)
    term_id          = Column(BigInteger, nullable=False)
    semester_number  = Column(Integer, nullable=False)
    sgpa             = Column(Numeric(4,2))
    cgpa             = Column(Numeric(4,2))
    sgpa_status      = Column(String(20), default='PENDING')

class GradeScale(Base):
    __tablename__ = 'grade_scales'
    grade_scale_id = Column(BigInteger, primary_key=True)
    university_id  = Column(BigInteger, nullable=False)
    grade_letter   = Column(String(5), nullable=False)
    grade_point    = Column(Numeric(4,2), nullable=False)
    min_percentage = Column(Numeric(5,2), nullable=False)
    max_percentage = Column(Numeric(5,2), nullable=False)
    is_passing     = Column(Boolean, default=True)
