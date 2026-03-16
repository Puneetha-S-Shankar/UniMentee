from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

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

# New schemas for /students/me endpoints
class UserBasic(BaseModel):
    full_name: str
    email: str
    class Config: from_attributes = True

class StudentMeOut(BaseModel):
    student_id: int
    usn: str
    program_id: int
    batch_id: int
    section_id: Optional[int]
    current_semester_number: Optional[int]
    cgpa: Optional[float]
    status: str
    user: UserBasic
    class Config: from_attributes = True

class StudentProfileUpdate(BaseModel):
    full_name: Optional[str] = None

class UserOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    status: str
    class Config: from_attributes = True

# Attendance schemas
class AttendanceRecordDetail(BaseModel):
    attendance_id: int
    session_id: int
    status: str
    marked_at: datetime
    note: Optional[str]
    class Config: from_attributes = True

class AttendanceSummary(BaseModel):
    offering_id: int
    total_sessions: int
    present_count: int
    absent_count: int
    late_count: int
    percentage: float
    sessions: List[AttendanceRecordDetail]
    class Config: from_attributes = True

# Marks schemas
class AssessmentMarkDetail(BaseModel):
    assessment_id: int
    title: str
    max_marks: float
    marks_obtained: Optional[float]
    is_absent: bool
    status: str
    percentage: Optional[float]
    class Config: from_attributes = True

class OfferingMarks(BaseModel):
    offering_id: int
    assessments: List[AssessmentMarkDetail]
    class Config: from_attributes = True

# Progress schema
class AcademicProgressOut(BaseModel):
    progress_id: int
    student_id: int
    academic_year_id: int
    term_id: int
    semester_number: int
    sgpa: Optional[float]
    cgpa: Optional[float]
    sgpa_status: str
    class Config: from_attributes = True
