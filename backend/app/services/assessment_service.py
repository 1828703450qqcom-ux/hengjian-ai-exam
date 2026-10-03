"""考试评估流水线（可复用核心）：
自动评阅 + 口语测评 + 教师一致性 + 能力画像生成
"""
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import (
    ExamSession, StudentAnswer, Question, PaperQuestion, OralAssessment, Exam, User,
)
from . import grading_service as gs
from .knowledge_service import generate_capability_snapshot


def run_auto_grading(db: Session, session: ExamSession, generate_portrait: bool = True) -> dict:
    """对一次会话执行完整自动评阅，可选生成能力画像"""
    answers = db.query(StudentAnswer).filter_by(session_id=session.id).all()
    if not answers:
        raise ValueError("无作答记录")
    ai_scores, teacher_scores = [], []
    total = 0.0
    objective_correct = objective_total = 0
    oral_count = 0
    for sa in answers:
        q = db.query(Question).get(sa.question_id)
        if not q:
            continue
        pq = db.query(PaperQuestion).filter_by(paper_id=session.exam.paper_id, question_id=sa.question_id).first()
        full = pq.score if pq else 5.0
        qd = {"answer": q.answer or "", "scoring_rubric": q.scoring_rubric or {},
              "keywords": (q.scoring_rubric or {}).get("keywords") or []}
        if q.type in ("single_choice", "multiple_choice", "judge", "fill"):
            r = gs.grade_objective(q.type, sa.answer, q.answer, full)
            sa.ai_score, sa.ai_feedback, sa.is_correct = r["score"], r["feedback"], r["is_correct"]
            sa.final_score = r["score"]
            sa.grading_status = "auto_graded"
            objective_total += 1
            objective_correct += 1 if r["is_correct"] else 0
            ai_scores.append(r["score"])
        elif q.type == "oral":
            transcript = sa.audio_transcript or (sa.answer or "")
            r = gs.grade_oral(transcript, qd, sa.audio_duration or 0, 0.9)
            oral_score = round(full * min(max(r["total_score"], 0), 100) / 100.0, 1)
            sa.ai_score, sa.ai_feedback = oral_score, r["feedback"]
            sa.final_score = oral_score
            sa.grading_status = "auto_graded"
            db.add(OralAssessment(session_id=session.id, question_id=q.id, transcript=transcript,
                                  fluency_score=r["fluency"], pronunciation_score=r["pronunciation"],
                                  content_score=r["content"], total_score=r["total_score"],
                                  audio_duration=sa.audio_duration or 0))
            oral_count += 1
            ai_scores.append(oral_score)
        else:
            r = gs.grade_subjective(sa.answer or "", qd, full)
            sa.ai_score, sa.ai_feedback = r["score"], r["feedback"]
            sa.final_score = r["score"] if sa.teacher_score is None else sa.final_score
            sa.grading_status = "auto_graded"
            ai_scores.append(r["score"])
        total += sa.final_score or 0
        sa.graded_at = datetime.utcnow()

    session.ai_score = round(total, 1)
    if session.teacher_score is None:
        session.final_score = session.ai_score
    else:
        session.final_score = session.teacher_score
    session.status = "graded"
    if not session.submit_time:
        session.submit_time = datetime.utcnow()
    db.commit()

    portrait_id = None
    if generate_portrait and session.final_score is not None:
        exam = db.query(Exam).get(session.exam_id)
        try:
            snap = generate_capability_snapshot(db, session.user_id, exam, session)
            portrait_id = snap.id
        except Exception:
            portrait_id = None

    return {
        "session_id": session.id,
        "ai_score": session.ai_score,
        "objective_accuracy": round(objective_correct / objective_total, 4) if objective_total else 1.0,
        "objective_correct": objective_correct,
        "objective_total": objective_total,
        "oral_count": oral_count,
        "portrait_id": portrait_id,
    }


def student_final(session: ExamSession) -> dict:
    return {
        "session_id": session.id,
        "ai_score": session.ai_score,
        "teacher_score": session.teacher_score,
        "final_score": session.final_score,
        "agreement_rate": session.agreement_rate,
        "risk_level": session.risk_level,
        "is_flagged": session.is_flagged,
    }
