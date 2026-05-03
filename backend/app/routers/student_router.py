from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.core.rbac import get_current_user, require_any_permission
from app.core.student_access import (
    assert_can_read_student,
    assert_can_mutate_enrollment,
)
from app.services import student_service as svc
from app.schemas.students import (
    StudentOut, StudentDetailOut, EnrollmentIn, EnrollmentOut,
    StudentMeOut, StudentProfileUpdate, UserOut, MentorInfoOut, UserBasic,
    AttendanceSummary,
    OfferingMarks, AssessmentMarkDetail,
    AcademicProgressOut,
    StudentAcademicSummaryOut,
)
from app.models.students import Student, StudentSubjectEnrollment
from app.models.users import User
from app.services.attendance_summary_service import build_attendance_summaries
from app.repositories import mentor_repository as mentor_repo
from app.models.academic import SubjectOffering
from app.repositories.academic_repository import get_subject_name_for_curriculum
from app.models.marks import Assessment, StudentMark, StudentAcademicProgress
from app.services.student_academic_summary_service import build_student_academic_summary

router = APIRouter(prefix='/students', tags=['Students'])

@router.get('', response_model=List[StudentOut])
def list_students(
    batch_id: Optional[int] = Query(None),
    section_id: Optional[int] = Query(None),
    program_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="ACTIVE, ALUMNI, SUSPENDED, …"),
    search: Optional[str] = Query(None, description="Match USN, name, or email"),
    user=Depends(
        require_any_permission(
            "STUDENT_VIEW",
            "USER_MANAGE",
            "ACADEMIC_MANAGE",
            "MARKS_VIEW_ALL",
        )
    ),
    db: Session = Depends(get_db),
):
    rows = svc.list_students(
        db,
        user.university_id,
        batch_id,
        section_id,
        program_id,
        status,
        search,
    )
    if not rows:
        return []
    return [
        StudentOut(
            student_id=s.student_id,
            usn=s.usn,
            program_id=s.program_id,
            batch_id=s.batch_id,
            section_id=s.section_id,
            admission_date=s.admission_date,
            current_semester_number=s.current_semester_number,
            cgpa=float(s.cgpa) if s.cgpa is not None else None,
            status=s.status,
            full_name=fn,
            email=em,
        )
        for s, fn, em in rows
    ]

# /students/me endpoints - must come before /{student_id} to avoid route conflicts

@router.get('/me', response_model=StudentMeOut)
def get_my_profile(
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current student's profile information"""
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Get user details
    user_obj = db.query(User).filter(User.user_id == user.user_id).first()
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Construct response
    return StudentMeOut(
        student_id=student.student_id,
        usn=student.usn,
        program_id=student.program_id,
        batch_id=student.batch_id,
        section_id=student.section_id,
        admission_date=student.admission_date,
        current_semester_number=student.current_semester_number,
        cgpa=float(student.cgpa) if student.cgpa else None,
        status=student.status,
        user=UserBasic(
            full_name=user_obj.full_name,
            email=user_obj.email
        )
    )

@router.put('/me/profile', response_model=UserOut)
def update_my_profile(
    body: StudentProfileUpdate,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Update current student's profile (full_name only)"""
    # Find student to verify they exist
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Update user's full_name
    user_obj = db.query(User).filter(User.user_id == user.user_id).first()
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")
    
    if body.full_name is not None:
        user_obj.full_name = body.full_name
    
    db.commit()
    db.refresh(user_obj)
    
    return UserOut(
        user_id=user_obj.user_id,
        full_name=user_obj.full_name,
        email=user_obj.email,
        status=user_obj.status
    )


@router.get('/me/mentor-info', response_model=MentorInfoOut)
def get_my_mentor_info(
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Mentor name/email for active assignment, if any."""
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id,
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    a = mentor_repo.get_assignment_for_student(db, student.student_id, user.university_id)
    if not a:
        return MentorInfoOut()
    mentor = db.query(User).filter(User.user_id == a.mentor_user_id).first()
    return MentorInfoOut(
        assignment_id=a.assignment_id,
        mentor_user_id=a.mentor_user_id,
        mentor_name=mentor.full_name if mentor else None,
        mentor_email=mentor.email if mentor else None,
    )


@router.get('/me/attendance-summary', response_model=List[AttendanceSummary])
def get_my_attendance_summary(
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get attendance summary for current student grouped by subject offering"""
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    return build_attendance_summaries(db, student.student_id, user.university_id)

@router.get('/me/marks', response_model=List[OfferingMarks])
def get_my_marks(
    term_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Published marks per offering; optional term_id filter."""
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.student_id == student.student_id,
        StudentSubjectEnrollment.university_id == user.university_id
    ).all()

    out: List[OfferingMarks] = []

    for enrollment in enrollments:
        offering = db.query(SubjectOffering).filter(
            SubjectOffering.offering_id == enrollment.offering_id,
            SubjectOffering.university_id == user.university_id,
        ).first()
        if not offering:
            continue
        if term_id is not None and offering.term_id != term_id:
            continue

        assessments = db.query(Assessment).filter(
            Assessment.offering_id == offering.offering_id,
            Assessment.university_id == user.university_id,
            Assessment.status == 'PUBLISHED',
        ).all()

        if not assessments:
            continue

        assessment_details: List[AssessmentMarkDetail] = []

        for assessment in assessments:
            student_mark = db.query(StudentMark).filter(
                StudentMark.assessment_id == assessment.assessment_id,
                StudentMark.student_id == student.student_id,
                StudentMark.university_id == user.university_id
            ).first()

            marks_obtained = None
            is_absent = False
            percentage = None

            if student_mark:
                marks_obtained = float(student_mark.marks_obtained) if student_mark.marks_obtained else None
                is_absent = bool(student_mark.is_absent)

            max_m = float(assessment.max_marks) if assessment.max_marks is not None else 0.0
            if marks_obtained is not None and max_m > 0:
                percentage = (marks_obtained / max_m) * 100

            assessment_details.append(AssessmentMarkDetail(
                assessment_id=assessment.assessment_id,
                title=assessment.title or "",
                max_marks=max_m,
                marks_obtained=marks_obtained,
                is_absent=is_absent,
                status=assessment.status,
                percentage=round(percentage, 2) if percentage is not None else None
            ))

        subject_name = get_subject_name_for_curriculum(
            db, offering.curriculum_id, user.university_id
        )

        out.append(OfferingMarks(
            offering_id=offering.offering_id,
            subject_name=subject_name,
            assessments=assessment_details,
        ))

    return out

@router.get('/me/progress', response_model=List[AcademicProgressOut])
def get_my_progress(
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get academic progress records for current student"""
    # Find student
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Get all progress records
    progress_records = db.query(StudentAcademicProgress).filter(
        StudentAcademicProgress.student_id == student.student_id
    ).all()
    
    return [
        AcademicProgressOut(
            progress_id=p.progress_id,
            student_id=p.student_id,
            academic_year_id=p.academic_year_id,
            term_id=p.term_id,
            semester_number=p.semester_number,
            sgpa=float(p.sgpa) if p.sgpa else None,
            cgpa=float(p.cgpa) if p.cgpa else None,
            sgpa_status=p.sgpa_status
        )
        for p in progress_records
    ]

# Other student endpoints — register /{student_id}/... before /{student_id}

@router.get('/{student_id}/progress', response_model=List[AcademicProgressOut])
def get_student_progress(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Academic progress for a student (self, staff, or assigned mentor)."""
    assert_can_read_student(db, user, student_id, user.university_id)
    try:
        svc.get_student(db, student_id, user.university_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    progress_records = db.query(StudentAcademicProgress).filter(
        StudentAcademicProgress.student_id == student_id
    ).all()
    return [
        AcademicProgressOut(
            progress_id=p.progress_id,
            student_id=p.student_id,
            academic_year_id=p.academic_year_id,
            term_id=p.term_id,
            semester_number=p.semester_number,
            sgpa=float(p.sgpa) if p.sgpa else None,
            cgpa=float(p.cgpa) if p.cgpa else None,
            sgpa_status=p.sgpa_status
        )
        for p in progress_records
    ]


@router.get('/{student_id}/academic-summary', response_model=StudentAcademicSummaryOut)
def get_student_academic_summary(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """SGPA/CGPA trend from published marks (and grade scale); falls back to ``student_academic_progress``."""
    assert_can_read_student(db, user, student_id, user.university_id)
    try:
        svc.get_student(db, student_id, user.university_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return build_student_academic_summary(db, student_id, user.university_id)


@router.get('/{student_id}/enrollments', response_model=List[EnrollmentOut])
def get_enrollments(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    assert_can_read_student(db, user, student_id, user.university_id)
    return svc.get_student_enrollments(db, student_id, user.university_id)

@router.post('/{student_id}/enrollments', response_model=EnrollmentOut)
def enroll(
    student_id: int, body: EnrollmentIn,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    assert_can_mutate_enrollment(db, user, student_id, user.university_id)
    try:
        return svc.enroll(db, user.university_id, student_id, body.offering_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get('/{student_id}', response_model=StudentDetailOut)
def get_student(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    assert_can_read_student(db, user, student_id, user.university_id)
    try:
        student = svc.get_student(db, student_id, user.university_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    user_obj = db.query(User).filter(User.user_id == student.user_id).first()
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found for student")
    return StudentDetailOut(
        student_id=student.student_id,
        usn=student.usn,
        program_id=student.program_id,
        batch_id=student.batch_id,
        section_id=student.section_id,
        admission_date=student.admission_date,
        current_semester_number=student.current_semester_number,
        cgpa=float(student.cgpa) if student.cgpa else None,
        status=student.status,
        user=UserBasic(full_name=user_obj.full_name, email=user_obj.email),
    )


@router.delete('/{student_id}/enrollments/{enrollment_id}')
def drop(
    student_id: int,
    enrollment_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    assert_can_mutate_enrollment(db, user, student_id, user.university_id)
    try:
        return svc.drop(db, enrollment_id, student_id, user.university_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
