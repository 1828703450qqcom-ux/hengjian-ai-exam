from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    User, Course, Exam, ExamParticipant, ExamSession, StudentAnswer,
    Paper, PaperQuestion, Question, AuditLog,
)
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/api/exams", tags=["exams"])


class ExamReq(BaseModel):
    course_id: int
    paper_id: int
    title: str
    exam_type: str = "online"
    start_time: str = ""
    end_time: str = ""
    duration_minutes: int = 90
    proctor_config: dict = {"face": True, "behavior": True, "voice": True, "liveness": True, "screen_switch": True}


def exam_to_dict(db: Session, e: Exam) -> dict:
    c = db.query(Course).get(e.course_id)
    p = db.query(Paper).get(e.paper_id)
    participants = db.query(ExamParticipant).filter_by(exam_id=e.id).count()
    sessions = db.query(ExamSession).filter_by(exam_id=e.id).all()
    submitted = len([s for s in sessions if s.status in ("submitted", "grading", "graded")])
    return {
        "id": e.id, "title": e.title, "course_id": e.course_id,
        "course": c.name if c else "", "paper_id": e.paper_id, "paper_title": p.title if p else "",
        "exam_type": e.exam_type, "start_time": e.start_time.isoformat() if e.start_time else None,
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "duration_minutes": e.duration_minutes, "status": e.status,
        "proctor_config": e.proctor_config or {}, "participants": participants,
        "submitted": submitted, "total_sessions": len(sessions),
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("")
def list_exams(course_id: int = 0, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Exam)
    if course_id:
        q = q.filter(Exam.course_id == course_id)
    return {"items": [exam_to_dict(db, e) for e in q.order_by(Exam.id.desc()).all()]}


@router.post("")
def create_exam(req: ExamReq, user: User = Depends(require_roles("admin", "teacher")),
                db: Session = Depends(get_db)):
    e = Exam(course_id=req.course_id, paper_id=req.paper_id, title=req.title, exam_type=req.exam_type,
             start_time=datetime.fromisoformat(req.start_time) if req.start_time else None,
             end_time=datetime.fromisoformat(req.end_time) if req.end_time else None,
             duration_minutes=req.duration_minutes, proctor_config=req.proctor_config, created_by=user.id)
    db.add(e)
    db.commit()
    db.refresh(e)
    return exam_to_dict(db, e)


@router.post("/{eid}/publish")
def publish(eid: int, user: User = Depends(require_roles("admin", "teacher")), db: Session = Depends(get_db)):
    e = db.query(Exam).get(eid)
    if not e:
        raise HTTPException(404, "考试不存在")
    e.status = "published"
    db.commit()
    return exam_to_dict(db, e)


@router.post("/{eid}/enroll")
def enroll(eid: int, payload: dict, user: User = Depends(require_roles("admin", "teacher")),
           db: Session = Depends(get_db)):
    """批量添加考生"""
    uids = payload.get("user_ids", [])
    for uid in uids:
        if not db.query(ExamParticipant).filter_by(exam_id=eid, user_id=uid).first():
            db.add(ExamParticipant(exam_id=eid, user_id=uid))
    db.commit()
    return {"ok": True, "enrolled": len(uids)}


@router.get("/available")
def available_exams(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """考生可见的考试列表"""
    if user.role == "student":
        parts = db.query(ExamParticipant).filter_by(user_id=user.id).all()
        exam_ids = [p.exam_id for p in parts]
        exams = db.query(Exam).filter(Exam.id.in_(exam_ids)).all() if exam_ids else []
    else:
        exams = db.query(Exam).all()
    items = []
    for e in exams:
        d = exam_to_dict(db, e)
        s = db.query(ExamSession).filter_by(exam_id=e.id, user_id=user.id).first()
        d["my_status"] = s.status if s else ("not_started" if e.status == "published" else e.status)
        d["my_score"] = s.final_score if s and s.final_score is not None else None
        d["my_session_id"] = s.id if s else None
        d["my_risk"] = s.risk_level if s else "low"
        items.append(d)
    items.sort(key=lambda x: x["start_time"] or "", reverse=True)
    return {"items": items}


@router.post("/{eid}/start")
def start_exam(eid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """考生开始考试（创建会话，考前人脸核验校验）"""
    e = db.query(Exam).get(eid)
    if not e:
        raise HTTPException(404, "考试不存在")
    if e.status != "published":
        raise HTTPException(400, "考试未开放")
    existing = db.query(ExamSession).filter_by(exam_id=eid, user_id=user.id).first()
    if existing and existing.status in ("submitted", "grading", "graded"):
        raise HTTPException(400, "你已完成本场考试")
    if existing and existing.status == "in_progress":
        return {"session_id": existing.id, "exam": exam_detail(db, e, user.id)}
    # 考前身份核验：未登记人脸则记录风险
    session = ExamSession(exam_id=eid, user_id=user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "exam": exam_detail(db, e, user.id)}


def exam_detail(db: Session, e: Exam, user_id: int) -> dict:
    pqs = db.query(PaperQuestion).filter_by(paper_id=e.paper_id).order_by(PaperQuestion.order_index).all()
    questions = []
    for pq in pqs:
        q = db.query(Question).get(pq.question_id)
        questions.append({
            "paper_question_id": pq.id, "question_id": q.id, "type": q.type, "stem": q.stem,
            "options": q.options or [], "score": pq.score, "order_index": pq.order_index,
            "subject": q.subject,
        })
    return {
        "id": e.id, "title": e.title, "exam_type": e.exam_type, "duration_minutes": e.duration_minutes,
        "proctor_config": e.proctor_config or {}, "questions": questions,
        "total_score": sum(q["score"] for q in questions),
    }


@router.post("/session/{sid}/submit")
def submit(sid: int, payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """考生提交答案 → 触发自动评阅流水线"""
    session = db.query(ExamSession).get(sid)
    if not session or session.user_id != user.id:
        raise HTTPException(404, "会话不存在")
    answers = payload.get("answers", [])  # [{question_id, answer, time_used_sec}]
    if not session.submit_time:
        session.submit_time = datetime.utcnow()
        session.status = "submitted"
    for a in answers:
        sa = db.query(StudentAnswer).filter_by(session_id=sid, question_id=a.get("question_id")).first()
        if not sa:
            sa = StudentAnswer(session_id=sid, question_id=a.get("question_id"))
            db.add(sa)
        sa.answer = a.get("answer", "")
        sa.time_used_sec = a.get("time_used_sec", 0)
    db.commit()
    return {"ok": True, "session_id": sid, "message": "已提交，AI 自动评阅中"}


@router.get("/session/{sid}")
def get_session(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ExamSession).get(sid)
    if not session:
        raise HTTPException(404, "会话不存在")
    answers = db.query(StudentAnswer).filter_by(session_id=sid).all()
    return {
        "id": session.id, "exam_id": session.exam_id, "status": session.status,
        "ai_score": session.ai_score, "teacher_score": session.teacher_score,
        "final_score": session.final_score, "agreement_rate": session.agreement_rate,
        "risk_level": session.risk_level, "is_flagged": session.is_flagged,
        "cheat_confidence": session.cheat_confidence,
        "answer_count": len(answers),
        "submitted": bool(session.submit_time),
    }


@router.get("/sessions")
def list_sessions(exam_id: int = 0, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(ExamSession)
    if user.role == "student":
        q = q.filter(ExamSession.user_id == user.id)
    if exam_id:
        q = q.filter(ExamSession.exam_id == exam_id)
    items = []
    for s in q.order_by(ExamSession.id.desc()).limit(200).all():
        u = db.query(User).get(s.user_id)
        e = db.query(Exam).get(s.exam_id)
        items.append({
            "id": s.id, "exam_id": s.exam_id, "exam_title": e.title if e else "",
            "student": u.name if u else "", "student_no": u.student_no if u else "",
            "user_id": s.user_id, "status": s.status, "ai_score": s.ai_score,
            "teacher_score": s.teacher_score, "final_score": s.final_score,
            "agreement_rate": s.agreement_rate, "risk_level": s.risk_level,
            "is_flagged": s.is_flagged, "start_time": s.start_time.isoformat() if s.start_time else None,
            "submit_time": s.submit_time.isoformat() if s.submit_time else None,
        })
    return {"items": items}


@router.post("/checkin")
def exam_checkin(payload: dict, user: User = Depends(require_roles("student")), db: Session = Depends(get_db)):
    """考前信息采集与签到：身份信息、人脸特征、设备检测"""
    exam_id = payload.get("exam_id")
    if not exam_id:
        raise HTTPException(400, "缺少考试ID")
    exam = db.query(Exam).get(exam_id)
    if not exam:
        raise HTTPException(404, "考试不存在")
    # 验证考生是否在参与名单中
    participant = db.query(ExamParticipant).filter_by(exam_id=exam_id, user_id=user.id).first()
    if not participant:
        raise HTTPException(403, "您未被安排参加本场考试")
    # 更新考生信息（如果提供了）
    if payload.get("college"):
        user.college = payload["college"]
    if payload.get("major"):
        user.major = payload["major"]
    if payload.get("phone"):
        user.email = payload.get("email", user.email)
    # 保存人脸特征（如果提供了且尚未登记）
    face_descriptor = payload.get("face_descriptor")
    if face_descriptor and not user.face_descriptor:
        user.face_descriptor = face_descriptor
    # 记录签到
    participant.checked_in = True
    participant.checkin_time = datetime.utcnow()
    participant.device_check = payload.get("device_check", {})
    participant.checkin_data = {k: v for k, v in payload.items() if k not in ("face_descriptor", "face_photo")}
    db.commit()
    return {
        "ok": True,
        "message": "签到成功",
        "exam_id": exam_id,
        "exam_title": exam.title,
        "face_registered": bool(user.face_descriptor),
        "checkin_time": participant.checkin_time.isoformat() if participant.checkin_time else None,
    }


# ============ 试卷预览 ============

@router.get("/{exam_id}/paper-preview")
def paper_preview(exam_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """试卷预览：获取考试关联试卷的完整结构，用于创建考试前预览"""
    exam = db.query(Exam).get(exam_id)
    if not exam:
        raise HTTPException(404, "考试不存在")
    paper = db.query(Paper).get(exam.paper_id)
    if not paper:
        raise HTTPException(404, "试卷不存在")

    pqs = db.query(PaperQuestion).filter_by(paper_id=paper.id).order_by(PaperQuestion.order).all()
    questions = []
    type_stats = {}
    total_score = 0
    for pq in pqs:
        q = db.query(Question).get(pq.question_id)
        if q:
            qtype = q.type or "unknown"
            type_stats[qtype] = type_stats.get(qtype, 0) + 1
            total_score += pq.score or 0
            questions.append({
                "id": q.id, "order": pq.order, "type": qtype,
                "stem": q.stem[:300], "options": q.options or [],
                "score": pq.score or 0, "difficulty": q.difficulty,
                "knowledge_point": q.knowledge_point or "",
            })

    # 难度分布
    difficulty_dist = {"easy": 0, "medium": 0, "hard": 0}
    for pq in pqs:
        q = db.query(Question).get(pq.question_id)
        if q:
            if q.difficulty <= 2:
                difficulty_dist["easy"] += 1
            elif q.difficulty <= 4:
                difficulty_dist["medium"] += 1
            else:
                difficulty_dist["hard"] += 1

    return {
        "paper_id": paper.id, "paper_title": paper.title,
        "exam_title": exam.title, "total_questions": len(questions),
        "total_score": total_score, "type_stats": type_stats,
        "difficulty_dist": difficulty_dist, "questions": questions,
        "duration_minutes": exam.duration_minutes,
    }


# ============ 考试模板 ============

EXAM_TEMPLATES = [
    {
        "id": "standard_online", "name": "标准在线考试", "desc": "适用于常规课程在线考试",
        "config": {
            "exam_type": "online", "duration_minutes": 90,
            "proctor_config": {"face": True, "behavior": True, "voice": True, "liveness": True, "screen_switch": True},
            "rules": {"late_limit": 15, "auto_submit": True, "random_order": False, "show_answer": False},
        }
    },
    {
        "id": "strict_proctor", "name": "严格监考考试", "desc": "适用于重要考试，开启全部监考功能",
        "config": {
            "exam_type": "online", "duration_minutes": 120,
            "proctor_config": {"face": True, "behavior": True, "voice": True, "liveness": True, "screen_switch": True, "multi_camera": True},
            "rules": {"late_limit": 5, "auto_submit": True, "random_order": True, "show_answer": False, "force_fullscreen": True},
        }
    },
    {
        "id": "practice", "name": "练习模式", "desc": "适用于平时练习，不开启监考",
        "config": {
            "exam_type": "online", "duration_minutes": 60,
            "proctor_config": {"face": False, "behavior": False, "voice": False, "liveness": False, "screen_switch": False},
            "rules": {"late_limit": 0, "auto_submit": True, "random_order": False, "show_answer": True, "allow_pause": True},
        }
    },
    {
        "id": "paper_scan", "name": "纸笔扫描考试", "desc": "适用于线下纸笔考试，扫描阅卷",
        "config": {
            "exam_type": "paper", "duration_minutes": 120,
            "proctor_config": {"face": False, "behavior": False, "voice": False, "liveness": False, "screen_switch": False},
            "rules": {"late_limit": 15, "auto_submit": False, "scan_grading": True},
        }
    },
    {
        "id": "oral_exam", "name": "口语考试", "desc": "适用于英语口语考试，开启录音和口语评测",
        "config": {
            "exam_type": "online", "duration_minutes": 30,
            "proctor_config": {"face": True, "behavior": False, "voice": True, "liveness": True, "screen_switch": True},
            "rules": {"late_limit": 5, "auto_submit": True, "recording": True, "speaking_evaluation": True},
        }
    },
]


@router.get("/templates/list")
def list_exam_templates(user: User = Depends(get_current_user)):
    """获取考试模板列表"""
    return {"items": EXAM_TEMPLATES, "total": len(EXAM_TEMPLATES)}


@router.get("/templates/{template_id}")
def get_exam_template(template_id: str, user: User = Depends(get_current_user)):
    """获取指定考试模板详情"""
    template = next((t for t in EXAM_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(404, "模板不存在")
    return template
