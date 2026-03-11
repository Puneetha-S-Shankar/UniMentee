from pydantic import BaseModel
from typing import Optional

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

class SubjectOut(BaseModel):
    subject_id: int
    subject_code: str
    subject_name: str
    credits: float
    subject_type: str
    is_active: bool
    class Config: from_attributes = True

class OfferingOut(BaseModel):
    offering_id: int
    batch_id: int
    section_id: Optional[int]
    status: str
    current_enrollment: int
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

