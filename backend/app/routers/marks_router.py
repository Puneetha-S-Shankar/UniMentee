from fastapi import APIRouter, Body, Depends, HTTPException, Query

from sqlalchemy.orm import Session

from pydantic import BaseModel

from typing import Optional, List, Annotated

from app.database import get_db

from app.core.rbac import get_current_user, require_permission

from app.services import marks_service as svc

from app.schemas.marks import (

    AssessmentIn,

    AssessmentOut,

    AssessmentStatusBody,

    MarkRowOut,

)





router = APIRouter(prefix='/marks', tags=['Marks'])





class MarkIn(BaseModel):

    student_id: int

    marks_obtained: Optional[float]

    is_absent: bool = False

    version: int = 1





class MarkOut(BaseModel):

    mark_id: int

    assessment_id: int

    student_id: int

    marks_obtained: Optional[float]

    is_absent: bool

    version: int



    class Config:

        from_attributes = True





@router.get('/offerings/{offering_id}/assessments', response_model=List[AssessmentOut])

def list_assessments(

    offering_id: int,

    user=Depends(get_current_user),

    db=Depends(get_db),

):

    return svc.get_assessments(db, offering_id, user.university_id)





@router.post('/offerings/{offering_id}/assessments', response_model=AssessmentOut)

def create_assessment(

    offering_id: int,

    body: AssessmentIn,

    user=Depends(require_permission("MARKS_ENTER")),

    db=Depends(get_db),

):

    try:

        return svc.create_assessment(

            db,

            user.university_id,

            offering_id,

            body.assessment_type_id,

            body.title,

            body.max_marks,

            body.passing_marks,

            body.conducted_on,

        )

    except ValueError as e:

        raise HTTPException(status_code=400, detail=str(e))





@router.get('/assessments/{assessment_id}/marks', response_model=List[MarkRowOut])

def list_marks(

    assessment_id: int,

    include_students: bool = Query(

        False,

        description="Include USN and student name for verification views",

    ),

    user=Depends(get_current_user),

    db=Depends(get_db),

):

    if not svc.can_view_assessment_marks(db, user, assessment_id, user.university_id):

        raise HTTPException(status_code=403, detail="Not allowed to view marks for this assessment")

    return svc.get_marks_for_display(

        db, assessment_id, user.university_id, include_students=include_students

    )





@router.put('/assessments/{assessment_id}/marks/{student_id}', response_model=MarkOut)

def upsert_mark(

    assessment_id: int,

    student_id: int,

    body: MarkIn,

    user=Depends(require_permission("MARKS_ENTER")),

    db=Depends(get_db),

):

    try:

        return svc.upsert_mark(

            db,

            user.university_id,

            assessment_id,

            student_id,

            body.marks_obtained,

            body.is_absent,

            user.user_id,

            body.version,

        )

    except ValueError as e:

        raise HTTPException(status_code=409, detail=str(e))

    except Exception as e:

        raise HTTPException(status_code=400, detail=str(e))





@router.patch('/assessments/{assessment_id}/status', response_model=AssessmentOut)

def patch_assessment_status(

    assessment_id: int,

    body: Annotated[Optional[AssessmentStatusBody], Body()] = None,

    user=Depends(get_current_user),

    db=Depends(get_db),

):

    req = body or AssessmentStatusBody()

    try:

        return svc.update_assessment_status(

            db,

            assessment_id,

            user.university_id,

            user,

            action=req.action,

            reason=req.reason,

        )

    except LookupError as e:

        raise HTTPException(status_code=404, detail=str(e))

    except ValueError as e:

        detail = str(e)

        if detail.startswith("Not allowed"):

            raise HTTPException(status_code=403, detail=detail)

        raise HTTPException(status_code=400, detail=detail)

