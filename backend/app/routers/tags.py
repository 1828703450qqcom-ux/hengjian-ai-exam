"""课程标签管理 API
覆盖：知识点标签/章节标签/难度标签/自定义标签，支持5级树形结构
对应考试大纲管理，便于题库分类管理和查询、组卷
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from pydantic import BaseModel
from ..database import get_db
from ..models import User, Course, CourseTag
from .auth import get_current_user

router = APIRouter(prefix="/api/tags", tags=["课程标签管理"])

TAG_TYPES = {
    "knowledge": "知识点标签",
    "chapter": "章节标签",
    "difficulty": "难度标签",
    "custom": "自定义标签",
}

MAX_LEVEL = 5  # 最多支持5级树形结构
MAX_CUSTOM_TAGS = 5  # 每个课程最多5个自定义标签体系


class TagCreate(BaseModel):
    course_id: int
    tag_type: str  # knowledge/chapter/difficulty/custom
    name: str
    code: Optional[str] = None
    parent_id: Optional[int] = None
    difficulty_value: Optional[float] = None  # 仅难度标签
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class TagUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    difficulty_value: Optional[float] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


def build_tag_tree(tags: List[CourseTag], parent_id: int = None) -> List[dict]:
    """构建树形结构"""
    tree = []
    for tag in tags:
        if tag.parent_id == parent_id:
            children = build_tag_tree(tags, tag.id)
            tree.append({
                "id": tag.id,
                "course_id": tag.course_id,
                "tag_type": tag.tag_type,
                "tag_type_label": TAG_TYPES.get(tag.tag_type, tag.tag_type),
                "name": tag.name,
                "code": tag.code,
                "level": tag.level,
                "parent_id": tag.parent_id,
                "difficulty_value": tag.difficulty_value,
                "description": tag.description,
                "sort_order": tag.sort_order,
                "created_at": tag.created_at.isoformat() if tag.created_at else None,
                "children": children,
            })
    return tree


@router.get("/courses/{course_id}/types")
def get_tag_types(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取课程的标签类型统计（各类型标签数量）"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(404, "课程不存在")

    result = {}
    for tag_type, label in TAG_TYPES.items():
        count = db.query(CourseTag).filter(
            CourseTag.course_id == course_id,
            CourseTag.tag_type == tag_type
        ).count()
        result[tag_type] = {
            "label": label,
            "count": count,
            "max_custom_tags": MAX_CUSTOM_TAGS if tag_type == "custom" else None,
        }
    return {"course_id": course_id, "course_name": course.name, "tag_types": result}


@router.get("/courses/{course_id}/tree")
def get_tag_tree(
    course_id: int,
    tag_type: Optional[str] = Query(None, description="标签类型：knowledge/chapter/difficulty/custom"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取课程标签树（支持按类型筛选）"""
    query = db.query(CourseTag).filter(CourseTag.course_id == course_id)
    if tag_type:
        if tag_type not in TAG_TYPES:
            raise HTTPException(400, f"无效的标签类型，支持：{', '.join(TAG_TYPES.keys())}")
        query = query.filter(CourseTag.tag_type == tag_type)

    tags = query.order_by(CourseTag.sort_order, CourseTag.id).all()
    tree = build_tag_tree(tags)

    return {
        "course_id": course_id,
        "tag_type": tag_type or "all",
        "total_count": len(tags),
        "tree": tree,
    }


@router.post("")
def create_tag(
    data: TagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建标签"""
    # 验证标签类型
    if data.tag_type not in TAG_TYPES:
        raise HTTPException(400, f"无效的标签类型，支持：{', '.join(TAG_TYPES.keys())}")

    # 验证课程存在
    course = db.query(Course).filter(Course.id == data.course_id).first()
    if not course:
        raise HTTPException(404, "课程不存在")

    # 验证父标签存在且类型一致
    level = 1
    if data.parent_id:
        parent = db.query(CourseTag).filter(CourseTag.id == data.parent_id).first()
        if not parent:
            raise HTTPException(404, "父标签不存在")
        if parent.course_id != data.course_id:
            raise HTTPException(400, "父标签不属于当前课程")
        if parent.tag_type != data.tag_type:
            raise HTTPException(400, "父标签类型与当前标签类型不一致")
        level = parent.level + 1
        if level > MAX_LEVEL:
            raise HTTPException(400, f"标签最多支持{MAX_LEVEL}级树形结构")

    # 自定义标签体系限制（一级标签最多5个）
    if data.tag_type == "custom" and level == 1:
        custom_count = db.query(CourseTag).filter(
            CourseTag.course_id == data.course_id,
            CourseTag.tag_type == "custom",
            CourseTag.parent_id.is_(None)
        ).count()
        if custom_count >= MAX_CUSTOM_TAGS:
            raise HTTPException(400, f"每个课程最多支持{MAX_CUSTOM_TAGS}个自定义标签体系")

    # 难度标签验证难度值
    if data.tag_type == "difficulty":
        if data.difficulty_value is not None and (data.difficulty_value < 0 or data.difficulty_value > 1):
            raise HTTPException(400, "难度值必须在0-1之间，难度值数字越大，难度越大")

    tag = CourseTag(
        course_id=data.course_id,
        tag_type=data.tag_type,
        name=data.name,
        code=data.code,
        level=level,
        parent_id=data.parent_id,
        difficulty_value=data.difficulty_value,
        description=data.description,
        sort_order=data.sort_order or 0,
        created_by=current_user.id,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)

    return {
        "id": tag.id,
        "message": f"{TAG_TYPES[data.tag_type]}创建成功",
        "tag": {
            "id": tag.id,
            "name": tag.name,
            "tag_type": tag.tag_type,
            "level": tag.level,
            "parent_id": tag.parent_id,
            "difficulty_value": tag.difficulty_value,
        }
    }


@router.put("/{tag_id}")
def update_tag(
    tag_id: int,
    data: TagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新标签"""
    tag = db.query(CourseTag).filter(CourseTag.id == tag_id).first()
    if not tag:
        raise HTTPException(404, "标签不存在")

    # 难度标签验证难度值
    if tag.tag_type == "difficulty" and data.difficulty_value is not None:
        if data.difficulty_value < 0 or data.difficulty_value > 1:
            raise HTTPException(400, "难度值必须在0-1之间")

    for field, value in data.dict(exclude_unset=True).items():
        setattr(tag, field, value)

    db.commit()
    return {"message": "标签更新成功", "id": tag.id}


@router.delete("/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除标签（级联删除子标签）"""
    tag = db.query(CourseTag).filter(CourseTag.id == tag_id).first()
    if not tag:
        raise HTTPException(404, "标签不存在")

    # 递归删除所有子标签
    def delete_children(parent_id):
        children = db.query(CourseTag).filter(CourseTag.parent_id == parent_id).all()
        for child in children:
            delete_children(child.id)
            db.delete(child)

    delete_children(tag.id)
    db.delete(tag)
    db.commit()

    return {"message": f"标签'{tag.name}'及其子标签已删除"}


@router.post("/{tag_id}/move")
def move_tag(
    tag_id: int,
    new_parent_id: Optional[int] = None,
    new_sort_order: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """移动标签（更改父标签或排序）"""
    tag = db.query(CourseTag).filter(CourseTag.id == tag_id).first()
    if not tag:
        raise HTTPException(404, "标签不存在")

    if new_parent_id is not None:
        if new_parent_id == tag.id:
            raise HTTPException(400, "不能将标签移动到自身下")
        new_parent = db.query(CourseTag).filter(CourseTag.id == new_parent_id).first()
        if not new_parent:
            raise HTTPException(404, "新父标签不存在")
        if new_parent.course_id != tag.course_id:
            raise HTTPException(400, "新父标签不属于当前课程")
        if new_parent.tag_type != tag.tag_type:
            raise HTTPException(400, "新父标签类型与当前标签类型不一致")
        # 检查层级限制
        if new_parent.level + 1 > MAX_LEVEL:
            raise HTTPException(400, f"移动后层级将超过{MAX_LEVEL}级限制")
        tag.parent_id = new_parent_id
        tag.level = new_parent.level + 1
        # 更新所有子标签的层级
        def update_children_level(parent_id, level_delta):
            children = db.query(CourseTag).filter(CourseTag.parent_id == parent_id).all()
            for child in children:
                child.level += level_delta
                update_children_level(child.id, level_delta)
        # 这里简化处理，实际需要计算层级变化
    if new_sort_order is not None:
        tag.sort_order = new_sort_order

    db.commit()
    return {"message": "标签移动成功", "id": tag.id, "new_level": tag.level}


@router.get("/courses/{course_id}/difficulty/list")
def get_difficulty_tags(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取课程的难度标签列表（按难度值排序）"""
    tags = db.query(CourseTag).filter(
        CourseTag.course_id == course_id,
        CourseTag.tag_type == "difficulty"
    ).order_by(CourseTag.difficulty_value.asc(), CourseTag.sort_order).all()

    return {
        "course_id": course_id,
        "difficulty_tags": [
            {
                "id": t.id,
                "name": t.name,
                "code": t.code,
                "difficulty_value": t.difficulty_value,
                "level": t.level,
                "parent_id": t.parent_id,
                "description": t.description,
            }
            for t in tags
        ],
        "total": len(tags),
    }
