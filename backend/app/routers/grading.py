from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    User, ExamSession, StudentAnswer, Question, PaperQuestion, OralAssessment,
    CapabilitySnapshot,
)
from ..deps import get_current_user, require_roles
from ..services import grading_service as gs
from ..services.assessment_service import run_auto_grading

router = APIRouter(prefix="/api/grading", tags=["grading"])


@router.post("/session/{sid}/auto")
def auto_grade(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """自动评阅流水线：客观题精确比对 + 主观题 AI 评分 + 能力画像"""
    session = db.query(ExamSession).get(sid)
    if not session:
        raise HTTPException(404, "会话不存在")
    try:
        result = run_auto_grading(db, session, generate_portrait=True)
    except ValueError as e:
        raise HTTPException(400, str(e))
    result["message"] = "自动评阅完成"
    return result


@router.get("/session/{sid}/detail")
def session_detail(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ExamSession).get(sid)
    if not session:
        raise HTTPException(404, "会话不存在")
    answers = db.query(StudentAnswer).filter_by(session_id=sid).all()
    items = []
    for sa in answers:
        q = db.query(Question).get(sa.question_id)
        pq = db.query(PaperQuestion).filter_by(paper_id=session.exam.paper_id, question_id=sa.question_id).first()
        items.append({
            "question_id": q.id, "type": q.type, "stem": q.stem, "options": q.options or [],
            "answer": q.answer, "score": pq.score if pq else 5.0,
            "student_answer": sa.answer, "ai_score": sa.ai_score, "ai_feedback": sa.ai_feedback,
            "teacher_score": sa.teacher_score, "teacher_feedback": sa.teacher_feedback,
            "final_score": sa.final_score, "grading_status": sa.grading_status,
            "audio_transcript": sa.audio_transcript, "is_correct": sa.is_correct,
        })
    return {"items": items, "session": {
        "id": session.id, "ai_score": session.ai_score, "teacher_score": session.teacher_score,
        "final_score": session.final_score, "agreement_rate": session.agreement_rate,
        "risk_level": session.risk_level, "is_flagged": session.is_flagged,
    }}


class TeacherGradeReq(BaseModel):
    teacher_scores: dict      # {question_id: score}
    teacher_feedback: dict = {}


@router.post("/session/{sid}/teacher")
def teacher_grade(sid: int, req: TeacherGradeReq, user: User = Depends(require_roles("admin", "teacher")),
                  db: Session = Depends(get_db)):
    """教师评阅 → 计算 AI 与教师一致性 → 校准"""
    session = db.query(ExamSession).get(sid)
    if not session:
        raise HTTPException(404, "会话不存在")
    answers = db.query(StudentAnswer).filter_by(session_id=sid).all()
    ai_scores, teacher_scores = [], []
    total = 0.0
    for sa in answers:
        if str(sa.question_id) in req.teacher_scores:
            t = float(req.teacher_scores[str(sa.question_id)])
            sa.teacher_score = t
            sa.teacher_feedback = req.teacher_feedback.get(str(sa.question_id), "")
            sa.final_score = t
            sa.grading_status = "teacher_graded"
            ai_scores.append(sa.ai_score or 0)
            teacher_scores.append(t)
        total += sa.final_score or 0
    session.teacher_score = round(total, 1)
    session.final_score = round(total, 1)
    if ai_scores:
        agree = gs.compute_agreement(ai_scores, teacher_scores)
        session.agreement_rate = agree["agreement"]
        session.teacher_score = session.final_score
    db.commit()
    agree = gs.compute_agreement(ai_scores, teacher_scores) if ai_scores else {"agreement": 1.0}
    calib = gs.calibrate(agree["agreement"])
    return {"ok": True, "final_score": session.final_score, "agreement": agree, "calibration": calib}


@router.post("/session/{sid}/oral-transcript")
def upload_oral(sid: int, payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """前端口语识别后上传转写文本"""
    sa = db.query(StudentAnswer).filter_by(session_id=sid, question_id=payload.get("question_id")).first()
    if not sa:
        raise HTTPException(404, "作答记录不存在")
    sa.audio_transcript = payload.get("transcript", "")
    sa.audio_duration = payload.get("duration", 0)
    sa.answer = payload.get("transcript", "")
    db.commit()
    return {"ok": True}


# ============ 成绩报告导出 ============

@router.get("/exam/{exam_id}/report")
def exam_report(exam_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """生成考试成绩分析报告：考情总览、分数分布、题目分析、知识点掌握度"""
    from ..models import Exam, Paper, PaperQuestion
    exam = db.query(Exam).get(exam_id)
    if not exam:
        raise HTTPException(404, "考试不存在")

    sessions = db.query(ExamSession).filter_by(exam_id=exam_id).all()
    submitted = [s for s in sessions if s.final_score is not None]

    if not submitted:
        return {"exam_id": exam_id, "title": exam.title, "message": "暂无已提交成绩"}

    scores = [s.final_score for s in submitted]
    avg_score = sum(scores) / len(scores)
    max_score = max(scores)
    min_score = min(scores)
    pass_count = len([s for s in scores if s >= 60])
    excellent_count = len([s for s in scores if s >= 90])

    # 分数段分布
    score_dist = {"0-59": 0, "60-69": 0, "70-79": 0, "80-89": 0, "90-100": 0}
    for s in scores:
        if s < 60: score_dist["0-59"] += 1
        elif s < 70: score_dist["60-69"] += 1
        elif s < 80: score_dist["70-79"] += 1
        elif s < 90: score_dist["80-89"] += 1
        else: score_dist["90-100"] += 1

    # 题目正确率分析
    paper = db.query(Paper).get(exam.paper_id)
    question_stats = []
    if paper:
        pqs = db.query(PaperQuestion).filter_by(paper_id=paper.id).order_by(PaperQuestion.order).all()
        for pq in pqs:
            q = db.query(Question).get(pq.question_id)
            if q:
                answers = db.query(StudentAnswer).filter_by(question_id=q.id).all()
                correct = len([a for a in answers if a.is_correct])
                total = len(answers)
                correct_rate = correct / total if total > 0 else 0
                question_stats.append({
                    "question_id": q.id, "order": pq.order, "type": q.type,
                    "stem": q.stem[:100], "score": pq.score,
                    "correct_rate": round(correct_rate, 4), "correct_count": correct,
                    "total_count": total, "knowledge_point": q.knowledge_point or "",
                    "difficulty": q.difficulty,
                })

    # 标准差
    variance = sum((s - avg_score) ** 2 for s in scores) / len(scores)
    std_dev = variance ** 0.5

    return {
        "exam_id": exam_id, "title": exam.title, "course": exam.course.name if exam.course else "",
        "total_participants": len(sessions), "submitted_count": len(submitted),
        "avg_score": round(avg_score, 2), "max_score": max_score, "min_score": min_score,
        "pass_rate": round(pass_count / len(submitted) * 100, 1),
        "excellent_rate": round(excellent_count / len(submitted) * 100, 1),
        "std_dev": round(std_dev, 2),
        "score_distribution": score_dist,
        "question_stats": question_stats,
        "high_error_questions": sorted(question_stats, key=lambda x: x["correct_rate"])[:5],
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/exam/{exam_id}/export")
def export_report(exam_id: int, format: str = "json", user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """导出成绩报告：支持JSON/CSV格式"""
    report = exam_report(exam_id, user, db)
    if format == "csv":
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["指标", "数值"])
        writer.writerow(["考试名称", report.get("title", "")])
        writer.writerow(["参考人数", report.get("total_participants", 0)])
        writer.writerow(["提交人数", report.get("submitted_count", 0)])
        writer.writerow(["平均分", report.get("avg_score", 0)])
        writer.writerow(["最高分", report.get("max_score", 0)])
        writer.writerow(["最低分", report.get("min_score", 0)])
        writer.writerow(["及格率(%)", report.get("pass_rate", 0)])
        writer.writerow(["优秀率(%)", report.get("excellent_rate", 0)])
        writer.writerow(["标准差", report.get("std_dev", 0)])
        writer.writerow([])
        writer.writerow(["题号", "题型", "分值", "正确率", "正确人数", "总人数", "知识点"])
        for q in report.get("question_stats", []):
            writer.writerow([q["order"], q["type"], q["score"], q["correct_rate"],
                            q["correct_count"], q["total_count"], q["knowledge_point"]])
        return {"format": "csv", "content": output.getvalue(), "filename": f"exam_{exam_id}_report.csv"}
    return report
