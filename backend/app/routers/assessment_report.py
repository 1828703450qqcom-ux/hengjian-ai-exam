"""课程考核评估报告 API
基于AI大模型辅助生成课程考核评估报告、试卷分析、总评成绩统计
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from pydantic import BaseModel
from ..database import get_db
from ..models import (
    User, Course, Exam, ExamParticipant, ExamSession, StudentAnswer,
    Paper, PaperQuestion, Question, CourseObjective,
)
from .auth import get_current_user

router = APIRouter(prefix="/api/assessment-report", tags=["课程考核评估报告"])


class ReportGenerateReq(BaseModel):
    exam_id: int
    report_type: str = "full"  # full/paper_analysis/grade_stats/objective_analysis
    include_ai_analysis: bool = True


@router.get("/exam/{exam_id}/overview")
def get_exam_overview(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取考试概览数据（用于生成评估报告）"""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "考试不存在")

    # 考生统计
    total_participants = db.query(ExamParticipant).filter_by(exam_id=exam_id).count()
    sessions = db.query(ExamSession).filter_by(exam_id=exam_id).all()
    submitted = len([s for s in sessions if s.status in ("submitted", "grading", "graded")])
    absent = total_participants - submitted

    # 成绩统计
    scores = [s.final_score for s in sessions if s.final_score is not None]
    if scores:
        avg_score = sum(scores) / len(scores)
        max_score = max(scores)
        min_score = min(scores)
        # 标准差
        variance = sum((x - avg_score) ** 2 for x in scores) / len(scores)
        std_dev = variance ** 0.5
        # 及格率（60分及格）
        pass_count = len([s for s in scores if s >= 60])
        pass_rate = pass_count / len(scores) * 100
        # 优秀率（85分以上）
        excellent_count = len([s for s in scores if s >= 85])
        excellent_rate = excellent_count / len(scores) * 100
    else:
        avg_score = max_score = min_score = std_dev = 0
        pass_rate = excellent_rate = 0

    # 分数段分布
    score_ranges = {
        "90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "0-59": 0
    }
    for s in scores:
        if s >= 90:
            score_ranges["90-100"] += 1
        elif s >= 80:
            score_ranges["80-89"] += 1
        elif s >= 70:
            score_ranges["70-79"] += 1
        elif s >= 60:
            score_ranges["60-69"] += 1
        else:
            score_ranges["0-59"] += 1

    return {
        "exam_id": exam_id,
        "exam_title": exam.title,
        "course_id": exam.course_id,
        "course_name": exam.course.name if exam.course else "",
        "exam_type": exam.exam_type,
        "start_time": exam.start_time.isoformat() if exam.start_time else None,
        "end_time": exam.end_time.isoformat() if exam.end_time else None,
        "duration_minutes": exam.duration_minutes,
        "participants": {
            "total": total_participants,
            "submitted": submitted,
            "absent": absent,
            "attendance_rate": round(submitted / total_participants * 100, 1) if total_participants > 0 else 0,
        },
        "scores": {
            "count": len(scores),
            "average": round(avg_score, 2),
            "max": max_score,
            "min": min_score,
            "std_dev": round(std_dev, 2),
            "pass_rate": round(pass_rate, 1),
            "excellent_rate": round(excellent_rate, 1),
        },
        "score_distribution": score_ranges,
    }


@router.get("/exam/{exam_id}/question-analysis")
def get_question_analysis(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取题目分析数据（难度、区分度、得分率）"""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "考试不存在")

    # 获取试卷题目
    paper = db.query(Paper).filter(Paper.id == exam.paper_id).first()
    if not paper:
        return {"questions": [], "message": "试卷不存在"}

    paper_questions = db.query(PaperQuestion).filter_by(paper_id=paper.id).order_by(PaperQuestion.order).all()
    sessions = db.query(ExamSession).filter_by(exam_id=exam_id).all()
    session_ids = [s.id for s in sessions]

    question_analysis = []
    for pq in paper_questions:
        question = db.query(Question).filter(Question.id == pq.question_id).first()
        if not question:
            continue

        # 获取该题所有学生答案
        answers = db.query(StudentAnswer).filter(
            StudentAnswer.session_id.in_(session_ids),
            StudentAnswer.question_id == pq.question_id,
        ).all()

        total_answered = len(answers)
        scores = [a.final_score for a in answers if a.final_score is not None]
        correct_count = len([a for a in answers if a.is_correct])

        if total_answered > 0 and pq.score > 0:
            avg_score = sum(scores) / len(scores) if scores else 0
            score_rate = avg_score / pq.score * 100
            correct_rate = correct_count / total_answered * 100

            # 难度系数（得分率，越低越难）
            difficulty = 1 - score_rate / 100

            # 区分度（高分组27%通过率 - 低分组27%通过率）
            if len(scores) >= 10:
                sorted_scores = sorted(scores, reverse=True)
                n_27 = max(1, int(len(sorted_scores) * 0.27))
                high_group = sorted_scores[:n_27]
                low_group = sorted_scores[-n_27:]
                high_pass = len([s for s in high_group if s >= pq.score * 0.6]) / len(high_group) * 100
                low_pass = len([s for s in low_group if s >= pq.score * 0.6]) / len(low_group) * 100
                discrimination = (high_pass - low_pass) / 100
            else:
                discrimination = 0
        else:
            avg_score = score_rate = correct_rate = difficulty = discrimination = 0

        question_analysis.append({
            "question_id": pq.question_id,
            "order": pq.order,
            "question_type": question.question_type,
            "content_preview": question.content[:50] + "..." if len(question.content) > 50 else question.content,
            "full_score": pq.score,
            "total_answered": total_answered,
            "avg_score": round(avg_score, 2),
            "score_rate": round(score_rate, 1),
            "correct_rate": round(correct_rate, 1),
            "difficulty": round(difficulty, 3),
            "difficulty_label": "简单" if difficulty < 0.3 else "中等" if difficulty < 0.7 else "困难",
            "discrimination": round(discrimination, 3),
            "discrimination_label": "优秀" if discrimination >= 0.4 else "良好" if discrimination >= 0.3 else "一般" if discrimination >= 0.2 else "较差",
        })

    return {
        "exam_id": exam_id,
        "total_questions": len(question_analysis),
        "questions": question_analysis,
        "avg_difficulty": round(sum(q["difficulty"] for q in question_analysis) / len(question_analysis), 3) if question_analysis else 0,
        "avg_discrimination": round(sum(q["discrimination"] for q in question_analysis) / len(question_analysis), 3) if question_analysis else 0,
    }


@router.post("/generate")
def generate_assessment_report(
    req: ReportGenerateReq,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """生成课程考核评估报告（AI辅助分析）"""
    # 获取考试概览
    overview = get_exam_overview(req.exam_id, db, current_user)

    # 获取题目分析
    question_analysis = get_question_analysis(req.exam_id, db, current_user)

    # AI辅助分析（基于数据生成分析文字）
    ai_analysis = {}
    if req.include_ai_analysis:
        scores = overview["scores"]
        ai_analysis = {
            "overall_evaluation": generate_overall_evaluation(scores, overview["participants"]),
            "difficulty_analysis": generate_difficulty_analysis(question_analysis),
            "teaching_suggestions": generate_teaching_suggestions(question_analysis, scores),
            "improvement_points": generate_improvement_points(question_analysis),
        }

    report = {
        "report_id": f"RPT-{req.exam_id}-{int(datetime.now().timestamp())}",
        "generated_at": datetime.now().isoformat(),
        "generated_by": current_user.name,
        "report_type": req.report_type,
        "overview": overview,
        "question_analysis": question_analysis,
        "ai_analysis": ai_analysis,
    }

    return report


def generate_overall_evaluation(scores, participants):
    """生成整体评价文字"""
    parts = []
    parts.append(f"本次考试共有{participants['total']}人参加，实考{participants['submitted']}人，")
    parts.append(f"缺考{participants['absent']}人，参考率{participants['attendance_rate']}%。")

    if scores["count"] > 0:
        parts.append(f"平均分{scores['average']}分，最高分{scores['max']}分，最低分{scores['min']}分，")
        parts.append(f"标准差{scores['std_dev']}，成绩分布{'较为集中' if scores['std_dev'] < 10 else '较为分散'}。")
        parts.append(f"及格率{scores['pass_rate']}%，优秀率{scores['excellent_rate']}%。")

        if scores["average"] >= 80:
            parts.append("整体成绩优秀，学生掌握情况良好。")
        elif scores["average"] >= 70:
            parts.append("整体成绩良好，大部分学生已掌握核心知识点。")
        elif scores["average"] >= 60:
            parts.append("整体成绩中等，部分知识点需要加强教学。")
        else:
            parts.append("整体成绩偏低，建议重新审视教学方法和重点难点。")

    return "".join(parts)


def generate_difficulty_analysis(question_analysis):
    """生成难度分析文字"""
    if not question_analysis["questions"]:
        return "暂无题目分析数据。"

    questions = question_analysis["questions"]
    easy = len([q for q in questions if q["difficulty"] < 0.3])
    medium = len([q for q in questions if 0.3 <= q["difficulty"] < 0.7])
    hard = len([q for q in questions if q["difficulty"] >= 0.7])

    parts = [
        f"本次考试共{len(questions)}道题目，其中简单题{easy}道，中等题{medium}道，困难题{hard}道。",
        f"试卷整体难度系数{question_analysis['avg_difficulty']}，",
    ]

    if question_analysis["avg_difficulty"] < 0.3:
        parts.append("试卷整体偏简单。")
    elif question_analysis["avg_difficulty"] < 0.5:
        parts.append("试卷难度适中偏易。")
    elif question_analysis["avg_difficulty"] < 0.7:
        parts.append("试卷难度适中。")
    else:
        parts.append("试卷整体偏难。")

    # 找出得分率最低的题目
    low_score_questions = sorted(questions, key=lambda x: x["score_rate"])[:3]
    if low_score_questions:
        parts.append("得分率最低的三道题目：")
        for q in low_score_questions:
            parts.append(f"第{q['order']}题（{q['question_type']}）得分率{q['score_rate']}%，")

    return "".join(parts)


def generate_teaching_suggestions(question_analysis, scores):
    """生成教学建议"""
    suggestions = []

    if scores["average"] < 70:
        suggestions.append("建议加强基础知识教学，增加课堂练习和课后作业量。")

    if scores["pass_rate"] < 80:
        suggestions.append("及格率偏低，建议关注学习困难学生，开展针对性辅导。")

    # 找出区分度差的题目
    low_discrimination = [q for q in question_analysis["questions"] if q["discrimination"] < 0.2]
    if low_discrimination:
        suggestions.append(f"有{len(low_discrimination)}道题目区分度较差，建议在后续命题中改进或替换。")

    # 找出得分率低的题目对应的知识点
    low_score = [q for q in question_analysis["questions"] if q["score_rate"] < 50]
    if low_score:
        suggestions.append(f"有{len(low_score)}道题目得分率低于50%，对应知识点需要重点复习和加强教学。")

    if not suggestions:
        suggestions.append("整体教学效果良好，建议保持现有教学方法，继续关注学生个体差异。")

    return suggestions


def generate_improvement_points(question_analysis):
    """生成改进要点"""
    points = []

    # 得分率最低的题目
    sorted_questions = sorted(question_analysis["questions"], key=lambda x: x["score_rate"])
    for i, q in enumerate(sorted_questions[:5]):
        if q["score_rate"] < 70:
            points.append({
                "priority": "高" if q["score_rate"] < 50 else "中",
                "question_order": q["order"],
                "question_type": q["question_type"],
                "score_rate": q["score_rate"],
                "suggestion": f"第{q['order']}题得分率仅{q['score_rate']}%，建议加强该知识点教学并增加练习。",
            })

    return points


from datetime import datetime
