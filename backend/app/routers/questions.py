from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import User, Question, QuestionKP, QuestionDim, Course, QuestionSource
from ..deps import get_current_user, require_roles
from ..services.document_import_service import import_questions_from_file
from ..services.web_search_service import web_search_questions

router = APIRouter(prefix="/api/questions", tags=["questions"])


class QuestionReq(BaseModel):
    course_id: int
    type: str
    subject: str = ""
    stem: str
    options: list = []
    answer: str = ""
    analysis: str = ""
    scoring_rubric: dict = {}
    difficulty: float = 3.0
    kps: list = []      # 知识点 id 列表
    dims: list = []     # 能力维度 id 列表
    tags: list = []


@router.get("")
def list_questions(course_id: int = 0, qtype: str = "", keyword: str = "",
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Question)
    if course_id:
        q = q.filter(Question.course_id == course_id)
    if qtype:
        q = q.filter(Question.type == qtype)
    if keyword:
        q = q.filter(Question.stem.contains(keyword))
    items = []
    for question in q.order_by(Question.id.desc()).limit(300).all():
        items.append(question_to_dict(db, question))
    return {"items": items, "total": len(items)}


def question_to_dict(db: Session, question: Question) -> dict:
    kps = [r.kp_id for r in db.query(QuestionKP).filter_by(question_id=question.id).all()]
    dims = [r.dim_id for r in db.query(QuestionDim).filter_by(question_id=question.id).all()]
    return {
        "id": question.id, "course_id": question.course_id, "type": question.type,
        "subject": question.subject, "stem": question.stem, "options": question.options or [],
        "answer": question.answer, "analysis": question.analysis,
        "scoring_rubric": question.scoring_rubric or {}, "difficulty": question.difficulty,
        "source": question.source, "tags": question.tags or [], "kps": kps, "dims": dims,
        "created_at": question.created_at.isoformat() if question.created_at else None,
    }


@router.post("")
def create_question(req: QuestionReq, user: User = Depends(require_roles("admin", "teacher")),
                    db: Session = Depends(get_db)):
    q = Question(course_id=req.course_id, type=req.type, subject=req.subject, stem=req.stem,
                 options=req.options, answer=req.answer, analysis=req.analysis,
                 scoring_rubric=req.scoring_rubric, difficulty=req.difficulty,
                 tags=req.tags, created_by=user.id)
    db.add(q)
    db.flush()
    for kp in req.kps:
        db.add(QuestionKP(question_id=q.id, kp_id=kp))
    for d in req.dims:
        db.add(QuestionDim(question_id=q.id, dim_id=d))
    db.commit()
    return {"id": q.id}


@router.put("/{qid}")
def update_question(qid: int, req: QuestionReq, user: User = Depends(require_roles("admin", "teacher")),
                    db: Session = Depends(get_db)):
    q = db.query(Question).get(qid)
    if not q:
        raise HTTPException(404, "题目不存在")
    for k, v in req.dict().items():
        if k in ("kps", "dims"):
            continue
        setattr(q, k, v)
    db.query(QuestionKP).filter_by(question_id=qid).delete()
    db.query(QuestionDim).filter_by(question_id=qid).delete()
    for kp in req.kps:
        db.add(QuestionKP(question_id=qid, kp_id=kp))
    for d in req.dims:
        db.add(QuestionDim(question_id=qid, dim_id=d))
    db.commit()
    return {"ok": True}


@router.delete("/{qid}")
def delete_question(qid: int, user: User = Depends(require_roles("admin", "teacher")),
                    db: Session = Depends(get_db)):
    q = db.query(Question).get(qid)
    if not q:
        raise HTTPException(404, "题目不存在")
    db.query(QuestionKP).filter_by(question_id=qid).delete()
    db.query(QuestionDim).filter_by(question_id=qid).delete()
    db.delete(q)
    db.commit()
    return {"ok": True}


# ============ 文档导入 ============

class ImportConfirmReq(BaseModel):
    course_id: int
    questions: list


@router.post("/import/parse")
async def import_parse(file: UploadFile = File(...), course_id: int = 1,
                       user: User = Depends(require_roles("admin", "teacher"))):
    """上传试卷文档，解析题目并返回预览列表（不入库）"""
    content = await file.read()
    if not content:
        raise HTTPException(400, "文件为空")
    result = import_questions_from_file(content, file.filename, course_id)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "解析失败"))
    return result


@router.post("/import/confirm")
def import_confirm(req: ImportConfirmReq, user: User = Depends(require_roles("admin", "teacher")),
                   db: Session = Depends(get_db)):
    """确认导入，批量将预览题目入库"""
    if not req.questions:
        raise HTTPException(400, "没有可导入的题目")
    created = []
    for q in req.questions:
        if not q.get("stem", "").strip():
            continue
        new_q = Question(
            course_id=req.course_id,
            type=q.get("type", "subjective"),
            subject=q.get("subject", ""),
            stem=q["stem"].strip(),
            options=q.get("options", []),
            answer=q.get("answer", ""),
            analysis=q.get("analysis", ""),
            difficulty=q.get("difficulty", 3.0),
            source=q.get("source", "文档导入"),
            tags=q.get("tags", []),
            created_by=user.id,
        )
        db.add(new_q)
        db.flush()
        created.append(new_q.id)
        # 知识点标签
        for kp in q.get("kps", []) or []:
            db.add(QuestionKP(question_id=new_q.id, kp_id=kp))
    db.commit()
    return {"ok": True, "created_count": len(created), "ids": created}


# ============ 联网搜索组题 ============

class WebSearchReq(BaseModel):
    keyword: str
    qtype: str = ""
    count: int = 10
    course_name: str = ""
    difficulty: float = 3.0
    sources: list = None


@router.get("/search-web/sources")
def list_search_sources(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取可用的组题数据源列表"""
    from ..services.web_search_service import DATA_SOURCES
    existing = {s.key: s for s in db.query(QuestionSource).all()}
    for key, cfg in DATA_SOURCES.items():
        if key not in existing:
            source = QuestionSource(key=key, name=cfg["name"], category=cfg.get("category", "综合题库"),
                                    base_url=cfg.get("site", ""), description=cfg["desc"],
                                    config={"accent": cfg.get("accent", "#2563eb")})
            db.add(source)
    db.commit()
    existing = {s.key: s for s in db.query(QuestionSource).all()}
    source_counts = dict(db.query(Question.source, func.count(Question.id)).group_by(Question.source).all())
    items = []
    for key, cfg in DATA_SOURCES.items():
        row = existing[key]
        imported = sum(v for source, v in source_counts.items() if source and (key in source.lower() or cfg["name"] in source))
        items.append({"key": key, "name": row.name, "desc": row.description, "category": row.category,
                      "enabled": row.enabled, "status": row.status, "question_count": imported or row.question_count,
                      "last_sync_at": row.last_sync_at.isoformat() if row.last_sync_at else None,
                      "accent": (row.config or {}).get("accent", cfg.get("accent", "#2563eb"))})
    return {"items": items, "total": len(items), "local_total": db.query(Question).count()}


@router.put("/search-web/sources/{source_key}")
def update_search_source(source_key: str, body: dict,
                         user: User = Depends(require_roles("admin", "teacher")),
                         db: Session = Depends(get_db)):
    source = db.query(QuestionSource).filter_by(key=source_key).first()
    if not source:
        raise HTTPException(404, "数据源不存在")
    if "enabled" in body:
        source.enabled = bool(body["enabled"])
    source.status = "ready" if source.enabled else "disabled"
    db.commit()
    return {"ok": True, "key": source.key, "enabled": source.enabled, "status": source.status}


@router.post("/search-web")
def search_web(req: WebSearchReq, user: User = Depends(get_current_user)):
    """联网搜索题目，返回候选列表（不入库）"""
    result = web_search_questions(
        keyword=req.keyword, qtype=req.qtype, count=min(req.count, 20),
        course_name=req.course_name, difficulty=req.difficulty,
        sources=req.sources or ["general"],
    )
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "搜索失败"))
    return result


@router.post("/search-web/import")
def import_web_results(req: ImportConfirmReq, user: User = Depends(require_roles("admin", "teacher")),
                       db: Session = Depends(get_db)):
    """将联网搜索到的题目批量入库"""
    return import_confirm(req, user, db)


# ============ 题目查重 ============

class DuplicateCheckReq(BaseModel):
    stem: str
    course_id: int = 0
    threshold: float = 0.7


@router.post("/check-duplicate")
def check_duplicate(req: DuplicateCheckReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """题目查重：基于题干文本相似度检测重复题目"""
    import re
    from difflib import SequenceMatcher

    def normalize(text):
        text = re.sub(r'\s+', '', text or '')
        text = re.sub(r'[，。、；：“”‘’（）【】《》！？.,;:!?()\[\]{}]', '', text)
        return text.lower()

    target = normalize(req.stem)
    if not target:
        return {"duplicates": [], "total": 0}

    q = db.query(Question)
    if req.course_id:
        q = q.filter(Question.course_id == req.course_id)

    duplicates = []
    for question in q.all():
        source = normalize(question.stem)
        if not source:
            continue
        similarity = SequenceMatcher(None, target, source).ratio()
        if similarity >= req.threshold:
            duplicates.append({
                "id": question.id,
                "stem": question.stem[:200],
                "type": question.type,
                "similarity": round(similarity, 4),
                "course_id": question.course_id,
            })

    duplicates.sort(key=lambda x: x["similarity"], reverse=True)
    return {"duplicates": duplicates[:20], "total": len(duplicates), "threshold": req.threshold}
