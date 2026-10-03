from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    User, Exam, ExamSession, CapabilitySnapshot, CapabilityDimension, CapabilityScore,
    CapabilityEvidence, Course,
)
from ..deps import get_current_user
from ..services.knowledge_service import (
    generate_capability_snapshot, snapshot_to_dict, knowledge_graph_data,
    ensure_dimensions,
)

router = APIRouter(prefix="/api/capability", tags=["capability"])


def ensure_snapshot_evidence(db: Session, snapshot: CapabilitySnapshot):
    """为旧画像和新画像补齐可追溯的能力证据记录。"""
    if db.query(CapabilityEvidence).filter_by(snapshot_id=snapshot.id).first():
        return
    for score in db.query(CapabilityScore).filter_by(snapshot_id=snapshot.id).all():
        db.add(CapabilityEvidence(
            user_id=snapshot.user_id, snapshot_id=snapshot.id, dimension_id=score.dimension_id,
            source_type="knowledge_inference" if score.inferred else "exam_answer",
            source_ref=f"exam:{snapshot.exam_id}", evidence_value=score.score,
            reliability=0.76 if score.inferred else min(0.98, 0.80 + score.question_count * 0.025),
            occurred_at=snapshot.generated_at,
        ))
    db.commit()


@router.get("/dimensions")
def dimensions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_dimensions(db)
    dims = db.query(CapabilityDimension).order_by(CapabilityDimension.category, CapabilityDimension.id).all()
    cats = {}
    for d in dims:
        cats.setdefault(d.category, []).append({"id": d.id, "code": d.code, "name": d.name, "metric": d.metric})
    return {"total": len(dims), "categories": cats, "items": [
        {"id": d.id, "code": d.code, "name": d.name, "category": d.category, "metric": d.metric} for d in dims]}


class GenerateReq(BaseModel):
    exam_id: int
    user_id: int = 0


@router.post("/generate")
def generate(req: GenerateReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """由考试成绩生成能力画像（分数 → 能力画像）"""
    exam = db.query(Exam).get(req.exam_id)
    if not exam:
        raise HTTPException(404, "考试不存在")
    target_uid = req.user_id or user.id
    session = db.query(ExamSession).filter_by(exam_id=req.exam_id, user_id=target_uid).order_by(ExamSession.id.desc()).first()
    if not session:
        raise HTTPException(400, "该考生未参加本场考试")
    if session.final_score is None and session.ai_score is None:
        raise HTTPException(400, "本场考试尚未评阅完成")
    snapshot = generate_capability_snapshot(db, target_uid, exam, session)
    ensure_snapshot_evidence(db, snapshot)
    course = db.query(Course).get(exam.course_id)
    return snapshot_to_dict(db, snapshot, course)


@router.get("/my")
def my_portrait(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    snapshots = db.query(CapabilitySnapshot).filter_by(user_id=user.id).order_by(CapabilitySnapshot.id.desc()).all()
    if not snapshots:
        return {"exists": False}
    s = snapshots[0]
    ensure_snapshot_evidence(db, s)
    course = db.query(Course).get(s.course_id)
    detail = snapshot_to_dict(db, s, course)
    dimension_map = {d.id: d for d in db.query(CapabilityDimension).all()}
    evidence = db.query(CapabilityEvidence).filter_by(snapshot_id=s.id).all()
    category_stats = {}
    for score in db.query(CapabilityScore).filter_by(snapshot_id=s.id).all():
        dim = dimension_map.get(score.dimension_id)
        category = dim.category if dim else "其他"
        bucket = category_stats.setdefault(category, {"score_sum": 0, "count": 0, "direct": 0})
        bucket["score_sum"] += score.score or 0
        bucket["count"] += 1
        bucket["direct"] += 0 if score.inferred else 1
    categories = [{"name": k, "score": round(v["score_sum"] / max(v["count"], 1), 1),
                   "dimension_count": v["count"], "direct_count": v["direct"]}
                  for k, v in category_stats.items()]
    history_items = []
    for snap in reversed(snapshots[:12]):
        scores = db.query(CapabilityScore).filter_by(snapshot_id=snap.id).all()
        avg_score = round(sum(x.score or 0 for x in scores) / max(len(scores), 1), 1)
        history_items.append({"id": snap.id, "exam_id": snap.exam_id,
                              "date": snap.generated_at.isoformat() if snap.generated_at else None,
                              "score": avg_score, "match_score": snap.match_score,
                              "level": snap.overall_level})
    avg_reliability = sum(e.reliability or 0 for e in evidence) / max(len(evidence), 1)
    detail.update({"categories": categories, "growth_history": history_items,
                   "evidence_count": len(evidence), "evidence_reliability": round(avg_reliability, 3),
                   "data_version": "portrait-v2"})
    return {"exists": True, **detail}


@router.get("/snapshot/{sid}")
def snapshot_detail(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(CapabilitySnapshot).get(sid)
    if not s:
        raise HTTPException(404, "画像不存在")
    course = db.query(Course).get(s.course_id)
    return snapshot_to_dict(db, s, course)


@router.get("/graph")
def graph(course_id: int = 0, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return knowledge_graph_data(db, course_id)


@router.get("/history")
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    snaps = db.query(CapabilitySnapshot).filter_by(user_id=user.id).order_by(CapabilitySnapshot.id.desc()).limit(20).all()
    return {"items": [{
        "id": s.id, "exam_id": s.exam_id, "course_id": s.course_id,
        "generated_at": s.generated_at.isoformat() if s.generated_at else None,
        "match_score": s.match_score, "overall_level": s.overall_level, "dim_count": s.dim_count,
        "summary": s.summary,
    } for s in snaps]}
