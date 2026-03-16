from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from app.database import get_db
from app.core.rbac import get_current_user
from app.services import student_service as svc
from app.schemas.students import (
    StudentOut, EnrollmentIn, EnrollmentOut,
    StudentMeOut, StudentProfileUpdate, UserOut,
    AttendanceSummary, AttendanceRecordDetail,
    OfferingMarks, AssessmentMarkDetail,
    AcademicProgressOut, UserBasic
)
from app.models.students import Student, StudentSubjectEnrollment
from app.models.users import User
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.marks import Assessment, StudentMark, StudentAcademicProgress

router = APIRouter(prefix='/students', tags=['Students'])

@router.get('', response_model=List[StudentOut])
def list_students(
    batch_id: Optional[int] = Query(None),
    section_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_students(db, user.university_id, batch_id, section_id)

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

@router.get('/me/attendance-summary', response_model=List[AttendanceSummary])
def get_my_attendance_summary(
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get attendance summary for current student grouped by subject offering"""
    # Find student
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Get all enrollments for this student
    enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.student_id == student.student_id,
        StudentSubjectEnrollment.university_id == user.university_id
    ).all()
    
    summaries = []
    
    for enrollment in enrollments:
        offering_id = enrollment.offering_id
        
        # Get all sessions for this offering
        session_ids = db.query(AttendanceSession.session_id).filter(
            AttendanceSession.offering_id == offering_id,
            AttendanceSession.university_id == user.university_id
        ).all()
        session_ids = [sid[0] for sid in session_ids]
        
        if not session_ids:
            continue
        
        # Get attendance records for this student for these sessions
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id.in_(session_ids),
            AttendanceRecord.student_id == student.student_id,
            AttendanceRecord.university_id == user.university_id
        ).all()
        
        # Count statuses
        total_sessions = len(session_ids)
        present_count = sum(1 for r in records if r.status == 'PRESENT')
        absent_count = sum(1 for r in records if r.status == 'ABSENT')
        late_count = sum(1 for r in records if r.status == 'LATE')
        
        # Calculate percentage
        if total_sessions > 0:
            percentage = ((present_count + late_count) / total_sessions) * 100
        else:
            percentage = 0.0
        
        # Build session details
        session_details = [
            AttendanceRecordDetail(
                attendance_id=r.attendance_id,
                session_id=r.session_id,
                status=r.status,
                marked_at=r.marked_at,
                note=r.note
            )
            for r in records
        ]
        
        summaries.append(AttendanceSummary(
            offering_id=offering_id,
            total_sessions=total_sessions,
            present_count=present_count,
            absent_count=absent_count,
            late_count=late_count,
            percentage=round(percentage, 2),
            sessions=session_details
        ))
    
    return summaries

@router.get('/me/marks', response_model=List[OfferingMarks])
def get_my_marks(
    term_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get marks for current student, optionally filtered by term"""
    # Find student
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Get all enrollments for this student
    enrollments_query = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.student_id == student.student_id,
        StudentSubjectEnrollment.university_id == user.university_id
    )
    
    enrollments = enrollments_query.all()
    
    offering_marks_list = []
    
    for enrollment in enrollments:
        offering_id = enrollment.offering_id
        
        # Get all published assessments for this offering
        assessments_query = db.query(Assessment).filter(
            Assessment.offering_id == offering_id,
            Assessment.university_id == user.university_id,
            Assessment.status == 'PUBLISHED'
        )
        
        assessments = assessments_query.all()
        
        if not assessments:
            continue
        
        assessment_details = []
        
        for assessment in assessments:
            # Get student's mark for this assessment
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
                is_absent = student_mark.is_absent
                
                # Calculate percentage
                if marks_obtained is not None and assessment.max_marks:
                    percentage = (marks_obtained / float(assessment.max_marks)) * 100
            
            assessment_details.append(AssessmentMarkDetail(
                assessment_id=assessment.assessment_id,
                title=assessment.title or "",
                max_marks=float(assessment.max_marks),
                marks_obtained=marks_obtained,
                is_absent=is_absent,
                status=assessment.status,
                percentage=round(percentage, 2) if percentage is not None else None
            ))
        
        if assessment_details:
            offering_marks_list.append(OfferingMarks(
                offering_id=offering_id,
                assessments=assessment_details
            ))
    
    return offering_marks_list

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

# Other student endpoints

@router.get('/{student_id}', response_model=StudentOut)
def get_student(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try: return svc.get_student(db, student_id, user.university_id)
    except LookupError as e: raise HTTPException(status_code=404, detail=str(e))

@router.get('/{student_id}/enrollments', response_model=List[EnrollmentOut])
def get_enrollments(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get_student_enrollments(db, student_id, user.university_id)

@router.post('/{student_id}/enrollments', response_model=EnrollmentOut)
def enroll(
    student_id: int, body: EnrollmentIn,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return svc.enroll(db, user.university_id, student_id, body.offering_id)
    except LookupError as e: raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
     raise HTTPException(status_code=409, detail=str(e))

@router.delete('/{student_id}/enrollments/{enrollment_id}')
def drop(
    student_id: int,
    enrollment_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try: return svc.drop(db, enrollment_id, student_id, user.university_id)
    except LookupError as e: raise HTTPException(status_code=404, detail=str(e))
