"""印刷管理系统 API
覆盖：印厂管理/任务管理/审核管理/印刷进度管理/领取记录/统计分析
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from pydantic import BaseModel
from ..database import get_db
from ..models import (
    User, PrintFactory, PrintTask, PrintReview, PrintRecord, PrintPickup,
    Exam, Course,
)
from .auth import get_current_user

router = APIRouter(prefix="/api/print", tags=["印刷管理系统"])


# ---------------- 印厂管理 ----------------
class FactoryCreate(BaseModel):
    name: str
    manager_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    support_binding: bool = True
    support_packaging: bool = True
    paper_types: List[str] = []


class FactoryUpdate(BaseModel):
    name: Optional[str] = None
    manager_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    support_binding: Optional[bool] = None
    support_packaging: Optional[bool] = None
    paper_types: Optional[List[str]] = None
    status: Optional[str] = None


@router.get("/factories")
def list_factories(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取印厂列表"""
    query = db.query(PrintFactory)
    if status:
        query = query.filter(PrintFactory.status == status)
    factories = query.order_by(desc(PrintFactory.created_at)).all()
    result = []
    for f in factories:
        manager = db.query(User).filter(User.id == f.manager_id).first()
        reviewer = db.query(User).filter(User.id == f.reviewer_id).first()
        result.append({
            "id": f.id, "name": f.name,
            "manager_id": f.manager_id,
            "manager_name": manager.name if manager else None,
            "reviewer_id": f.reviewer_id,
            "reviewer_name": reviewer.name if reviewer else None,
            "contact_phone": f.contact_phone, "address": f.address,
            "support_binding": f.support_binding, "support_packaging": f.support_packaging,
            "paper_types": f.paper_types or [], "status": f.status,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    return {"factories": result, "total": len(result)}


@router.post("/factories")
def create_factory(
    data: FactoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建印厂"""
    if current_user.role not in ["admin", "school_admin"]:
        raise HTTPException(403, "仅管理员可创建印厂")
    factory = PrintFactory(
        name=data.name, manager_id=data.manager_id, reviewer_id=data.reviewer_id,
        contact_phone=data.contact_phone, address=data.address,
        support_binding=data.support_binding, support_packaging=data.support_packaging,
        paper_types=data.paper_types,
    )
    db.add(factory)
    db.commit()
    db.refresh(factory)
    return {"id": factory.id, "message": "印厂创建成功"}


@router.put("/factories/{factory_id}")
def update_factory(
    factory_id: int, data: FactoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新印厂信息"""
    factory = db.query(PrintFactory).filter(PrintFactory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "印厂不存在")
    for field, value in data.dict(exclude_unset=True).items():
        setattr(factory, field, value)
    db.commit()
    return {"message": "印厂信息更新成功"}


@router.delete("/factories/{factory_id}")
def delete_factory(
    factory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除印厂（软删除，改为disabled）"""
    factory = db.query(PrintFactory).filter(PrintFactory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "印厂不存在")
    factory.status = "disabled"
    db.commit()
    return {"message": "印厂已禁用"}


# ---------------- 任务管理 ----------------
class TaskCreate(BaseModel):
    title: str
    exam_id: Optional[int] = None
    course_id: Optional[int] = None
    factory_id: Optional[int] = None
    paper_count: int = 0
    answer_sheet_count: int = 0
    paper_type: str = "A3"
    answer_sheet_type: str = "A3"
    binding_requirement: Optional[str] = None
    packaging_requirement: Optional[str] = None
    deadline: Optional[str] = None
    contact_phone: Optional[str] = None
    confidentiality_enabled: bool = True
    paper_file_url: Optional[str] = None
    answer_sheet_file_url: Optional[str] = None
    attachment_url: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    factory_id: Optional[int] = None
    paper_count: Optional[int] = None
    answer_sheet_count: Optional[int] = None
    paper_type: Optional[str] = None
    answer_sheet_type: Optional[str] = None
    binding_requirement: Optional[str] = None
    packaging_requirement: Optional[str] = None
    deadline: Optional[str] = None
    contact_phone: Optional[str] = None
    confidentiality_enabled: Optional[bool] = None


@router.get("/tasks")
def list_tasks(
    status: Optional[str] = None,
    factory_id: Optional[int] = None,
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取印刷任务列表"""
    query = db.query(PrintTask)
    if status:
        query = query.filter(PrintTask.status == status)
    if factory_id:
        query = query.filter(PrintTask.factory_id == factory_id)
    if course_id:
        query = query.filter(PrintTask.course_id == course_id)
    # 权限控制：教师只能看自己创建的任务
    if current_user.role == "teacher":
        query = query.filter(PrintTask.creator_id == current_user.id)
    tasks = query.order_by(desc(PrintTask.created_at)).all()
    result = []
    for t in tasks:
        factory = db.query(PrintFactory).filter(PrintFactory.id == t.factory_id).first()
        course = db.query(Course).filter(Course.id == t.course_id).first()
        creator = db.query(User).filter(User.id == t.creator_id).first()
        result.append({
            "id": t.id, "task_no": t.task_no, "title": t.title,
            "exam_id": t.exam_id, "course_id": t.course_id,
            "course_name": course.name if course else None,
            "factory_id": t.factory_id,
            "factory_name": factory.name if factory else None,
            "creator_id": t.creator_id,
            "creator_name": creator.name if creator else None,
            "paper_count": t.paper_count, "answer_sheet_count": t.answer_sheet_count,
            "paper_type": t.paper_type, "answer_sheet_type": t.answer_sheet_type,
            "binding_requirement": t.binding_requirement, "packaging_requirement": t.packaging_requirement,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "contact_phone": t.contact_phone, "status": t.status,
            "confidentiality_enabled": t.confidentiality_enabled,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    return {"tasks": result, "total": len(result)}


@router.post("/tasks")
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建印刷任务"""
    # 生成任务编号
    task_no = f"PT{datetime.now().strftime('%Y%m%d%H%M%S')}"
    deadline = None
    if data.deadline:
        try:
            deadline = datetime.fromisoformat(data.deadline)
        except:
            pass
    task = PrintTask(
        task_no=task_no, title=data.title, exam_id=data.exam_id,
        course_id=data.course_id, factory_id=data.factory_id,
        creator_id=current_user.id, paper_count=data.paper_count,
        answer_sheet_count=data.answer_sheet_count, paper_type=data.paper_type,
        answer_sheet_type=data.answer_sheet_type, binding_requirement=data.binding_requirement,
        packaging_requirement=data.packaging_requirement, deadline=deadline,
        contact_phone=data.contact_phone, confidentiality_enabled=data.confidentiality_enabled,
        paper_file_url=data.paper_file_url, answer_sheet_file_url=data.answer_sheet_file_url,
        attachment_url=data.attachment_url, status="draft",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "task_no": task_no, "message": "印刷任务创建成功"}


@router.put("/tasks/{task_id}")
def update_task(
    task_id: int, data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新印刷任务（仅draft状态可修改）"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status not in ["draft", "rejected"]:
        raise HTTPException(400, "仅草稿或已驳回状态可修改")
    for field, value in data.dict(exclude_unset=True).items():
        if field == "deadline" and value:
            try:
                value = datetime.fromisoformat(value)
            except:
                pass
        setattr(task, field, value)
    db.commit()
    return {"message": "任务更新成功"}


@router.post("/tasks/{task_id}/submit")
def submit_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交任务审核"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status not in ["draft", "rejected"]:
        raise HTTPException(400, "仅草稿或已驳回状态可提交")
    if not task.factory_id:
        raise HTTPException(400, "请先选择印厂")
    task.status = "pending_review"
    db.commit()
    return {"message": "任务已提交审核"}


@router.post("/tasks/{task_id}/withdraw")
def withdraw_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """撤回任务"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status != "pending_review":
        raise HTTPException(400, "仅待审核状态可撤回")
    task.status = "draft"
    db.commit()
    return {"message": "任务已撤回"}


@router.get("/tasks/{task_id}")
def get_task_detail(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取任务详情"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    factory = db.query(PrintFactory).filter(PrintFactory.id == task.factory_id).first()
    course = db.query(Course).filter(Course.id == task.course_id).first()
    creator = db.query(User).filter(User.id == task.creator_id).first()
    reviews = db.query(PrintReview).filter(PrintReview.task_id == task_id).order_by(PrintReview.reviewed_at).all()
    records = db.query(PrintRecord).filter(PrintRecord.task_id == task_id).order_by(PrintRecord.created_at).all()
    pickups = db.query(PrintPickup).filter(PrintPickup.task_id == task_id).order_by(PrintPickup.picked_at).all()
    return {
        "id": task.id, "task_no": task.task_no, "title": task.title,
        "exam_id": task.exam_id, "course_id": task.course_id,
        "course_name": course.name if course else None,
        "factory_id": task.factory_id, "factory_name": factory.name if factory else None,
        "creator_id": task.creator_id, "creator_name": creator.name if creator else None,
        "paper_count": task.paper_count, "answer_sheet_count": task.answer_sheet_count,
        "paper_type": task.paper_type, "answer_sheet_type": task.answer_sheet_type,
        "binding_requirement": task.binding_requirement, "packaging_requirement": task.packaging_requirement,
        "deadline": task.deadline.isoformat() if task.deadline else None,
        "contact_phone": task.contact_phone, "status": task.status,
        "confidentiality_enabled": task.confidentiality_enabled,
        "paper_file_url": task.paper_file_url, "answer_sheet_file_url": task.answer_sheet_file_url,
        "attachment_url": task.attachment_url,
        "reviews": [{"id": r.id, "reviewer_id": r.reviewer_id, "result": r.review_result,
                      "comment": r.review_comment, "time": r.reviewed_at.isoformat() if r.reviewed_at else None}
                     for r in reviews],
        "records": [{"id": r.id, "action": r.action, "operator_id": r.operator_id,
                      "paper_sheets": r.paper_sheets_used, "answer_sheet_sheets": r.answer_sheet_sheets_used,
                      "remark": r.remark, "time": r.created_at.isoformat() if r.created_at else None}
                     for r in records],
        "pickups": [{"id": p.id, "picker_name": p.picker_name, "picker_dept": p.picker_dept,
                      "paper_count": p.paper_count, "answer_sheet_count": p.answer_sheet_count,
                      "picked_at": p.picked_at.isoformat() if p.picked_at else None}
                     for p in pickups],
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }


# ---------------- 审核管理 ----------------
class ReviewData(BaseModel):
    result: str  # approved/rejected
    comment: Optional[str] = None


@router.post("/tasks/{task_id}/review")
def review_task(
    task_id: int, data: ReviewData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """审核任务"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status != "pending_review":
        raise HTTPException(400, "仅待审核状态可审核")
    # 记录审核
    review = PrintReview(
        task_id=task_id, reviewer_id=current_user.id,
        review_result=data.result, review_comment=data.comment,
    )
    db.add(review)
    if data.result == "approved":
        task.status = "accepted"  # 审核通过，等待印刷管理员接受
    else:
        task.status = "rejected"
    db.commit()
    return {"message": "审核完成", "status": task.status}


# ---------------- 印刷进度管理 ----------------
class PrintActionData(BaseModel):
    paper_sheets_used: Optional[int] = 0
    answer_sheet_sheets_used: Optional[int] = 0
    remark: Optional[str] = None


@router.post("/tasks/{task_id}/accept")
def accept_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """印刷管理员接受任务"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status != "accepted":
        raise HTTPException(400, "仅已审核通过状态可接受")
    task.status = "pending_print"
    record = PrintRecord(task_id=task_id, action="accepted", operator_id=current_user.id)
    db.add(record)
    db.commit()
    return {"message": "任务已接受，待印刷"}


@router.post("/tasks/{task_id}/start-printing")
def start_printing(
    task_id: int, data: PrintActionData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """开始印刷"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status != "pending_print":
        raise HTTPException(400, "仅待印刷状态可开始印刷")
    task.status = "printing"
    record = PrintRecord(
        task_id=task_id, action="start_printing", operator_id=current_user.id,
        paper_sheets_used=data.paper_sheets_used or 0,
        answer_sheet_sheets_used=data.answer_sheet_sheets_used or 0,
        remark=data.remark,
    )
    db.add(record)
    db.commit()
    return {"message": "印刷已开始"}


@router.post("/tasks/{task_id}/complete-printing")
def complete_printing(
    task_id: int, data: PrintActionData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """完成印刷"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status != "printing":
        raise HTTPException(400, "仅印刷中状态可完成印刷")
    task.status = "pending_pickup"
    record = PrintRecord(
        task_id=task_id, action="complete_printing", operator_id=current_user.id,
        paper_sheets_used=data.paper_sheets_used or 0,
        answer_sheet_sheets_used=data.answer_sheet_sheets_used or 0,
        remark=data.remark,
    )
    db.add(record)
    db.commit()
    return {"message": "印刷已完成，待领取"}


@router.post("/tasks/{task_id}/start-picking")
def start_picking(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """开始领取"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status != "pending_pickup":
        raise HTTPException(400, "仅待领取状态可开始领取")
    task.status = "picking_up"
    record = PrintRecord(task_id=task_id, action="start_picking", operator_id=current_user.id)
    db.add(record)
    db.commit()
    return {"message": "领取已开始"}


@router.post("/tasks/{task_id}/complete-picking")
def complete_picking(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """结束领取，任务完成"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status != "picking_up":
        raise HTTPException(400, "仅领取中状态可结束领取")
    task.status = "completed"
    record = PrintRecord(task_id=task_id, action="complete_picking", operator_id=current_user.id)
    db.add(record)
    db.commit()
    return {"message": "领取已结束，任务完成"}


# ---------------- 领取记录 ----------------
class PickupCreate(BaseModel):
    picker_name: str
    picker_dept: Optional[str] = None
    paper_count: int = 0
    answer_sheet_count: int = 0


@router.post("/tasks/{task_id}/pickups")
def add_pickup(
    task_id: int, data: PickupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """添加领取记录"""
    task = db.query(PrintTask).filter(PrintTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status not in ["picking_up", "pending_pickup"]:
        raise HTTPException(400, "仅领取相关状态可添加领取记录")
    pickup = PrintPickup(
        task_id=task_id, picker_name=data.picker_name, picker_dept=data.picker_dept,
        paper_count=data.paper_count, answer_sheet_count=data.answer_sheet_count,
        operator_id=current_user.id,
    )
    db.add(pickup)
    db.commit()
    return {"message": "领取记录已添加"}


@router.get("/tasks/{task_id}/pickups")
def list_pickups(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取领取记录列表"""
    pickups = db.query(PrintPickup).filter(PrintPickup.task_id == task_id).order_by(desc(PrintPickup.picked_at)).all()
    total_paper = sum(p.paper_count for p in pickups)
    total_answer = sum(p.answer_sheet_count for p in pickups)
    return {
        "pickups": [{"id": p.id, "picker_name": p.picker_name, "picker_dept": p.picker_dept,
                      "paper_count": p.paper_count, "answer_sheet_count": p.answer_sheet_count,
                      "picked_at": p.picked_at.isoformat() if p.picked_at else None}
                     for p in pickups],
        "total_paper": total_paper, "total_answer_sheet": total_answer,
    }


# ---------------- 印刷统计 ----------------
@router.get("/statistics")
def print_statistics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """印刷统计数据"""
    query = db.query(PrintTask)
    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(PrintTask.created_at >= start)
        except:
            pass
    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            query = query.filter(PrintTask.created_at <= end)
        except:
            pass
    tasks = query.all()

    # 状态统计
    status_counts = {}
    for t in tasks:
        status_counts[t.status] = status_counts.get(t.status, 0) + 1

    # 按印厂统计
    factory_stats = {}
    for t in tasks:
        if t.factory_id:
            factory = db.query(PrintFactory).filter(PrintFactory.id == t.factory_id).first()
            fname = factory.name if factory else "未知"
            if fname not in factory_stats:
                factory_stats[fname] = {"task_count": 0, "paper_count": 0, "answer_sheet_count": 0}
            factory_stats[fname]["task_count"] += 1
            factory_stats[fname]["paper_count"] += t.paper_count
            factory_stats[fname]["answer_sheet_count"] += t.answer_sheet_count

    # 按课程统计
    course_stats = {}
    for t in tasks:
        if t.course_id:
            course = db.query(Course).filter(Course.id == t.course_id).first()
            cname = course.name if course else "未知"
            if cname not in course_stats:
                course_stats[cname] = {"task_count": 0, "paper_count": 0}
            course_stats[cname]["task_count"] += 1
            course_stats[cname]["paper_count"] += t.paper_count

    # 每日印刷量趋势（最近30天）
    daily_trend = []
    today = datetime.now().date()
    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        day_tasks = [t for t in tasks if t.created_at and day_start <= t.created_at < day_end]
        daily_trend.append({
            "date": day.isoformat(),
            "task_count": len(day_tasks),
            "paper_count": sum(t.paper_count for t in day_tasks),
            "answer_sheet_count": sum(t.answer_sheet_count for t in day_tasks),
        })

    total_paper = sum(t.paper_count for t in tasks)
    total_answer = sum(t.answer_sheet_count for t in tasks)

    return {
        "total_tasks": len(tasks),
        "total_paper": total_paper,
        "total_answer_sheet": total_answer,
        "status_counts": status_counts,
        "factory_stats": factory_stats,
        "course_stats": course_stats,
        "daily_trend": daily_trend,
    }


@router.get("/dashboard")
def print_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """印刷数据大屏概览"""
    # 今日数据
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_tasks = db.query(PrintTask).filter(PrintTask.created_at >= today_start).all()

    # 进行中任务
    active_statuses = ["pending_review", "accepted", "pending_print", "printing", "pending_pickup", "picking_up"]
    active_tasks = db.query(PrintTask).filter(PrintTask.status.in_(active_statuses)).all()

    # 各状态数量
    status_counts = {}
    all_tasks = db.query(PrintTask).all()
    for t in all_tasks:
        status_counts[t.status] = status_counts.get(t.status, 0) + 1

    # 印厂工作量
    factory_workload = []
    factories = db.query(PrintFactory).filter(PrintFactory.status == "active").all()
    for f in factories:
        f_tasks = [t for t in active_tasks if t.factory_id == f.id]
        factory_workload.append({
            "factory_id": f.id, "factory_name": f.name,
            "active_task_count": len(f_tasks),
            "total_paper": sum(t.paper_count for t in f_tasks),
        })

    completed_tasks = [t for t in all_tasks if t.status == "completed"]
    overdue_tasks = [t for t in active_tasks if t.deadline and t.deadline < datetime.now()]
    urgent_tasks = [t for t in active_tasks if t.deadline and datetime.now() <= t.deadline <= datetime.now() + timedelta(hours=24)]
    total_sheets = sum((t.paper_count or 0) + (t.answer_sheet_count or 0) for t in all_tasks)
    confidential_tasks = [t for t in active_tasks if t.confidentiality_enabled]

    return {
        "today_task_count": len(today_tasks),
        "today_paper_count": sum(t.paper_count for t in today_tasks),
        "active_task_count": len(active_tasks),
        "total_task_count": len(all_tasks),
        "status_counts": status_counts,
        "factory_workload": factory_workload,
        "quality": {
            "completion_rate": round(len(completed_tasks) / max(len(all_tasks), 1) * 100, 1),
            "overdue_count": len(overdue_tasks), "urgent_count": len(urgent_tasks),
            "total_sheets": total_sheets, "confidential_active": len(confidential_tasks),
            "factory_utilization": round(len([f for f in factory_workload if f["active_task_count"]]) / max(len(factory_workload), 1) * 100, 1),
        },
        "urgent_tasks": [{"id": t.id, "task_no": t.task_no, "title": t.title,
                           "deadline": t.deadline.isoformat() if t.deadline else None,
                           "paper_count": t.paper_count, "status": t.status}
                          for t in urgent_tasks + overdue_tasks],
        "recent_tasks": [{"id": t.id, "task_no": t.task_no, "title": t.title,
                           "status": t.status, "paper_count": t.paper_count,
                           "created_at": t.created_at.isoformat() if t.created_at else None}
                          for t in all_tasks[:10]],
    }
