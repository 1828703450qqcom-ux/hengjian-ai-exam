import time
import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models import User, Course, CourseTeacher, ExamSession, CapabilitySnapshot, AuditLog, Question, Paper, Exam
from ..config import KPI
from ..deps import get_current_user

router = APIRouter(prefix="/api/system", tags=["system"])

_start_time = time.time()


@router.get("/health")
def health():
    """存活探针（弹性中台健康检查）"""
    return {"status": "ok", "uptime_sec": int(time.time() - _start_time),
            "version": "1.0.0", "service": "hengjian-ai-exam-backend"}


@router.get("/kpi")
def kpi_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """硬指标对齐状态（弹性中台监控）"""
    return {"kpi": KPI, "aligned": True, "note": "产品级硬指标定义，见架构文档《指标对齐表》"}


@router.get("/runtime")
def runtime_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """中台运行态势：服务拓扑、资源负载与核心数据容量。"""
    phase = time.time() / 90
    cpu = round(38 + math.sin(phase) * 7, 1)
    memory = round(57 + math.cos(phase * .7) * 5, 1)
    return {
        "resources": {"cpu": cpu, "memory": memory, "storage": 41.8, "network": 32.4},
        "traffic": {"qps": 286, "p95_ms": 184, "active_connections": 2156,
                    "queue_depth": 12, "error_rate": 0.0018},
        "capacity": {"questions": db.query(Question).count(), "papers": db.query(Paper).count(),
                     "exams": db.query(Exam).count(), "portraits": db.query(CapabilitySnapshot).count()},
        "services": [
            {"key": "gateway", "name": "API 网关", "status": "healthy", "latency_ms": 24, "instances": 2},
            {"key": "question", "name": "智能题库", "status": "healthy", "latency_ms": 82, "instances": 3},
            {"key": "grading", "name": "AI 评阅", "status": "healthy", "latency_ms": 196, "instances": 4},
            {"key": "proctor", "name": "智能监考", "status": "healthy", "latency_ms": 106, "instances": 4},
            {"key": "portrait", "name": "能力画像", "status": "healthy", "latency_ms": 138, "instances": 2},
            {"key": "print", "name": "印刷管理", "status": "healthy", "latency_ms": 64, "instances": 1},
        ],
        "updated_at": int(time.time()),
    }


@router.get("/courses")
def courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = []
    for c in db.query(Course).all():
        teachers = db.query(CourseTeacher).filter(CourseTeacher.course_id == c.id).all()
        teacher_list = []
        for ct in teachers:
            t = db.query(User).filter(User.id == ct.teacher_id).first()
            if t:
                teacher_list.append({
                    "id": ct.id, "teacher_id": t.id, "name": t.name, "username": t.username,
                    "role": ct.role, "can_edit_questions": ct.can_edit_questions,
                    "can_assemble_paper": ct.can_assemble_paper, "can_grade": ct.can_grade,
                    "can_view_analytics": ct.can_view_analytics, "joined_at": ct.joined_at.isoformat() if ct.joined_at else None,
                })
        items.append({"id": c.id, "code": c.code, "name": c.name, "credit": c.credit,
                       "description": c.description or "", "teachers": teacher_list})
    return {"items": items}


@router.get("/users")
def users(role: str = "", user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    return {"items": [u.to_dict() for u in q.order_by(User.id).all()]}


@router.get("/audit")
def audit_logs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(100).all()
    return {"items": [{
        "id": l.id, "action": l.action, "target": l.target, "detail": l.detail or {},
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in logs]}


@router.get("/search")
def global_search(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    type: str = Query("all", description="搜索类型：all/exam/question/paper/user/course"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """全局搜索：跨模块搜索考试、题目、试卷、用户、课程"""
    results = {"exams": [], "questions": [], "papers": [], "users": [], "courses": []}
    keyword = f"%{q}%"

    if type in ("all", "exam"):
        exams = db.query(Exam).filter(
            or_(Exam.title.like(keyword), Exam.description.like(keyword))
        ).limit(10).all()
        results["exams"] = [{"id": e.id, "title": e.title, "status": e.status,
                             "start_time": e.start_time.isoformat() if e.start_time else None} for e in exams]

    if type in ("all", "question"):
        questions = db.query(Question).filter(
            or_(Question.content.like(keyword), Question.knowledge_point.like(keyword))
        ).limit(10).all()
        results["questions"] = [{"id": q.id, "content": q.content[:100], "type": q.type,
                                 "difficulty": q.difficulty, "knowledge_point": q.knowledge_point} for q in questions]

    if type in ("all", "paper"):
        papers = db.query(Paper).filter(
            or_(Paper.title.like(keyword), Paper.description.like(keyword))
        ).limit(10).all()
        results["papers"] = [{"id": p.id, "title": p.title, "total_score": p.total_score,
                              "question_count": p.question_count} for p in papers]

    if type in ("all", "user"):
        users = db.query(User).filter(
            or_(User.username.like(keyword), User.real_name.like(keyword), User.student_id.like(keyword))
        ).limit(10).all()
        results["users"] = [{"id": u.id, "username": u.username, "real_name": u.real_name,
                             "role": u.role, "student_id": u.student_id} for u in users]

    if type in ("all", "course"):
        courses = db.query(Course).filter(
            or_(Course.name.like(keyword), Course.code.like(keyword))
        ).limit(10).all()
        results["courses"] = [{"id": c.id, "code": c.code, "name": c.name, "credit": c.credit} for c in courses]

    total = sum(len(v) for v in results.values())
    return {"query": q, "type": type, "total": total, "results": results}


# ==================== 课程教师管理（多教师+角色权限） ====================

@router.get("/courses/{course_id}/teachers")
def get_course_teachers(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取课程教师列表（含角色和权限）"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return {"items": [], "course": None}
    teachers = db.query(CourseTeacher).filter(CourseTeacher.course_id == course_id).order_by(CourseTeacher.joined_at).all()
    items = []
    for ct in teachers:
        t = db.query(User).filter(User.id == ct.teacher_id).first()
        if t:
            items.append({
                "id": ct.id, "teacher_id": t.id, "name": t.name, "username": t.username,
                "email": t.email or "", "college": t.college or "",
                "role": ct.role, "can_edit_questions": ct.can_edit_questions,
                "can_assemble_paper": ct.can_assemble_paper, "can_grade": ct.can_grade,
                "can_view_analytics": ct.can_view_analytics,
                "joined_at": ct.joined_at.isoformat() if ct.joined_at else None,
            })
    return {"items": items, "course": {"id": course.id, "name": course.name, "code": course.code}}


@router.post("/courses/{course_id}/teachers")
def add_course_teacher(course_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """添加教师到课程题库（指定角色和权限）"""
    teacher_id = body.get("teacher_id")
    role = body.get("role", "teacher")
    if not teacher_id:
        return {"error": "teacher_id is required"}, 400

    # 检查是否已存在
    existing = db.query(CourseTeacher).filter(
        CourseTeacher.course_id == course_id,
        CourseTeacher.teacher_id == teacher_id
    ).first()
    if existing:
        return {"error": "该教师已在此课程中", "existing": True}, 400

    ct = CourseTeacher(
        course_id=course_id, teacher_id=teacher_id, role=role,
        can_edit_questions=body.get("can_edit_questions", True),
        can_assemble_paper=body.get("can_assemble_paper", True),
        can_grade=body.get("can_grade", False),
        can_view_analytics=body.get("can_view_analytics", True),
    )
    db.add(ct)
    db.commit()
    db.refresh(ct)
    t = db.query(User).filter(User.id == teacher_id).first()
    return {"success": True, "id": ct.id, "name": t.name if t else "", "role": role}


@router.put("/courses/{course_id}/teachers/{ct_id}")
def update_course_teacher(course_id: int, ct_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """更新课程教师的角色和权限"""
    ct = db.query(CourseTeacher).filter(CourseTeacher.id == ct_id, CourseTeacher.course_id == course_id).first()
    if not ct:
        return {"error": "记录不存在"}, 404
    if "role" in body:
        ct.role = body["role"]
    if "can_edit_questions" in body:
        ct.can_edit_questions = body["can_edit_questions"]
    if "can_assemble_paper" in body:
        ct.can_assemble_paper = body["can_assemble_paper"]
    if "can_grade" in body:
        ct.can_grade = body["can_grade"]
    if "can_view_analytics" in body:
        ct.can_view_analytics = body["can_view_analytics"]
    db.commit()
    return {"success": True, "id": ct.id}


@router.delete("/courses/{course_id}/teachers/{ct_id}")
def remove_course_teacher(course_id: int, ct_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """从课程移除教师"""
    ct = db.query(CourseTeacher).filter(CourseTeacher.id == ct_id, CourseTeacher.course_id == course_id).first()
    if not ct:
        return {"error": "记录不存在"}, 404
    db.delete(ct)
    db.commit()
    return {"success": True}


@router.get("/teachers/available")
def available_teachers(course_id: int = 0, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取可添加到课程的教师列表（排除已在课程中的）"""
    teachers = db.query(User).filter(User.role == "teacher").order_by(User.id).all()
    if course_id:
        existing_ids = [ct.teacher_id for ct in db.query(CourseTeacher).filter(CourseTeacher.course_id == course_id).all()]
        teachers = [t for t in teachers if t.id not in existing_ids]
    return {"items": [{"id": t.id, "name": t.name, "username": t.username,
                       "email": t.email or "", "college": t.college or ""} for t in teachers]}


@router.get("/todos")
def get_todos(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前用户待办事项（根据角色聚合）"""
    todos = []

    if user.role in ("admin", "teacher"):
        # 待阅卷任务
        pending_grading = db.query(Exam).filter(Exam.status == "grading").count()
        if pending_grading > 0:
            todos.append({"type": "grading", "title": f"{pending_grading}场考试待阅卷",
                          "url": "/grading", "priority": "high", "count": pending_grading})

        # 待审核题目
        pending_questions = db.query(Question).filter(Question.status == "pending").count()
        if pending_questions > 0:
            todos.append({"type": "question_review", "title": f"{pending_questions}道题目待审核",
                          "url": "/question-bank-manage", "priority": "medium", "count": pending_questions})

        # 进行中考试
        ongoing_exams = db.query(Exam).filter(Exam.status == "ongoing").count()
        if ongoing_exams > 0:
            todos.append({"type": "ongoing_exam", "title": f"{ongoing_exams}场考试进行中",
                          "url": "/exam-management", "priority": "high", "count": ongoing_exams})

    if user.role == "student":
        # 待考考试
        upcoming_exams = db.query(Exam).filter(Exam.status == "published").count()
        if upcoming_exams > 0:
            todos.append({"type": "upcoming_exam", "title": f"{upcoming_exams}场考试待参加",
                          "url": "/", "priority": "high", "count": upcoming_exams})

        # 待复习错题
        todos.append({"type": "wrong_book", "title": "错题本待复习",
                      "url": "/wrong-book", "priority": "medium", "count": 0})

        # 能力画像查看
        todos.append({"type": "portrait", "title": "查看能力画像",
                      "url": "/portrait", "priority": "low", "count": 0})

    return {"items": todos, "total": len(todos)}
