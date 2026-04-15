from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

class StudentOut(BaseModel):
    student_id: int
    usn: str
    program_id: int
    batch_id: int
    section_id: Optional[int]
    admission_date: Optional[date] = None
    current_semester_number: Optional[int]
    cgpa: Optional[float]
    status: str
    full_name: Optional[str] = None
    email: Optional[str] = None
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


class StudentDetailOut(StudentOut):
    """GET /students/{id} — includes linked user display name and email."""
    user: UserBasic


class StudentMeOut(BaseModel):
    student_id: int
    usn: str
    program_id: int
    batch_id: int
    section_id: Optional[int]
    admission_date: Optional[date] = None
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


class MentorInfoOut(BaseModel):
    """Active mentor assignment for the current student (empty if none)."""
    assignment_id: Optional[int] = None
    mentor_user_id: Optional[int] = None
    mentor_name: Optional[str] = None
    mentor_email: Optional[str] = None


# Attendance schemas
class AttendanceSessionDetail(BaseModel):
    session_id: int
    session_date: date
    session_type: str
    status: str  # PRESENT | ABSENT | LATE | ON_LEAVE
    remark: Optional[str] = None
    class Config: from_attributes = True

class AttendanceSummary(BaseModel):
    offering_id: int
    subject_code: str
    subject_name: str
    total_sessions: int
    present: int
    absent: int
    late: int
    percentage: float
    sessions: List[AttendanceSessionDetail]
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
    subject_name: Optional[str] = None
    assessments: List[AssessmentMarkDetail]
    class Config: from_attributes = True

class StudentAssessmentMarkOut(BaseModel):
    assessment_id: int
    title: str
    assessment_type_code: str
    max_marks: float
    marks_obtained: Optional[float]
    is_absent: bool
    percentage: Optional[float]
    status: str
    class Config: from_attributes = True

class StudentSubjectMarksOut(BaseModel):
    subject_name: str
    subject_code: str
    assessments: List[StudentAssessmentMarkOut]
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


class AcademicTrendPointOut(BaseModel):
    term_id: int
    term: str
    sgpa: float


class StudentAcademicSummaryOut(BaseModel):
    latest_sgpa: Optional[float] = None
    cgpa: Optional[float] = None
    trend: List[AcademicTrendPointOut] = Field(default_factory=list)
