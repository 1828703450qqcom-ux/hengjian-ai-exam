from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import (
    User, Exam, ExamSession, ProctorEvent, Course, ScanBatch, ScanPaper,
    CapabilitySnapshot, CapabilityScore, CapabilityDimension, StudentAnswer, Question,
)
from ..deps import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/command")
def command_center(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """考试指挥中心"""
    exams = db.query(Exam).all()
    sessions = db.query(ExamSession).all()
    events = db.query(ProctorEvent).all()
    exam_overview = []
    for e in exams:
        es = [s for s in sessions if s.exam_id == e.id]
        flag = [s for s in es if s.is_flagged]
        exam_overview.append({
            "exam_id": e.id, "title": e.title, "status": e.status,
            "total": len(es), "in_progress": len([s for s in es if s.status == "in_progress"]),
            "graded": len([s for s in es if s.status == "graded"]),
            "flagged": len(flag),
            "risk_high": len([s for s in es if s.risk_level in ("high", "critical")]),
        })
    flagged_sessions = []
    for s in sessions:
        if s.is_flagged:
            u = db.query(User).get(s.user_id)
            e = db.query(Exam).get(s.exam_id)
            flagged_sessions.append({
                "session_id": s.id, "student": u.name if u else "", "student_no": u.student_no if u else "",
                "exam": e.title if e else "", "risk_level": s.risk_level,
                "cheat_confidence": s.cheat_confidence,
            })
    risk_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for s in sessions:
        risk_dist[s.risk_level or "low"] = risk_dist.get(s.risk_level or "low", 0) + 1
    event_types = {}
    for ev in events:
        event_types[ev.event_type] = event_types.get(ev.event_type, 0) + 1
    return {
        "exam_overview": exam_overview,
        "flagged_sessions": flagged_sessions[:50],
        "risk_dist": risk_dist,
        "event_types": event_types,
        "live_sessions": len([s for s in sessions if s.status == "in_progress"]),
        "total_sessions": len(sessions),
        "total_events": len(events),
    }


@router.get("/scan")
def scan_visualization(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """扫描阅卷可视化"""
    batches = db.query(ScanBatch).order_by(ScanBatch.id.desc()).all()
    items = []
    for b in batches:
        papers = db.query(ScanPaper).filter_by(batch_id=b.id).all()
        e = db.query(Exam).get(b.exam_id)
        items.append({
            "id": b.id, "title": b.title, "exam": e.title if e else "",
            "total_papers": b.total_papers, "status": b.status,
            "ocr_done": len([p for p in papers if p.ocr_status == "done"]),
            "graded": len([p for p in papers if p.grading_status == "graded"]),
            "avg_score": round(sum(p.total_score or 0 for p in papers) / max(len(papers), 1), 1),
            "papers": [{"id": p.id, "student_no": p.student_no, "student_name": p.student_name,
                        "ocr_status": p.ocr_status, "grading_status": p.grading_status,
                        "total_score": p.total_score, "grading_detail": p.grading_detail or []}
                       for p in papers],
            "score_dist": {
                "90+": len([p for p in papers if (p.total_score or 0) >= 90]),
                "80-89": len([p for p in papers if 80 <= (p.total_score or 0) < 90]),
                "70-79": len([p for p in papers if 70 <= (p.total_score or 0) < 80]),
                "60-69": len([p for p in papers if 60 <= (p.total_score or 0) < 70]),
                "<60": len([p for p in papers if (p.total_score or 0) < 60]),
            },
        })
    return {"batches": items}


@router.get("/capability-overview")
def capability_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """全校能力画像概览"""
    snaps = db.query(CapabilitySnapshot).order_by(CapabilitySnapshot.id.desc()).limit(500).all()
    level_dist = {"优秀": 0, "良好": 0, "合格": 0, "待提高": 0}
    for s in snaps:
        level_dist[s.overall_level or "待提高"] = level_dist.get(s.overall_level or "待提高", 0) + 1
    # 各能力维度全校平均
    dim_scores = {}
    dim_ids = [d.id for d in db.query(CapabilityDimension).all()]
    for sid in [s.id for s in snaps][:100]:
        for cs in db.query(CapabilityScore).filter_by(snapshot_id=sid).all():
            dim_scores.setdefault(cs.dimension_id, []).append(cs.score)
    dim_avg = []
    for did, scores in dim_scores.items():
        d = db.query(CapabilityDimension).get(did)
        if d:
            dim_avg.append({"name": d.name, "category": d.category, "avg": round(sum(scores) / len(scores), 1)})
    dim_avg.sort(key=lambda x: x["avg"], reverse=True)
    return {
        "snapshot_count": len(snaps),
        "level_dist": level_dist,
        "dim_avg": dim_avg[:20],
    }


@router.get("/statistics")
def statistics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """基础统计"""
    return {
        "users": db.query(User).count(),
        "students": db.query(User).filter(User.role == "student").count(),
        "courses": db.query(Course).count(),
        "questions": db.query(Question).count(),
        "exams": db.query(Exam).count(),
        "sessions": db.query(ExamSession).count(),
        "graded": db.query(ExamSession).filter(ExamSession.status == "graded").count(),
        "flagged": db.query(ExamSession).filter(ExamSession.is_flagged == True).count(),  # noqa
        "snapshots": db.query(CapabilitySnapshot).count(),
    }
