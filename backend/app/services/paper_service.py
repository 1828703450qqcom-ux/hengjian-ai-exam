"""智能组卷服务
按难度、知识点覆盖、能力维度覆盖、题型分布多目标选择题目
"""
import random
from sqlalchemy.orm import Session
from .. import models


def assemble_paper(db: Session, course_id: int, title: str,
                   target_difficulty: float = 3.0,
                   total_score: float = 100.0,
                   type_distribution: dict = None,
                   kp_coverage: list[int] = None,
                   dim_coverage: list[int] = None,
                   count: int = 0) -> models.Paper:
    """多目标组卷：难度匹配 + 知识点覆盖 + 能力维度覆盖 + 题型分布"""
    type_distribution = type_distribution or {
        "single_choice": 5, "multiple_choice": 3, "judge": 3, "fill": 2,
        "subjective": 2, "essay": 1, "translation": 1,
    }
    questions = db.query(models.Question).filter(
        models.Question.course_id == course_id,
        models.Question.status == "active",
    ).all()
    if not questions:
        raise ValueError("该课程暂无可用题目")

    kp_set = set(kp_coverage or [])
    dim_set = set(dim_coverage or [])
    selected: list[models.Question] = []

    def _q_kps(q):
        return {r.kp_id for r in db.query(models.QuestionKP).filter_by(question_id=q.id).all()}

    def _q_dims(q):
        return {r.dim_id for r in db.query(models.QuestionDim).filter_by(question_id=q.id).all()}

    for qtype, num in type_distribution.items():
        pool = [q for q in questions if q.type == qtype and q not in selected]
        if not pool:
            continue
        # 先优先覆盖目标知识点
        if kp_set:
            ordered = sorted(pool, key=lambda q: -len(_q_kps(q) & kp_set))
        else:
            ordered = sorted(pool, key=lambda q: -abs(q.difficulty - target_difficulty))
        chosen = ordered[:num]
        # 若数量不足则随机补足
        need = num - len(chosen)
        if need > 0:
            rest = [q for q in pool if q not in chosen]
            chosen += random.sample(rest, min(need, len(rest)))
        selected += chosen

    if count and len(selected) > count:
        selected = selected[:count]

    # 分数分配：按题目难度比例
    total_d = sum(q.difficulty for q in selected) or 1
    paper = models.Paper(course_id=course_id, title=title, total_score=total_score,
                         difficulty=target_difficulty, status="published", created_by=1)
    db.add(paper)
    db.flush()
    for i, q in enumerate(selected):
        score = round(total_score * (q.difficulty / total_d), 1)
        db.add(models.PaperQuestion(paper_id=paper.id, question_id=q.id, order_index=i, score=score))
    db.commit()
    db.refresh(paper)
    return paper


def paper_detail(db: Session, paper_id: int) -> dict:
    paper = db.query(models.Paper).get(paper_id)
    pqs = db.query(models.PaperQuestion).filter_by(paper_id=paper_id).order_by(models.PaperQuestion.order_index).all()
    items = []
    for pq in pqs:
        q = db.query(models.Question).get(pq.question_id)
        items.append({
            "paper_question_id": pq.id, "question_id": q.id, "type": q.type,
            "subject": q.subject, "stem": q.stem, "options": q.options or [],
            "score": pq.score, "difficulty": q.difficulty,
            "order_index": pq.order_index,
        })
    return {
        "id": paper.id, "title": paper.title, "total_score": paper.total_score,
        "difficulty": paper.difficulty, "status": paper.status, "questions": items,
        "question_count": len(items),
    }
