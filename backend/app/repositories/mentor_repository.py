from sqlalchemy.orm import Session
from app.models.mentorship import MentorAssignment, MentoringSession

def get_assignments_for_mentor(db: Session, mentor_user_id: int, university_id: int):
    return db.query(MentorAssignment).filter(
        MentorAssignment.mentor_user_id == mentor_user_id,
        MentorAssignment.university_id == university_id,
        MentorAssignment.status == 'ACTIVE'
    ).all()

def get_assignment_for_student(db: Session, student_id: int, university_id: int):
    
    return db.query(MentorAssignment).filter(
        MentorAssignment.student_id == student_id,
        MentorAssignment.university_id == university_id,
        MentorAssignment.status == 'ACTIVE'
    ).first()

def get_sessions(db: Session, assignment_id: int, university_id: int):
    return db.query(MentoringSession).filter(
        MentoringSession.assignment_id == assignment_id,
        MentoringSession.university_id == university_id
    ).order_by(
        MentoringSession.session_date.desc(),
        MentoringSession.session_time.desc()
    ).all()

def create_session(db: Session, assignment_id: int, university_id: int,
                   created_by: int, data: dict):
    session = MentoringSession(
        university_id=university_id,
        assignment_id=assignment_id,
        created_by=created_by,
        **data
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_assignment_by_id(db: Session, assignment_id: int, university_id: int):
    return db.query(MentorAssignment).filter(
        MentorAssignment.assignment_id == assignment_id,
        MentorAssignment.university_id == university_id
    ).first()
