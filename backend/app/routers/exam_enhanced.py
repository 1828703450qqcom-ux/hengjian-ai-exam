"""AI考试（在线）增强功能 API
覆盖：考试模板、延时考试、恢复考试、双评与仲裁、阅卷质量监控、归档中心
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from pydantic import BaseModel
from ..database import get_db
from ..models import (
    User, Course, Exam, ExamParticipant, ExamSession, StudentAnswer,
    Paper, PaperQuestion, Question, GradingRecord, GradeArbitration,
    GradingQualityLog, ProctorEvent,
)
from .auth import get_current_user

router = APIRouter(prefix="/api/exams-enhanced", tags=["AI考试增强功能"])


# ==================== 考试模板 ====================

class TemplateReq(BaseModel):
    template_name: str
    exam_data: dict  # 考试配置数据


@router.get("/templates")
def list_templates(
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取考试模板列表"""
    q = db.query(Exam).filter(Exam.is_template == True)
    if course_id:
        q = q.filter(Exam.course_id == course_id)
    templates = q.order_by(Exam.created_at.desc()).all()
    return {
        "templates": [
            {
                "id": t.id,
                "template_name": t.template_name,
                "title": t.title,
                "course_id": t.course_id,
                "exam_type": t.exam_type,
                "exam_level": t.exam_level,
                "duration_minutes": t.duration_minutes,
                "proctor_config": t.proctor_config or {},
                "exam_rules": t.exam_rules or {},
                "grading_config": t.grading_config or {},
                "result_config": t.result_config or {},
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in templates
        ],
        "total": len(templates),
    }


@router.post("/templates")
def create_template(
    req: TemplateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """保存为考试模板"""
    data = req.exam_data
    template = Exam(
        title=data.get("title", req.template_name),
        template_name=req.template_name,
        course_id=data.get("course_id"),
        paper_id=data.get("paper_id"),
        exam_type=data.get("exam_type", "online"),
        exam_level=data.get("exam_level", "class"),
        semester=data.get("semester"),
        duration_minutes=data.get("duration_minutes", 90),
        proctor_config=data.get("proctor_config", {}),
        exam_rules=data.get("exam_rules", {}),
        grading_config=data.get("grading_config", {}),
        result_config=data.get("result_config", {}),
        integrity_pledge=data.get("integrity_pledge"),
        is_template=True,
        created_by=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"message": "考试模板保存成功", "template_id": template.id}


@router.post("/templates/{template_id}/apply")
def apply_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """套用考试模板（返回模板配置供前端填充）"""
    template = db.query(Exam).filter(Exam.id == template_id, Exam.is_template == True).first()
    if not template:
        raise HTTPException(404, "考试模板不存在")
    return {
        "template_id": template.id,
        "template_name": template.template_name,
        "config": {
            "title": template.title,
            "course_id": template.course_id,
            "paper_id": template.paper_id,
            "exam_type": template.exam_type,
            "exam_level": template.exam_level,
            "semester": template.semester,
            "duration_minutes": template.duration_minutes,
            "proctor_config": template.proctor_config or {},
            "exam_rules": template.exam_rules or {},
            "grading_config": template.grading_config or {},
            "result_config": template.result_config or {},
            "integrity_pledge": template.integrity_pledge,
        },
        "message": "模板配置已加载，可修改后创建考试",
    }


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除考试模板"""
    template = db.query(Exam).filter(Exam.id == template_id, Exam.is_template == True).first()
    if not template:
        raise HTTPException(404, "考试模板不存在")
    db.delete(template)
    db.commit()
    return {"message": "考试模板已删除"}


# ==================== 延时考试 ====================

class ExtendTimeReq(BaseModel):
    session_id: int
    extra_minutes: int  # 延时分钟数
    reason: Optional[str] = None


@router.post("/extend-time")
def extend_exam_time(
    req: ExtendTimeReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """延时考试（监考教师对断网/断电学生单独延时）"""
    session = db.query(ExamSession).filter(ExamSession.id == req.session_id).first()
    if not session:
        raise HTTPException(404, "考试会话不存在")
    if session.status not in ("in_progress",):
        raise HTTPException(400, "只有进行中的考试可以延时")

    session.extended_time_minutes = (session.extended_time_minutes or 0) + req.extra_minutes
    db.commit()

    # 记录监考操作日志
    event = ProctorEvent(
        session_id=session.id,
        event_type="time_extended",
        severity="low",
        detail={
            "extra_minutes": req.extra_minutes,
            "total_extended": session.extended_time_minutes,
            "reason": req.reason,
            "operator": current_user.name,
        },
        source="proctor",
    )
    db.add(event)
    db.commit()

    return {
        "message": f"已为考生延时{req.extra_minutes}分钟",
        "session_id": session.id,
        "total_extended_minutes": session.extended_time_minutes,
    }


# ==================== 恢复考试 ====================

class RestoreExamReq(BaseModel):
    session_id: int
    reason: Optional[str] = None


@router.post("/restore-exam")
def restore_exam(
    req: RestoreExamReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """恢复考试（误交卷等异常情况，学生需重新签署承诺书和人脸核验）"""
    session = db.query(ExamSession).filter(ExamSession.id == req.session_id).first()
    if not session:
        raise HTTPException(404, "考试会话不存在")
    if session.status not in ("submitted", "flagged"):
        raise HTTPException(400, "只有已交卷或标记异常的考试可以恢复")

    session.status = "in_progress"
    session.restored = True
    session.restore_count = (session.restore_count or 0) + 1
    session.integrity_signed = False  # 需要重新签署承诺书
    session.face_verified = False  # 需要重新人脸核验
    session.submit_time = None
    db.commit()

    # 记录监考操作日志
    event = ProctorEvent(
        session_id=session.id,
        event_type="exam_restored",
        severity="medium",
        detail={
            "restore_count": session.restore_count,
            "reason": req.reason,
            "operator": current_user.name,
            "note": "学生再次进入考试时需重新签署考试承诺书、设备调试和人脸识别认证",
        },
        source="proctor",
    )
    db.add(event)
    db.commit()

    return {
        "message": "考试已恢复，学生再次进入时需重新签署承诺书和人脸核验",
        "session_id": session.id,
        "restore_count": session.restore_count,
    }


# ==================== 双评与仲裁 ====================

class DoubleGradeReq(BaseModel):
    answer_id: int
    score: float
    feedback: Optional[str] = None


@router.post("/double-grade/submit")
def submit_double_grade(
    req: DoubleGradeReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交双评评分（每位教师独立评分）"""
    answer = db.query(StudentAnswer).filter(StudentAnswer.id == req.answer_id).first()
    if not answer:
        raise HTTPException(404, "答题记录不存在")

    # 检查该教师是否已经评阅过
    existing = db.query(GradingRecord).filter(
        GradingRecord.answer_id == req.answer_id,
        GradingRecord.grader_id == current_user.id,
        GradingRecord.is_ai == False,
    ).first()

    if existing:
        existing.score = req.score
        existing.feedback = req.feedback
        existing.modified_at = datetime.utcnow()
        db.commit()
        grading_round = existing.grading_round
    else:
        # 确定评阅轮次
        existing_count = db.query(GradingRecord).filter(
            GradingRecord.answer_id == req.answer_id,
            GradingRecord.is_ai == False,
        ).count()
        grading_round = existing_count + 1
        record = GradingRecord(
            session_id=answer.session_id,
            question_id=answer.question_id,
            answer_id=req.answer_id,
            grader_id=current_user.id,
            score=req.score,
            feedback=req.feedback,
            grading_round=grading_round,
            is_ai=False,
        )
        db.add(record)
        db.commit()

    # 检查是否需要仲裁（双评分差超阈值）
    if grading_round >= 2:
        records = db.query(GradingRecord).filter(
            GradingRecord.answer_id == req.answer_id,
            GradingRecord.is_ai == False,
        ).order_by(GradingRecord.grading_round).all()

        if len(records) >= 2:
            first_score = records[0].score
            second_score = records[1].score
            score_diff = abs(first_score - second_score)

            # 获取考试配置的误差阈值
            session = db.query(ExamSession).filter(ExamSession.id == answer.session_id).first()
            exam = db.query(Exam).filter(Exam.id == session.exam_id).first() if session else None
            threshold = 2.0  # 默认阈值2分
            if exam and exam.grading_config:
                threshold = exam.grading_config.get("error_threshold", 2.0)

            if score_diff > threshold:
                # 自动提交仲裁
                arbitration = GradeArbitration(
                    session_id=answer.session_id,
                    question_id=answer.question_id,
                    answer_id=req.answer_id,
                    first_grader_id=records[0].grader_id,
                    second_grader_id=records[1].grader_id,
                    first_score=first_score,
                    second_score=second_score,
                    score_diff=score_diff,
                    threshold=threshold,
                    status="pending",
                )
                db.add(arbitration)
                answer.grading_status = "conflict"
                db.commit()
                return {
                    "message": f"评分已提交，分差{score_diff}超过阈值{threshold}，已自动提交仲裁",
                    "need_arbitration": True,
                    "score_diff": score_diff,
                    "threshold": threshold,
                }
            else:
                # 分差在误差内，取平均分
                avg_score = (first_score + second_score) / 2
                answer.teacher_score = avg_score
                answer.final_score = avg_score
                answer.grading_status = "teacher_graded"
                db.commit()
                return {
                    "message": f"评分已提交，分差{score_diff}在阈值内，取平均分{avg_score}",
                    "need_arbitration": False,
                    "final_score": avg_score,
                }

    return {"message": "评分已提交", "grading_round": grading_round}


class ArbitrationReq(BaseModel):
    arbitration_id: int
    final_score: float
    feedback: Optional[str] = None


@router.post("/double-grade/arbitrate")
def submit_arbitration(
    req: ArbitrationReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交仲裁结果（仲裁教师评分为最终成绩）"""
    arbitration = db.query(GradeArbitration).filter(GradeArbitration.id == req.arbitration_id).first()
    if not arbitration:
        raise HTTPException(404, "仲裁记录不存在")
    if arbitration.status == "resolved":
        raise HTTPException(400, "该仲裁已处理")

    arbitration.arbitrator_id = current_user.id
    arbitration.final_score = req.final_score
    arbitration.arbitration_feedback = req.feedback
    arbitration.status = "resolved"
    arbitration.resolved_at = datetime.utcnow()

    # 更新答题记录最终成绩
    answer = db.query(StudentAnswer).filter(StudentAnswer.id == arbitration.answer_id).first()
    if answer:
        answer.final_score = req.final_score
        answer.teacher_score = req.final_score
        answer.grading_status = "teacher_graded"

    # 记录仲裁评阅
    record = GradingRecord(
        session_id=arbitration.session_id,
        question_id=arbitration.question_id,
        answer_id=arbitration.answer_id,
        grader_id=current_user.id,
        score=req.final_score,
        feedback=req.feedback,
        grading_round=3,  # 仲裁轮次
        is_ai=False,
    )
    db.add(record)
    db.commit()

    return {
        "message": "仲裁结果已提交，该成绩为最终成绩",
        "arbitration_id": arbitration.id,
        "final_score": req.final_score,
    }


@router.get("/double-grade/arbitrations")
def list_arbitrations(
    exam_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取仲裁列表"""
    q = db.query(GradeArbitration)
    if exam_id:
        sessions = db.query(ExamSession.id).filter(ExamSession.exam_id == exam_id).all()
        session_ids = [s.id for s in sessions]
        q = q.filter(GradeArbitration.session_id.in_(session_ids))
    if status:
        q = q.filter(GradeArbitration.status == status)

    arbitrations = q.order_by(GradeArbitration.created_at.desc()).all()
    return {
        "arbitrations": [
            {
                "id": a.id,
                "session_id": a.session_id,
                "question_id": a.question_id,
                "answer_id": a.answer_id,
                "first_score": a.first_score,
                "second_score": a.second_score,
                "score_diff": a.score_diff,
                "threshold": a.threshold,
                "final_score": a.final_score,
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            }
            for a in arbitrations
        ],
        "total": len(arbitrations),
        "pending_count": len([a for a in arbitrations if a.status == "pending"]),
    }


# ==================== 阅卷质量监控 ====================

class QualityCheckReq(BaseModel):
    answer_id: int
    action: str  # sample/reject/approve
    suggested_score: Optional[float] = None
    reason: Optional[str] = None


@router.post("/grading-quality/check")
def grading_quality_check(
    req: QualityCheckReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """阅卷质量检查（组长抽样查看、打回重评）"""
    answer = db.query(StudentAnswer).filter(StudentAnswer.id == req.answer_id).first()
    if not answer:
        raise HTTPException(404, "答题记录不存在")

    # 获取原阅卷教师
    original_record = db.query(GradingRecord).filter(
        GradingRecord.answer_id == req.answer_id,
        GradingRecord.is_ai == False,
    ).first()

    log = GradingQualityLog(
        exam_id=answer.session.exam_id if answer.session else None,
        grader_id=original_record.grader_id if original_record else None,
        checker_id=current_user.id,
        answer_id=req.answer_id,
        action=req.action,
        original_score=answer.teacher_score,
        suggested_score=req.suggested_score,
        reason=req.reason,
    )
    db.add(log)

    if req.action == "reject":
        # 打回重评
        answer.grading_status = "pending"
        answer.teacher_score = None
        answer.final_score = None
        # 删除原阅卷记录
        if original_record:
            db.delete(original_record)

    db.commit()

    action_labels = {"sample": "抽样查看", "reject": "打回重评", "approve": "审核通过"}
    return {
        "message": f"已{action_labels.get(req.action, req.action)}",
        "action": req.action,
        "answer_id": req.answer_id,
    }


@router.get("/grading-quality/stats")
def grading_quality_stats(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """阅卷质量统计（评分偏差率/仲裁率/打回率）"""
    sessions = db.query(ExamSession.id).filter(ExamSession.exam_id == exam_id).all()
    session_ids = [s.id for s in sessions]

    # 总阅卷数
    total_graded = db.query(StudentAnswer).filter(
        StudentAnswer.session_id.in_(session_ids),
        StudentAnswer.grading_status == "teacher_graded",
    ).count()

    # 仲裁数
    arbitration_count = db.query(GradeArbitration).filter(
        GradeArbitration.session_id.in_(session_ids),
    ).count()

    # 打回数
    reject_count = db.query(GradingQualityLog).filter(
        GradingQualityLog.exam_id == exam_id,
        GradingQualityLog.action == "reject",
    ).count()

    # 各教师阅卷统计
    grader_stats = db.query(
        GradingRecord.grader_id,
        func.count(GradingRecord.id).label("total"),
        func.avg(GradingRecord.score).label("avg_score"),
    ).filter(
        GradingRecord.session_id.in_(session_ids),
        GradingRecord.is_ai == False,
    ).group_by(GradingRecord.grader_id).all()

    grader_list = []
    for gs in grader_stats:
        user = db.query(User).filter(User.id == gs.grader_id).first()
        grader_list.append({
            "grader_id": gs.grader_id,
            "grader_name": user.name if user else "未知",
            "total_graded": gs.total,
            "avg_score": round(gs.avg_score, 2) if gs.avg_score else 0,
        })

    return {
        "exam_id": exam_id,
        "total_graded": total_graded,
        "arbitration_count": arbitration_count,
        "arbitration_rate": round(arbitration_count / total_graded * 100, 2) if total_graded > 0 else 0,
        "reject_count": reject_count,
        "reject_rate": round(reject_count / total_graded * 100, 2) if total_graded > 0 else 0,
        "grader_stats": grader_list,
    }


# ==================== 归档中心 ====================

@router.get("/archive/list")
def archive_list(
    course_id: Optional[int] = None,
    keyword: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """归档中心：查询历史考试归档资料"""
    q = db.query(Exam).filter(Exam.status == "finished")
    if course_id:
        q = q.filter(Exam.course_id == course_id)
    if keyword:
        q = q.filter(Exam.title.contains(keyword))
    if start_date:
        q = q.filter(Exam.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(Exam.end_time <= datetime.fromisoformat(end_date))

    exams = q.order_by(Exam.start_time.desc()).all()
    return {
        "exams": [
            {
                "id": e.id,
                "title": e.title,
                "course_id": e.course_id,
                "course": e.course.name if e.course else "",
                "exam_type": e.exam_type,
                "exam_level": e.exam_level,
                "start_time": e.start_time.isoformat() if e.start_time else None,
                "end_time": e.end_time.isoformat() if e.end_time else None,
                "participants": db.query(ExamParticipant).filter_by(exam_id=e.id).count(),
                "submitted": db.query(ExamSession).filter(
                    ExamSession.exam_id == e.id,
                    ExamSession.status.in_(("submitted", "grading", "graded")),
                ).count(),
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in exams
        ],
        "total": len(exams),
    }


@router.get("/archive/{exam_id}/materials")
def archive_materials(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取考试归档材料清单（成绩单、成绩报告、试卷包、登录日志、监考日志等）"""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "考试不存在")

    sessions = db.query(ExamSession).filter(ExamSession.exam_id == exam_id).all()
    session_ids = [s.id for s in sessions]

    # 监考日志
    proctor_events = db.query(ProctorEvent).filter(
        ProctorEvent.session_id.in_(session_ids)
    ).order_by(ProctorEvent.timestamp).all() if session_ids else []

    # 异常统计
    anomaly_count = len([e for e in proctor_events if e.severity in ("high", "critical")])

    return {
        "exam_id": exam_id,
        "exam_title": exam.title,
        "materials": {
            "成绩单": {
                "type": "grade_sheet",
                "description": "全班考生信息：学号、姓名、班级、院系、总得分、成绩分档、名次、各题型得分、是否作弊、是否缺考",
                "count": len(sessions),
                "available": True,
            },
            "成绩报告": {
                "type": "grade_report",
                "description": "成绩分布、等级分布、题型得分率、技能得分率等可视化图表",
                "available": True,
            },
            "试卷包": {
                "type": "paper_package",
                "description": "试题、参考答案、评分标准、学生答卷",
                "paper_id": exam.paper_id,
                "available": True,
            },
            "登录日志": {
                "type": "login_log",
                "description": "考生登录时间、登录设备、IP地址、登录状态",
                "count": len(sessions),
                "available": True,
            },
            "监考日志": {
                "type": "proctor_log",
                "description": "整场考试所有异常动态和监考教师操作记录",
                "event_count": len(proctor_events),
                "anomaly_count": anomaly_count,
                "available": True,
            },
            "监考视频": {
                "type": "proctor_video",
                "description": "考生多机位监考视频回放",
                "available": False,
                "note": "视频文件需单独存储，当前提供异常事件时间点索引",
            },
        },
        "total_materials": 6,
    }


@router.get("/archive/{exam_id}/proctor-log")
def archive_proctor_log(
    exam_id: int,
    student_id: Optional[int] = None,
    event_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """下载/查询监考日志（支持按考场、监考教师、操作类型、学生姓名筛选）"""
    sessions = db.query(ExamSession).filter(ExamSession.exam_id == exam_id)
    if student_id:
        sessions = sessions.filter(ExamSession.user_id == student_id)
    sessions = sessions.all()
    session_ids = [s.id for s in sessions]

    q = db.query(ProctorEvent).filter(ProctorEvent.session_id.in_(session_ids)) if session_ids else db.query(ProctorEvent).filter(False)
    if event_type:
        q = q.filter(ProctorEvent.event_type == event_type)

    events = q.order_by(ProctorEvent.timestamp).all()

    return {
        "exam_id": exam_id,
        "total_events": len(events),
        "events": [
            {
                "id": e.id,
                "session_id": e.session_id,
                "student_name": e.session.user.name if e.session and e.session.user else "未知",
                "event_type": e.event_type,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "confidence": e.confidence,
                "severity": e.severity,
                "detail": e.detail,
                "source": e.source,
                "ack": e.ack,
            }
            for e in events
        ],
    }


@router.get("/archive/student-search")
def archive_student_search(
    student_no: Optional[str] = None,
    student_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """按学号或姓名搜索学生成绩和答卷"""
    q = db.query(User).filter(User.role == "student")
    if student_no:
        q = q.filter(User.student_no.contains(student_no))
    if student_name:
        q = q.filter(User.name.contains(student_name))

    students = q.limit(50).all()
    result = []
    for s in students:
        sessions = db.query(ExamSession).filter(ExamSession.user_id == s.id).all()
        result.append({
            "student_id": s.id,
            "student_no": s.student_no,
            "name": s.name,
            "college": s.college,
            "major": s.major,
            "grade": s.grade,
            "exam_count": len(sessions),
            "exams": [
                {
                    "exam_id": sess.exam_id,
                    "exam_title": sess.exam.title if sess.exam else "",
                    "score": sess.final_score,
                    "status": sess.status,
                    "submit_time": sess.submit_time.isoformat() if sess.submit_time else None,
                }
                for sess in sessions
            ],
        })

    return {"students": result, "total": len(result)}
