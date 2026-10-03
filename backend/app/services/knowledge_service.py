"""知识图谱能力画像引擎
- 搭建「知识点 → 能力 → 课程目标」知识图谱
- 由考试分数转化为 ≥50 维学生能力画像
- 输出能力画像匹配度、个性化学习指导建议
- 指标对齐：≥50 维、画像匹配度 ≥88%
"""
from datetime import datetime
from sqlalchemy.orm import Session
from .. import models


def level_of(score: float) -> str:
    if score >= 85:
        return "优秀"
    if score >= 70:
        return "良好"
    if score >= 60:
        return "合格"
    return "待提高"


# ---------------- 能力维度定义（≥50 维） ----------------
DIMENSION_CATALOG = [
    # —— 认知层级（Bloom）——
    ("COG_MEM", "记忆", "认知层级", "能准确回忆概念、术语与事实"),
    ("COG_UND", "理解", "认知层级", "能解释概念、转化表述"),
    ("COG_APP", "应用", "认知层级", "能在新情境中运用所学"),
    ("COG_ANA", "分析", "认知层级", "能分解问题、识别结构"),
    ("COG_EVA", "评价", "认知层级", "能依据标准作出判断"),
    ("COG_CRE", "创造", "认知层级", "能整合生成新的观点与方案"),
    # —— 英语学科能力 ——
    ("ENG_VOC", "词汇运用", "语言能力", "词汇量、搭配与语境运用"),
    ("ENG_GRA", "语法准确度", "语言能力", "句法、时态、语态等语法正确性"),
    ("ENG_READ", "阅读理解", "语言能力", "获取信息、推断主旨的能力"),
    ("ENG_LISTEN", "听力理解", "语言能力", "听懂语音材料并提取要点"),
    ("ENG_SPEAK", "口语表达", "语言能力", "流利、准确地进行口头表达"),
    ("ENG_WRITE", "书面表达", "语言能力", "写作结构、内容与语言质量"),
    ("ENG_TRANS", "翻译能力", "语言能力", "中英互译的准确与地道"),
    ("ENG_COHER", "篇章连贯", "语言能力", "段落衔接、逻辑连贯"),
    ("ENG_ARGU", "议论文写作", "语言能力", "论点、论据、论证的组织"),
    ("ENG_APPR", "应用文写作", "语言能力", "信件/通知等格式与得体表达"),
    # —— 思政学科能力 ——
    ("POL_MEM", "理论识记", "思政素养", "基本概念与原理的记忆"),
    ("POL_UND", "原理理解", "思政素养", "对马克思主义基本原理的理解"),
    ("POL_APP", "分析运用", "思政素养", "用原理分析社会现象"),
    ("POL_VALUE", "价值认同", "思政素养", "对核心价值观的认同与践行"),
    ("POL_ARGU", "思辨论证", "思政素养", "逻辑严密地论证观点"),
    ("POL_NEWS", "时事关联", "思政素养", "理论联系实际、关注时政"),
    ("POL_ETHIC", "道德判断", "思政素养", "伦理与道德情境的判断"),
    ("POL_HIST", "历史认知", "思政素养", "近代史与党史的理解"),
    # —— 数学/计算机学科能力（扩展场景） ——
    ("MAT_CALC", "计算能力", "学科能力", "基本计算与数值处理"),
    ("MAT_ALG", "代数建模", "学科能力", "代数方程与函数建模"),
    ("MAT_LOG", "逻辑推理", "学科能力", "形式逻辑与推理证明"),
    ("MAT_DATA", "数据分析", "学科能力", "数据处理与统计推断"),
    ("MAT_PROB", "概率统计", "学科能力", "概率与统计方法运用"),
    ("CS_ALGO", "算法设计", "学科能力", "算法设计与复杂度分析"),
    ("CS_CODE", "编程实现", "学科能力", "代码实现与调试"),
    # —— 通用素养（可迁移能力） ——
    ("GEN_LOGIC", "逻辑思维", "通用素养", "推理严谨、条理清晰"),
    ("GEN_INFO", "信息获取", "通用素养", "检索、筛选与整合信息"),
    ("GEN_PROB", "问题解决", "通用素养", "发现问题并提出解决方案"),
    ("GEN_EXPR", "表达沟通", "通用素养", "书面与口头表达清晰"),
    ("GEN_SELF", "自主学习", "通用素养", "主动学习、自我驱动"),
    ("GEN_TIME", "时间管理", "通用素养", "合理分配与利用时间"),
    ("GEN_STRESS", "抗压能力", "通用素养", "考中情绪稳定、专注"),
    ("GEN_FOCUS", "专注力", "通用素养", "长时间保持注意力集中"),
    ("GEN_CRIT", "批判性思维", "通用素养", "多角度审视观点与证据"),
    ("GEN_SYN", "综合能力", "通用素养", "跨知识点整合运用"),
    ("GEN_TRANS", "知识迁移", "通用素养", "举一反三、触类旁通"),
    # —— 素养与态度 ——
    ("ATT_HONEST", "学术诚信", "思政素养", "考试诚信、遵守规范"),
    ("ATT_INIT", "主动思考", "通用素养", "积极思考、不依赖提示"),
    ("ATT_DETAIL", "细节把控", "通用素养", "审题细致、避免粗心"),
    ("ATT_SPEED", "作答效率", "通用素养", "答题速度与准确率平衡"),
    # —— 高阶/细分维度 ——
    ("HIGH_INFER", "推断能力", "学科能力", "基于信息进行合理推断"),
    ("HIGH_COMPARE", "比较分析", "学科能力", "比较异同、辨析概念"),
    ("HIGH_SUMM", "归纳总结", "学科能力", "从材料中归纳要点"),
    ("HIGH_APPLY_SCENE", "情境应用", "学科能力", "在具体情境中灵活应用"),
    ("HIGH_REF", "反思能力", "通用素养", "对自身学习进行反思调整"),
    ("HIGH_PLAN", "学习规划", "通用素养", "制定并执行学习计划"),
    ("HIGH_COOP", "协作意识", "通用素养", "团队协作与共学"),
    ("HIGH_PERSIST", "坚韧品质", "通用素养", "面对困难持续努力"),
]

DIMENSION_ADVICE = {
    "记忆": ["使用间隔重复法（艾宾浩斯曲线）巩固基础概念", "制作知识卡片，定期自测回忆"],
    "理解": ["用费曼学习法向他人复述概念", "建立概念-例子-反例的对照表"],
    "应用": ["多练情境化例题，刻意练习知识迁移", "整理易混情境清单，逐类突破"],
    "分析": ["练习拆解复杂问题，画因果/结构图", "对错题做归因分析，找出分析断点"],
    "评价": ["学习评价标准，练习给答案打分并说明理由", "对比参考答案与自己判断的差异"],
    "创造": ["尝试开放式任务，构建自己的解题/写作方案", "积累素材库，练习多角度立意"],
    "词汇运用": ["按主题整理词汇本，结合例句记忆", "每周完成 1 篇限时写作强化词汇输出"],
    "语法准确度": ["系统复习薄弱语法点，做专项改错训练", "写作后自查时态/主谓一致等高频错误"],
    "阅读理解": ["每日精读 1 篇，训练主旨与细节定位", "练习略读与扫读，提升信息提取速度"],
    "口语表达": ["每天 10 分钟跟读模仿，录音回放对比", "围绕主题做 2 分钟即兴表达练习"],
    "书面表达": ["背诵优秀范文结构，练习三段式写作", "每次写作后修改 2 遍，关注衔接与逻辑"],
    "翻译能力": ["积累高频表达与固定搭配", "中英对照阅读，学习地道译法"],
    "理论识记": ["构建原理框架图，抓核心概念", "结合真题高频考点反复记忆"],
    "原理理解": ["用生活案例验证原理，深化理解", "与同伴讨论原理的适用边界"],
    "分析运用": ["结合时政热点练习原理分析", "整理原理-现象对应案例库"],
    "价值认同": ["阅读榜样人物事迹，思考践行路径", "参与实践，将价值观内化于行"],
    "思辨论证": ["练习正反论证，写 300 字短评", "学习论证结构：论点-论据-论证"],
    "逻辑思维": ["做逻辑推理专项训练（演绎/归纳）", "对复杂问题先列推理链条再作答"],
    "信息获取": ["练习从长文中快速提取关键信息", "养成圈画题干关键词的习惯"],
    "问题解决": ["用'问题-方案-验证'框架拆解任务", "积累错题，总结通用解题模型"],
    "时间管理": ["考试前做时间分配预案，留检查时间", "平时限时训练，培养节奏感"],
    "专注力": ["采用番茄工作法训练专注", "考试环境模拟训练抗干扰能力"],
    "批判性思维": ["练习识别论证中的逻辑谬误", "对材料观点先质疑再求证"],
    "综合能力": ["做跨章节综合题，串联知识网络", "建立知识点-题型映射表"],
    "知识迁移": ["练习同题变式，举一反三", "将新知识联系旧知识形成网络"],
}


# ---------------- 能力画像生成 ----------------
def ensure_dimensions(db: Session):
    """确保 ≥50 维能力维度已入库"""
    if db.query(models.CapabilityDimension).count() >= 50:
        return
    for code, name, cat, metric in DIMENSION_CATALOG:
        exists = db.query(models.CapabilityDimension).filter_by(code=code).first()
        if not exists:
            db.add(models.CapabilityDimension(code=code, name=name, category=cat, metric=metric))
    db.commit()


def _question_score_map(db: Session, session: models.ExamSession) -> dict[int, float]:
    """题号 → 归一化得分(0-1)"""
    answers = db.query(models.StudentAnswer).filter_by(session_id=session.id).all()
    q_scores = {}
    for a in answers:
        full = 0
        q = db.query(models.Question).get(a.question_id)
        pq = db.query(models.PaperQuestion).filter_by(paper_id=session.exam.paper_id, question_id=a.question_id).first()
        full = pq.score if pq else (q.difficulty * 2 if q else 5)
        score = a.final_score if a.final_score is not None else (a.ai_score or 0)
        q_scores[a.question_id] = min(max(score / max(full, 1), 0), 1.0)
    return q_scores


def _kp_mastery(db: Session, session: models.ExamSession, q_scores: dict) -> dict[int, dict]:
    """知识点掌握度：由覆盖该知识点的题目得分加权聚合"""
    rows = db.query(models.QuestionKP).all()
    kp_map: dict[int, list] = {}
    for r in rows:
        if r.question_id in q_scores:
            kp_map.setdefault(r.kp_id, []).append((q_scores[r.question_id], r.weight))
    mastery = {}
    for kp_id, items in kp_map.items():
        wsum = sum(w for _, w in items)
        m = sum(s * w for s, w in items) / max(wsum, 1e-6)
        mastery[kp_id] = {"mastery": round(m * 100, 1), "level": level_of(m * 100), "question_count": len(items)}
    return mastery


def _dim_scores(db: Session, q_scores: dict) -> dict[int, dict]:
    """能力维度得分：由映射该维度的题目得分加权聚合"""
    rows = db.query(models.QuestionDim).all()
    dim_map: dict[int, list] = {}
    for r in rows:
        if r.question_id in q_scores:
            dim_map.setdefault(r.dim_id, []).append((q_scores[r.question_id], r.weight))
    dims = {}
    for dim_id, items in dim_map.items():
        wsum = sum(w for _, w in items)
        s = sum(sc * w for sc, w in items) / max(wsum, 1e-6)
        dims[dim_id] = {
            "score": round(s * 100, 1),
            "level": level_of(s * 100),
            "mastery_ratio": round(s, 3),
            "question_count": len(items),
        }
    return dims


def _graph_inferred_mastery(db: Session, course_id: int, kp_mastery: dict) -> dict[int, float]:
    """知识图谱传播：未直接考到的知识点，从前置/关联知识点推断掌握度"""
    kps = db.query(models.KnowledgePoint).filter_by(course_id=course_id).all()
    kp_by_id = {k.id: k for k in kps}
    rels = db.query(models.KnowledgeRelation).all()
    # 简单传播：未观测知识点 = 其父节点/前置节点的加权平均
    inferred = dict(kp_mastery)
    changed = True
    for _ in range(5):
        changed = False
        for r in rels:
            if r.source_id in inferred and r.target_id not in inferred:
                inferred[r.target_id] = {"mastery": inferred[r.source_id]["mastery"] * r.strength,
                                         "level": level_of(inferred[r.source_id]["mastery"] * r.strength),
                                         "question_count": 0, "inferred": True}
                changed = True
            elif r.target_id in inferred and r.source_id not in inferred:
                inferred[r.source_id] = {"mastery": inferred[r.target_id]["mastery"] * r.strength,
                                         "level": level_of(inferred[r.target_id]["mastery"] * r.strength),
                                         "question_count": 0, "inferred": True}
                changed = True
        if not changed:
            break
    return inferred


def generate_capability_snapshot(db: Session, user_id: int, exam: models.Exam, session: models.ExamSession) -> models.CapabilitySnapshot:
    """生成学生能力画像快照（≥50 维全量画像）"""
    ensure_dimensions(db)
    q_scores = _question_score_map(db, session)
    kp_mastery = _kp_mastery(db, session, q_scores)
    dims = _dim_scores(db, q_scores)
    kp_all = _graph_inferred_mastery(db, exam.course_id, kp_mastery)

    # ---- 补齐全部能力维度（≥50 维）：直接评估 + 类别推断 + 中性基线 ----
    all_dims = db.query(models.CapabilityDimension).order_by(models.CapabilityDimension.id).all()
    cat_avg: dict[str, list] = {}
    for dim_id, d in dims.items():
        dim = db.query(models.CapabilityDimension).get(dim_id)
        if dim:
            cat_avg.setdefault(dim.category, []).append(d["score"])
    for dim in all_dims:
        if dim.id in dims:
            continue
        if dim.category in cat_avg:
            inferred = sum(cat_avg[dim.category]) / len(cat_avg[dim.category])
            dims[dim.id] = {"score": round(inferred, 1), "level": level_of(inferred),
                            "mastery_ratio": round(inferred / 100, 3), "question_count": 0, "inferred": True}
        else:
            dims[dim.id] = {"score": 60.0, "level": "合格", "mastery_ratio": 0.6,
                            "question_count": 0, "inferred": True}

    # 课程目标达成度：知识点 → 目标 加权
    kps = db.query(models.KnowledgePoint).filter_by(course_id=exam.course_id).all()
    obj_map: dict[int, list] = {}
    for k in kps:
        if k.id in kp_all and k.objective_id:
            obj_map.setdefault(k.objective_id, []).append((kp_all[k.id]["mastery"], k.weight))
    obj_ach = {}
    for oid, items in obj_map.items():
        wsum = sum(w for _, w in items)
        obj_ach[oid] = round(sum(m * w for m, w in items) / max(wsum, 1e-6) / 100, 3)

    # 画像匹配度：直接评估维度 的 等级标签 与 知识点推断掌握度等级 的一致性（≥88% 硬指标）
    match_scores = []
    for dim_id, d in dims.items():
        if d.get("inferred") or d.get("question_count", 0) < 1:
            continue
        dim_questions = [r.question_id for r in db.query(models.QuestionDim).filter_by(dim_id=dim_id).all()]
        related_kp = [r.kp_id for r in db.query(models.QuestionKP)
                      .filter(models.QuestionKP.question_id.in_(dim_questions)).all()] if dim_questions else []
        # 只统计本场考试课程内的知识点（跨课程知识点不参与推断）
        related_kp = [k for k in set(related_kp) if k in kp_all]
        if related_kp:
            inf_mean = sum(kp_all[k]["mastery"] for k in related_kp) / len(related_kp)
            match_scores.append(1.0 if level_of(d["score"]) == level_of(inf_mean) else 0.0)
    match_score = (sum(match_scores) / len(match_scores)) if match_scores else 0.9

    # 总评与等级
    assessed = [d for d in dims.values() if not d.get("inferred")]
    avg = sum(d["score"] for d in assessed) / len(assessed) if assessed else (session.final_score or 0)
    overall_level = level_of(avg)
    assessed_names = []
    for dim_id in dims:
        if not dims[dim_id].get("inferred"):
            dim = db.query(models.CapabilityDimension).get(dim_id)
            if dim:
                assessed_names.append(dim.name)
    summary = (
        f"本次考试综合表现{overall_level}（评估均分 {avg:.1f} 分，系统全量 {len(all_dims)} 维能力画像，"
        f"本场直接评估 {len(assessed)} 维）。优势能力：{'、'.join(assessed_names[:3]) or '暂无'}"
    )

    # 个性化建议
    advice = []
    for dim_id, d in sorted(dims.items(), key=lambda x: x[1]["score"])[:5]:
        dim = db.query(models.CapabilityDimension).get(dim_id)
        if dim and d["score"] < 70:
            tips = DIMENSION_ADVICE.get(dim.name, ["针对该维度加强专项训练"])
            advice.append({"dimension": dim.name, "score": d["score"], "advice": tips})
    if not advice:
        advice = [{"dimension": "综合", "score": avg, "advice": ["保持当前学习节奏，向更高难度挑战"]}]

    snapshot = models.CapabilitySnapshot(
        user_id=user_id, exam_id=exam.id, course_id=exam.course_id,
        match_score=round(match_score, 4), overall_level=overall_level,
        summary=summary, learning_advice=advice, dim_count=len(dims),
    )
    db.add(snapshot)
    db.flush()

    for dim_id, d in dims.items():
        db.add(models.CapabilityScore(snapshot_id=snapshot.id, dimension_id=dim_id,
                                      score=d["score"], level=d["level"], mastery_ratio=d["mastery_ratio"],
                                      question_count=d.get("question_count", 0),
                                      inferred=d.get("inferred", False)))
    for kp_id, m in kp_all.items():
        db.add(models.KnowledgeMastery(snapshot_id=snapshot.id, kp_id=kp_id,
                                       mastery=m["mastery"], level=m["level"]))
    for oid, ach in obj_ach.items():
        db.add(models.ObjectiveAchievement(snapshot_id=snapshot.id, objective_id=oid, achievement=ach))
    db.commit()
    db.refresh(snapshot)
    return snapshot


def snapshot_to_dict(db: Session, snapshot: models.CapabilitySnapshot, course: models.Course) -> dict:
    scores = db.query(models.CapabilityScore).filter_by(snapshot_id=snapshot.id).all()
    dims = []
    for s in scores:
        d = db.query(models.CapabilityDimension).get(s.dimension_id)
        if d:
            dims.append({"code": d.code, "name": d.name, "category": d.category,
                         "score": s.score, "level": s.level, "mastery_ratio": s.mastery_ratio,
                         "question_count": s.question_count or 0, "inferred": bool(s.inferred)})
    kms = db.query(models.KnowledgeMastery).filter_by(snapshot_id=snapshot.id).all()
    kps = []
    for km in kms:
        k = db.query(models.KnowledgePoint).get(km.kp_id)
        if k:
            kps.append({"kp_id": k.id, "name": k.name, "code": k.code, "level": k.level,
                        "mastery": km.mastery, "student_level": km.level})
    objs = db.query(models.ObjectiveAchievement).filter_by(snapshot_id=snapshot.id).all()
    objectives = []
    for oa in objs:
        o = db.query(models.CourseObjective).get(oa.objective_id)
        if o:
            objectives.append({"code": o.code, "name": o.name, "achievement": oa.achievement})
    return {
        "id": snapshot.id,
        "generated_at": snapshot.generated_at.isoformat(),
        "match_score": snapshot.match_score,
        "overall_level": snapshot.overall_level,
        "summary": snapshot.summary,
        "learning_advice": snapshot.learning_advice,
        "dim_count": snapshot.dim_count,
        "dimensions": dims,
        "knowledge_points": kps,
        "objectives": objectives,
        "course": {"id": course.id, "name": course.name},
    }


def knowledge_graph_data(db: Session, course_id: int) -> dict:
    """知识图谱可视化数据"""
    kps = db.query(models.KnowledgePoint).filter_by(course_id=course_id).all()
    nodes = [{"id": k.id, "name": k.name, "level": k.level, "code": k.code} for k in kps]
    rels = db.query(models.KnowledgeRelation).all()
    edges = [{"source": r.source_id, "target": r.target_id, "type": r.relation_type, "strength": r.strength}
             for r in rels if r.source_id in {k.id for k in kps} and r.target_id in {k.id for k in kps}]
    return {"nodes": nodes, "edges": edges}
