from sqlalchemy import Column, BigInteger, String, Boolean, Numeric, Integer, Date
from sqlalchemy import ForeignKey, Text

from app.database import Base

class Department(Base):
    __tablename__ = 'departments'
    department_id = Column(BigInteger, primary_key=True)
    university_id = Column(BigInteger, nullable=False)
    name          = Column(String(255), nullable=False)
    code          = Column(String(50), nullable=False)
    is_active     = Column(Boolean, default=True)


class Program(Base):
    __tablename__ = 'programs'
    program_id       = Column(BigInteger, primary_key=True, autoincrement=True)
    university_id    = Column(BigInteger, nullable=False)
    department_id    = Column(BigInteger, ForeignKey('departments.department_id'))
    name             = Column(String(255), nullable=False)
    code             = Column(String(50), nullable=False)
    degree_type      = Column(String(50), nullable=False)
    duration_years   = Column(Numeric(3,1), nullable=False)
    total_semesters  = Column(Integer, nullable=False)
    total_credits     = Column(Numeric(4,2), nullable=False)
    status           = Column(String(20), default='ACTIVE')

class Batch(Base):
    __tablename__ = 'batches'
    batch_id      = Column(BigInteger, primary_key=True)
    university_id = Column(BigInteger, nullable=False)
    program_id    = Column(BigInteger, ForeignKey('programs.program_id'))
    batch_year    = Column(Integer, nullable=False)
    start_year    = Column(Integer, nullable=False)
    end_year      = Column(Integer, nullable=False)
    status        = Column(String(20), default='ACTIVE')

class Section(Base):
    __tablename__ = 'sections'
    section_id         = Column(BigInteger, primary_key=True)
    university_id      = Column(BigInteger, nullable=False)
    batch_id           = Column(BigInteger, ForeignKey('batches.batch_id'))
    name               = Column(String(10), nullable=False)
    capacity           = Column(Integer, default=60)
    current_strength   = Column(Integer, default=0)
    status             = Column(String(20), default='ACTIVE')

class Subject(Base):
    __tablename__ = 'subjects'
    department_id    = Column(BigInteger, ForeignKey('departments.department_id'), nullable=True)
    subject_id    = Column(BigInteger, primary_key=True)
    university_id = Column(BigInteger, nullable=False)
    subject_code  = Column(String(50), nullable=False)
    subject_name  = Column(String(255), nullable=False)
    credits       = Column(Numeric(4,2), nullable=False)
    theory_hours  = Column(Numeric(4,2))
    lab_hours     = Column(Numeric(4,2))
    subject_type  = Column(String(20), default='THEORY')
    is_active     = Column(Boolean, default=True)

class SubjectOffering(Base):
    __tablename__ = 'subject_offerings'
    offering_id         = Column(BigInteger, primary_key=True)
    university_id       = Column(BigInteger, nullable=False)
    curriculum_id       = Column(BigInteger, nullable=False)
    batch_id            = Column(BigInteger, ForeignKey('batches.batch_id'))
    academic_year_id    = Column(BigInteger, nullable=False)
    term_id             = Column(BigInteger, nullable=False)
    section_id          = Column(BigInteger, ForeignKey('sections.section_id'))
    course_lead_id      = Column(BigInteger)
    status              = Column(String(20), default='DRAFT')
    current_enrollment  = Column(Integer, default=0)
    max_enrollment      = Column(Integer)
    version             = Column(Integer, default=1)

