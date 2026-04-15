from pydantic import BaseModel
from typing import Optional, Literal

class ProgramOut(BaseModel):
    program_id: int
    name: str
    code: str
    degree_type: str
    duration_years: float
    total_semesters: int
    status: str
    class Config: from_attributes = True

class BatchOut(BaseModel):
    batch_id: int
    program_id: int
    batch_year: int
    status: str
    class Config: from_attributes = True


class SectionOut(BaseModel):
    section_id: int
    batch_id: int
    name: str
    capacity: Optional[int] = None
    current_strength: Optional[int] = None
    status: str
    class Config: from_attributes = True

class SubjectOut(BaseModel):
    subject_id: int
    subject_code: str
    subject_name: str
    credits: float
    subject_type: str
    theory_hours: Optional[float] = None
    lab_hours: Optional[float] = None
    is_active: bool
    class Config: from_attributes = True

class OfferingOut(BaseModel):
    offering_id: int
    curriculum_id: int
    batch_id: int
    section_id: Optional[int]
    academic_year_id: int
    term_id: int
    course_lead_id: Optional[int] = None
    status: str
    current_enrollment: int
    max_enrollment: Optional[int]
    version: int
    class Config: from_attributes = True

class OfferingStatusUpdate(BaseModel):
    status: str  # DRAFT | PLANNED | ACTIVE | COMPLETED | LOCKED | ARCHIVED
    version: int  # optimistic locking — send current version

#POST API CALLS
class ProgramIn(BaseModel):
    department_id:    Optional[int]=None
    name:             str
    code:             str
    degree_type:      str  # e.g. "B.Tech", "BCA", "B.Sc"
    duration_years:   float
    total_semesters:  int  # must be 1-12 (mirrors DB CHECK constraint)
    total_credits:    Optional[int]
    
class BatchIn(BaseModel):
    program_id:  int
    batch_year:  int
    start_year:  int
    end_year:    int
    
class SubjectIn(BaseModel):
    department_id:  Optional[int]
    subject_code:   str
    subject_name:   str
    credits:        float
    theory_hours:   Optional[float]
    lab_hours:      Optional[float]
    subject_type:   str = 'THEORY'  # THEORY | LAB | THEORY_LAB
    
class OfferingIn(BaseModel):
    curriculum_id:    int
    batch_id:         int
    academic_year_id: int
    term_id:          int
    section_id:       Optional[int]
    max_enrollment:   Optional[int]


class ProgramStatusUpdate(BaseModel):
    status: Literal['ACTIVE', 'ARCHIVED']


class SectionIn(BaseModel):
    batch_id: int
    name: str
    capacity: int = 60


class TermOut(BaseModel):
    term_id: int
    name: str
    academic_year_id: int
    is_current: bool
    class Config: from_attributes = True


class GradeScaleOut(BaseModel):
    """API grade band; ``grade`` is the letter (e.g. A+). Maps from DB ``grade_letter`` when present."""
    grade: str
    grade_point: float
    min_percentage: float
    max_percentage: float
    is_passing: bool
    class Config: from_attributes = True


class AssessmentTypeOut(BaseModel):
    assessment_type_id: int
    name: str
    code: str
    weightage: Optional[float]
    is_internal: bool

    class Config:
        from_attributes = True

