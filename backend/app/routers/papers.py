from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Course, Paper
from ..deps import get_current_user, require_roles
from ..services.paper_service import assemble_paper, paper_detail

router = APIRouter(prefix="/api/papers", tags=["papers"])


class AssembleReq(BaseModel):
    course_id: int
    title: str
    target_difficulty: float = 3.0
    total_score: float = 100.0
    type_distribution: dict = {}
    kp_coverage: list = []
    dim_coverage: list = []


@router.post("/assemble")
def assemble(req: AssembleReq, user: User = Depends(require_roles("admin", "teacher")),
             db: Session = Depends(get_db)):
    try:
        paper = assemble_paper(db, req.course_id, req.title, req.target_difficulty,
                               req.total_score, req.type_distribution or None,
                               req.kp_coverage or None, req.dim_coverage or None)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return paper_detail(db, paper.id)


@router.get("")
def list_papers(course_id: int = 0, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Paper)
    if course_id:
        q = q.filter(Paper.course_id == course_id)
    items = []
    for p in q.order_by(Paper.id.desc()).all():
        c = db.query(Course).get(p.course_id)
        items.append({"id": p.id, "title": p.title, "course": c.name if c else "",
                      "total_score": p.total_score, "difficulty": p.difficulty,
                      "status": p.status, "created_at": p.created_at.isoformat() if p.created_at else None})
    return {"items": items}


@router.get("/{pid}")
def detail(pid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return paper_detail(db, pid)
