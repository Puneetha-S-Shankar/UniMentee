from pydantic import BaseModel
from typing import Optional
from datetime import date

class StudentOut(BaseModel):
    student_id: int
    usn: str
    program_id: int
    batch_id: int
    section_id: Optional[int]
    current_semester_number: Optional[int]
    cgpa: Optional[float]
    status: str
    class Config: from_attributes = True

class EnrollmentIn(BaseModel):
    offering_id: int

class EnrollmentOut(BaseModel):
    enrollment_id: int
    university_id: int
    student_id: int
    offering_id: int
    enrollment_type: str
    status: str
    class Config: from_attributes = True
