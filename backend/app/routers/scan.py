from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, ScanBatch, ScanPaper, Exam
from ..deps import get_current_user, require_roles
from ..services import grading_service as gs

router = APIRouter(prefix="/api/scan", tags=["scan"])


class BatchReq(BaseModel):
    exam_id: int
    title: str = ""


@router.post("/batch")
def create_batch(req: BatchReq, user: User = Depends(require_roles("admin", "teacher")),
                 db: Session = Depends(get_db)):
    b = ScanBatch(exam_id=req.exam_id, title=req.title or "扫描阅卷批次")
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id}


class PaperReq(BaseModel):
    batch_id: int
    student_no: str
    student_name: str
    scan_url: str = ""
    answers: dict = {}   # {question_id: answer_text}
    full_scores: dict = {}  # {question_id: full_score}


@router.post("/paper")
def add_paper(req: PaperReq, user: User = Depends(require_roles("admin", "teacher")),
              db: Session = Depends(get_db)):
    """扫描答题卡识别（OCR 结果）→ 自动评阅"""
    batch = db.query(ScanBatch).get(req.batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")
    total = 0.0
    details = []
    for qid, ans in req.answers.items():
        from ..models import Question
        q = db.query(Question).get(int(qid))
        if not q:
            continue
        full = req.full_scores.get(qid, 5.0)
        if q.type in ("single_choice", "multiple_choice", "judge", "fill"):
            r = gs.grade_objective(q.type, ans, q.answer, full)
            score = r["score"]
        else:
            r = gs.grade_subjective(ans, {"answer": q.answer or "", "scoring_rubric": q.scoring_rubric or {}}, full)
            score = r["score"]
        total += score
        details.append({"question_id": q.id, "type": q.type, "score": score, "feedback": r["feedback"]})
    paper = ScanPaper(batch_id=req.batch_id, student_no=req.student_no, student_name=req.student_name,
                      scan_url=req.scan_url, ocr_status="done", grading_status="graded",
                      total_score=round(total, 1), grading_detail=details)
    db.add(paper)
    batch.total_papers = db.query(ScanPaper).filter_by(batch_id=req.batch_id).count() + 1
    batch.status = "grading_done"
    db.commit()
    return {"paper_id": paper.id, "total_score": paper.total_score}
