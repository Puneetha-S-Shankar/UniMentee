from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.database import get_db
from app.core.rbac import get_current_user
from app.models.students import Student
from app.models.leave import LeaveRequest, LeaveRequestSubject
from app.schemas.leave import LeaveRequestIn, LeaveRequestOut, OfferingBasic

router = APIRouter(prefix='/leave-requests', tags=['Leave Requests'])


def _get_student(db: Session, user) -> Student:
    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id,
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


def _to_out(db: Session, lr: LeaveRequest) -> LeaveRequestOut:
    subjects = db.query(LeaveRequestSubject).filter(
        LeaveRequestSubject.leave_request_id == lr.leave_id,
    ).all()
    return LeaveRequestOut(
        leave_id=lr.leave_id,
        from_date=lr.from_date,
        to_date=lr.to_date,
        reason=lr.reason,
        status=lr.status,
        applied_at=lr.applied_at,
        document_url=lr.document_url,
        subjects=[OfferingBasic(offering_id=s.offering_id) for s in subjects],
    )


# ── list my leave requests ──────────────────────────────────────────

@router.get('', response_model=List[LeaveRequestOut])
def list_my_leave_requests(
    user=Depends(get_current_user), db: Session = Depends(get_db),
):
    student = _get_student(db, user)

    requests = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.student_id == student.student_id,
            LeaveRequest.university_id == user.university_id,
        )
        .order_by(LeaveRequest.applied_at.desc())
        .all()
    )

    return [_to_out(db, lr) for lr in requests]


# ── create leave request ────────────────────────────────────────────

@router.post('', response_model=LeaveRequestOut, status_code=201)
def create_leave_request(
    body: LeaveRequestIn,
    user=Depends(get_current_user), db: Session = Depends(get_db),
):
    if body.from_date < date.today():
        raise HTTPException(status_code=400, detail="from_date must be today or later")

    student = _get_student(db, user)

    lr = LeaveRequest(
        university_id=user.university_id,
        student_id=student.student_id,
        from_date=body.from_date,
        to_date=body.to_date,
        reason=body.reason,
        document_url=body.document_url,
        status='PENDING',
    )
    db.add(lr)
    db.flush()

    for oid in body.subject_ids:
        db.add(LeaveRequestSubject(leave_request_id=lr.leave_id, offering_id=oid))

    db.commit()
    db.refresh(lr)
    return _to_out(db, lr)


# ── cancel leave request ────────────────────────────────────────────

@router.delete('/{leave_id}')
def cancel_leave_request(
    leave_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db),
):
    student = _get_student(db, user)

    lr = db.query(LeaveRequest).filter(
        LeaveRequest.leave_id == leave_id,
        LeaveRequest.university_id == user.university_id,
    ).first()
    if not lr:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if lr.student_id != student.student_id:
        raise HTTPException(status_code=403, detail="Not your leave request")

    if lr.status != 'PENDING':
        raise HTTPException(status_code=400, detail="Only PENDING requests can be cancelled")

    lr.status = 'CANCELLED'
    db.commit()
    return {"detail": "Leave request cancelled"}
