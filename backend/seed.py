"""鼎盛智考系统 - 种子数据初始化
创建：用户 / 课程 / 课程目标 / 知识图谱 / 能力维度 / 题库 / 试卷 / 考试 /
      演示会话（已评阅+能力画像）/ 监考事件与证据链 / 扫描阅卷批次
幂等：可重复执行，已有数据则跳过
"""
import random
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import init_db, SessionLocal
from app import models as M
from app.services.knowledge_service import ensure_dimensions, generate_capability_snapshot
from app.services.assessment_service import run_auto_grading
from app.services.proctor_service import ProctorFusion

random.seed(2026)

# ---------------- 用户 ----------------
USERS = [
    dict(username="admin", password="admin123", name="系统管理员", role="admin", college="信息中心"),
    dict(username="teacher", password="teacher123", name="王慧敏", role="teacher", college="外国语学院", major="英语"),
    dict(username="proctor", password="proctor123", name="监考中心", role="proctor", college="教务处"),
]
STUDENTS = [
    ("stu01", "陈思远", "2023010101", "外国语学院", "英语"),
    ("stu02", "李沐晴", "2023010102", "外国语学院", "英语"),
    ("stu03", "张浩然", "2023010201", "外国语学院", "翻译"),
    ("stu04", "刘雨桐", "2023010202", "外国语学院", "翻译"),
    ("stu05", "王梓涵", "2023020101", "马克思主义学院", "思想政治教育"),
    ("stu06", "赵子墨", "2023020102", "马克思主义学院", "思想政治教育"),
    ("stu07", "孙一诺", "2023030101", "计算机学院", "计算机科学"),
    ("stu08", "周若曦", "2023030102", "计算机学院", "计算机科学"),
    ("stu09", "吴承宇", "2023010103", "外国语学院", "英语"),
    ("stu10", "郑诗涵", "2023010203", "外国语学院", "翻译"),
    ("stu11", "林晓峰", "2023020103", "马克思主义学院", "思想政治教育"),
    ("stu12", "沈嘉懿", "2023030103", "计算机学院", "计算机科学"),
]
# 每个学生的能力系数（决定演示作答正确率）
ABILITY = {"stu01": 0.92, "stu02": 0.88, "stu03": 0.78, "stu04": 0.85, "stu05": 0.90,
           "stu06": 0.72, "stu07": 0.82, "stu08": 0.65, "stu09": 0.75, "stu10": 0.55,
           "stu11": 0.68, "stu12": 0.80}


def build(db):
    # ---------------- 用户 ----------------
    uid_map = {}
    for u in USERS:
        if not db.query(M.User).filter_by(username=u["username"]).first():
            obj = M.User(**{k: v for k, v in u.items() if k != "password"})
            obj.set_password(u["password"])
            db.add(obj)
            db.flush()
            uid_map[u["username"]] = obj.id
    for uname, name, sno, college, major in STUDENTS:
        if not db.query(M.User).filter_by(username=uname).first():
            obj = M.User(username=uname, name=name, role="student", student_no=sno,
                         college=college, major=major, grade="2023级")
            obj.set_password("123456")
            db.add(obj)
            db.flush()
            uid_map[uname] = obj.id
    db.flush()
    # 为已有用户补全 uid_map
    for u in db.query(M.User).all():
        uid_map.setdefault(u.username, u.id)
    teacher_id = uid_map["teacher"]
    admin_id = uid_map["admin"]

    # ---------------- 课程 ----------------
    courses = {}
    for code, name, credit, desc in [
        ("EN101", "大学英语（二）", 4.0, "大学英语综合课程，覆盖听说读写译全技能与跨文化素养"),
        ("POL101", "思想道德与法治", 3.0, "思政核心课程：马克思主义基本原理、近现代史纲要、思想道德与法治"),
        ("MATH101", "高等数学（上）", 5.0, "微积分与线性代数基础"),
    ]:
        c = db.query(M.Course).filter_by(code=code).first()
        if not c:
            c = M.Course(code=code, name=name, credit=credit, teacher_id=teacher_id, description=desc)
            db.add(c)
            db.flush()
        courses[code] = c

    en, pol, math = courses["EN101"], courses["POL101"], courses["MATH101"]

    # ---------------- 课程目标 ----------------
    def add_obj(course, code, name, weight):
        if not db.query(M.CourseObjective).filter_by(course_id=course.id, code=code).first():
            db.add(M.CourseObjective(course_id=course.id, code=code, name=name, weight=weight))

    add_obj(en, "CLO1", "掌握英语语言知识与技能", 0.5)
    add_obj(en, "CLO2", "具备跨文化交际能力", 0.2)
    add_obj(en, "CLO3", "形成自主学习与批判性思维", 0.3)
    add_obj(pol, "CLO1", "理解马克思主义基本原理", 0.4)
    add_obj(pol, "CLO2", "树立正确的世界观人生观价值观", 0.3)
    add_obj(pol, "CLO3", "增强法治意识与道德判断能力", 0.3)
    add_obj(math, "CLO1", "掌握微积分基本概念与计算", 0.6)
    add_obj(math, "CLO2", "具备应用数学建模解决实际问题的能力", 0.4)

    # ---------------- 知识图谱 ----------------
    def add_kp(course, code, name, level, parent=None, objective_code=None):
        q = db.query(M.KnowledgePoint).filter_by(course_id=course.id, code=code).first()
        if q:
            return q
        obj = None
        if objective_code:
            obj = db.query(M.CourseObjective).filter_by(course_id=course.id, code=objective_code).first()
        kp = M.KnowledgePoint(course_id=course.id, code=code, name=name, level=level,
                              parent_id=parent.id if parent else None,
                              objective_id=obj.id if obj else None)
        db.add(kp)
        db.flush()
        return kp

    # 大学英语知识图谱
    en_kp = {}
    en_kp["lang"] = add_kp(en, "EN01", "语言知识", 1, objective_code="CLO1")
    en_kp["voc"] = add_kp(en, "EN0101", "词汇", 2, en_kp["lang"])
    en_kp["voc_core"] = add_kp(en, "EN010101", "核心词汇", 3, en_kp["voc"])
    en_kp["voc_phrase"] = add_kp(en, "EN010102", "词组搭配", 3, en_kp["voc"])
    en_kp["gra"] = add_kp(en, "EN0102", "语法", 2, en_kp["lang"])
    en_kp["gra_tense"] = add_kp(en, "EN010201", "时态语态", 3, en_kp["gra"])
    en_kp["gra_clause"] = add_kp(en, "EN010202", "从句", 3, en_kp["gra"])
    en_kp["skill"] = add_kp(en, "EN02", "语言技能", 1, objective_code="CLO1")
    en_kp["read"] = add_kp(en, "EN0201", "阅读理解", 2, en_kp["skill"])
    en_kp["read_main"] = add_kp(en, "EN020101", "主旨推断", 3, en_kp["read"])
    en_kp["read_detail"] = add_kp(en, "EN020102", "细节定位", 3, en_kp["read"])
    en_kp["write"] = add_kp(en, "EN0202", "写作", 2, en_kp["skill"])
    en_kp["write_argu"] = add_kp(en, "EN020201", "议论文写作", 3, en_kp["write"])
    en_kp["write_app"] = add_kp(en, "EN020202", "应用文写作", 3, en_kp["write"])
    en_kp["trans"] = add_kp(en, "EN0203", "翻译", 2, en_kp["skill"])
    en_kp["trans_e2c"] = add_kp(en, "EN020301", "英译汉", 3, en_kp["trans"])
    en_kp["trans_c2e"] = add_kp(en, "EN020302", "汉译英", 3, en_kp["trans"])
    en_kp["oral"] = add_kp(en, "EN0204", "口语", 2, en_kp["skill"])
    en_kp["oral_daily"] = add_kp(en, "EN020401", "日常表达", 3, en_kp["oral"])
    en_kp["oral_topic"] = add_kp(en, "EN020402", "主题陈述", 3, en_kp["oral"])
    en_kp["culture"] = add_kp(en, "EN03", "跨文化素养", 1, objective_code="CLO2")
    en_kp["culture_diff"] = add_kp(en, "EN0301", "中西文化差异", 2, en_kp["culture"])

    # 思政知识图谱
    pol_kp = {}
    pol_kp["ml"] = add_kp(pol, "P01", "马克思主义基本原理", 1, objective_code="CLO1")
    pol_kp["material"] = add_kp(pol, "P0101", "唯物论", 2, pol_kp["ml"])
    pol_kp["matter"] = add_kp(pol, "P010101", "物质与意识", 3, pol_kp["material"])
    pol_kp["dialect"] = add_kp(pol, "P0102", "辩证法", 2, pol_kp["ml"])
    pol_kp["contradict"] = add_kp(pol, "P010201", "对立统一", 3, pol_kp["dialect"])
    pol_kp["quality"] = add_kp(pol, "P010202", "量变质变", 3, pol_kp["dialect"])
    pol_kp["epistem"] = add_kp(pol, "P0103", "认识论", 2, pol_kp["ml"])
    pol_kp["practice"] = add_kp(pol, "P010301", "实践与认识", 3, pol_kp["epistem"])
    pol_kp["history"] = add_kp(pol, "P02", "中国近现代史纲要", 1, objective_code="CLO2")
    pol_kp["modern"] = add_kp(pol, "P0201", "近代史", 2, pol_kp["history"])
    pol_kp["opium"] = add_kp(pol, "P020101", "鸦片战争", 3, pol_kp["modern"])
    pol_kp["party"] = add_kp(pol, "P0202", "中共党史", 2, pol_kp["history"])
    pol_kp["revolution"] = add_kp(pol, "P020201", "新民主主义革命", 3, pol_kp["party"])
    pol_kp["moral"] = add_kp(pol, "P03", "思想道德与法治", 1, objective_code="CLO3")
    pol_kp["values"] = add_kp(pol, "P0301", "道德观", 2, pol_kp["moral"])
    pol_kp["core_values"] = add_kp(pol, "P030101", "核心价值观", 3, pol_kp["values"])
    pol_kp["rule"] = add_kp(pol, "P0302", "法治观", 2, pol_kp["moral"])
    pol_kp["constitution"] = add_kp(pol, "P030201", "宪法常识", 3, pol_kp["rule"])

    # 数学知识图谱
    math_kp = {}
    math_kp["calc"] = add_kp(math, "M01", "一元微积分", 1, objective_code="CLO1")
    math_kp["limit"] = add_kp(math, "M0101", "极限与连续", 2, math_kp["calc"])
    math_kp["limit_calc"] = add_kp(math, "M010101", "极限计算", 3, math_kp["limit"])
    math_kp["deriv"] = add_kp(math, "M0102", "导数与微分", 2, math_kp["calc"])
    math_kp["deriv_calc"] = add_kp(math, "M010201", "导数计算", 3, math_kp["deriv"])
    math_kp["integral"] = add_kp(math, "M0103", "积分", 2, math_kp["calc"])
    math_kp["integral_calc"] = add_kp(math, "M010301", "不定积分", 3, math_kp["integral"])
    math_kp["model"] = add_kp(math, "M02", "应用与建模", 1, objective_code="CLO2")
    math_kp["opt"] = add_kp(math, "M0201", "最优化应用", 2, math_kp["model"])

    # 知识关系（前置/关联）
    def add_rel(s, t, rtype, strength=0.8):
        if not db.query(M.KnowledgeRelation).filter_by(source_id=s.id, target_id=t.id, relation_type=rtype).first():
            db.add(M.KnowledgeRelation(source_id=s.id, target_id=t.id, relation_type=rtype, strength=strength))

    add_rel(en_kp["voc"], en_kp["gra"], "prerequisite")
    add_rel(en_kp["gra"], en_kp["read"], "prerequisite")
    add_rel(en_kp["read"], en_kp["write"], "prerequisite")
    add_rel(en_kp["voc_phrase"], en_kp["trans"], "related", 0.7)
    add_rel(en_kp["read_detail"], en_kp["read_main"], "related", 0.6)
    add_rel(pol_kp["material"], pol_kp["dialect"], "prerequisite")
    add_rel(pol_kp["dialect"], pol_kp["epistem"], "prerequisite")
    add_rel(pol_kp["opium"], pol_kp["revolution"], "prerequisite")
    add_rel(pol_kp["values"], pol_kp["rule"], "related", 0.7)
    add_rel(math_kp["limit"], math_kp["deriv"], "prerequisite")
    add_rel(math_kp["deriv"], math_kp["integral"], "prerequisite")
    add_rel(math_kp["integral"], math_kp["opt"], "related", 0.6)

    db.commit()
    return {"uid_map": uid_map, "courses": courses, "en_kp": en_kp, "pol_kp": pol_kp,
            "math_kp": math_kp, "teacher_id": teacher_id, "admin_id": admin_id}


# ---------------- 题库 ----------------
def build_questions(db, ctx):
    en, pol, math = ctx["courses"]["EN101"], ctx["courses"]["POL101"], ctx["courses"]["MATH101"]
    kp = {**ctx["en_kp"], **ctx["pol_kp"], **ctx["math_kp"]}
    D = {}  # dim code -> id
    for d in db.query(M.CapabilityDimension).all():
        D[d.code] = d.id
    teacher_id = ctx["teacher_id"]

    def q(course, qtype, stem, answer, options=None, kps=None, dims=None, difficulty=3.0,
          analysis="", rubric=None, subject=""):
        kps = kps or []
        dims = dims or []
        existing = db.query(M.Question).filter_by(stem=stem[:80]).first()
        if existing:
            return existing
        obj = M.Question(course_id=course.id, type=qtype, subject=subject or course.name,
                         stem=stem, options=options, answer=answer, analysis=analysis,
                         scoring_rubric=rubric, difficulty=difficulty, created_by=teacher_id)
        db.add(obj)
        db.flush()
        for c in kps:
            db.add(M.QuestionKP(question_id=obj.id, kp_id=c.id))
        for code in dims:
            if code in D:
                db.add(M.QuestionDim(question_id=obj.id, dim_id=D[code]))
        return obj

    # ============ 大学英语 ============
    q(en, "single_choice", "The word “diligent” is closest in meaning to ______.",
      "A", [{"key": "A", "text": "hardworking"}, {"key": "B", "text": "lazy"}, {"key": "C", "text": "careless"}, {"key": "D", "text": "proud"}],
      [kp["voc_core"]], ["COG_MEM", "ENG_VOC"], 2, "diligent 意为‘勤奋的’，与 hardworking 同义。")
    q(en, "single_choice", "Which of the following is a synonym of “significant”?",
      "C", [{"key": "A", "text": "minor"}, {"key": "B", "text": "slight"}, {"key": "C", "text": "important"}, {"key": "D", "text": "trivial"}],
      [kp["voc_core"]], ["COG_MEM", "ENG_VOC"], 2)
    q(en, "single_choice", "“Break down” in the sentence “The negotiation broke down” means ______.",
      "B", [{"key": "A", "text": "started"}, {"key": "B", "text": "failed"}, {"key": "C", "text": "succeeded"}, {"key": "D", "text": "continued"}],
      [kp["voc_phrase"]], ["COG_UND", "ENG_VOC"], 3)
    q(en, "single_choice", "By the time we arrived, the film ______ for ten minutes.",
      "B", [{"key": "A", "text": "has started"}, {"key": "B", "text": "had been on"}, {"key": "C", "text": "was starting"}, {"key": "D", "text": "starts"}],
      [kp["gra_tense"]], ["ENG_GRA", "COG_APP"], 3)
    q(en, "single_choice", "The book ______ cover is red belongs to Mary.",
      "A", [{"key": "A", "text": "whose"}, {"key": "B", "text": "which"}, {"key": "C", "text": "that"}, {"key": "D", "text": "what"}],
      [kp["gra_clause"]], ["ENG_GRA"], 3)
    q(en, "single_choice", "According to the passage, the main idea is that ______.",
      "C", [{"key": "A", "text": "technology harms society"}, {"key": "B", "text": "people fear change"}, {"key": "C", "text": "technology improves daily life"}, {"key": "D", "text": "internet is dangerous"}],
      [kp["read_main"]], ["ENG_READ", "COG_ANA"], 3)
    q(en, "single_choice", "In paragraph 2, the author mentions “statistics” mainly to ______.",
      "B", [{"key": "A", "text": "show off"}, {"key": "B", "text": "support his argument"}, {"key": "C", "text": "confuse readers"}, {"key": "D", "text": "change the topic"}],
      [kp["read_detail"]], ["ENG_READ", "HIGH_INFER"], 3)
    q(en, "multiple_choice", "Which of the following are benefits of regular exercise? (Select all that apply)",
      "ABD", [{"key": "A", "text": "Improves heart health"}, {"key": "B", "text": "Reduces stress"}, {"key": "C", "text": "Increases weight"}, {"key": "D", "text": "Boosts mood"}],
      [kp["read_detail"]], ["ENG_READ", "COG_UND"], 3)
    q(en, "judge", "The passive voice is formed with “be + past participle”. (T/F)",
      "T", None, [kp["gra_tense"]], ["ENG_GRA", "COG_MEM"], 2)
    q(en, "judge", "“Although” and “but” can be used together in the same sentence. (T/F)",
      "F", None, [kp["gra_clause"]], ["ENG_GRA", "COG_EVA"], 3)
    q(en, "fill", "The plural form of “phenomenon” is ______.",
      "phenomena", None, [kp["voc_core"]], ["COG_MEM", "ENG_VOC"], 2)
    q(en, "fill", "Complete: She is good ______ playing the piano.",
      "at", None, [kp["voc_phrase"]], ["ENG_VOC", "COG_APP"], 2)
    q(en, "translation", "Translate into Chinese: “Practice makes perfect.”",
      "熟能生巧。", None, [kp["trans_e2c"]], ["ENG_TRANS", "COG_APP"], 3,
      rubric={"keywords": ["熟能生巧", "练习", "完美"]})
    q(en, "translation", "Translate into English: “阅读是获取知识的重要途径。”",
      "Reading is an important way to acquire knowledge.",
      None, [kp["trans_c2e"]], ["ENG_TRANS", "COG_APP"], 3,
      rubric={"keywords": ["reading", "knowledge", "important", "acquire"]})
    q(en, "essay", "Write an English essay (150 words) on the topic: “The Importance of Lifelong Learning”. State your viewpoint and give reasons.",
      "Lifelong learning is essential in modern society...",
      None, [kp["write_argu"]], ["ENG_WRITE", "ENG_COHER", "ENG_ARGU", "COG_CRE", "GEN_CRIT", "COG_EVA"], 4,
      rubric={"keywords": ["learning", "knowledge", "society", "skill", "adapt", "progress"]})
    q(en, "essay", "Write an English application letter to apply for an internship position. Include your major, skills and motivation.",
      "Dear Sir or Madam, I am writing to apply for...",
      None, [kp["write_app"]], ["ENG_WRITE", "ENG_APPR", "ENG_COHER", "GEN_EXPR"], 4,
      rubric={"keywords": ["apply", "internship", "major", "skill", "motivation", "thank"]})
    q(en, "oral", "Please introduce yourself and your study plan for this semester in English (about 1 minute).",
      "My name is ... I plan to improve my English by practicing speaking every day...",
      None, [kp["oral_topic"]], ["ENG_SPEAK", "ENG_COHER", "GEN_EXPR", "COG_UND"], 4,
      rubric={"keywords": ["study", "english", "practice", "plan", "improve", "speaking"]})

    # ============ 思政 ============
    q(pol, "single_choice", "马克思主义认为，世界的本原是（　）",
      "B", [{"key": "A", "text": "精神"}, {"key": "B", "text": "物质"}, {"key": "C", "text": "理念"}, {"key": "D", "text": "上帝"}],
      [kp["matter"]], ["POL_MEM", "COG_MEM"], 2)
    q(pol, "single_choice", "“矛盾的两个方面既对立又统一”体现的哲学原理是（　）",
      "A", [{"key": "A", "text": "对立统一规律"}, {"key": "B", "text": "质量互变规律"}, {"key": "C", "text": "否定之否定"}, {"key": "D", "text": "价值规律"}],
      [kp["contradict"]], ["POL_UND", "COG_UND"], 3)
    q(pol, "single_choice", "量变是质变的必要准备，质变是量变的必然结果，这属于（　）",
      "C", [{"key": "A", "text": "对立统一规律"}, {"key": "B", "text": "联系的观点"}, {"key": "C", "text": "质量互变规律"}, {"key": "D", "text": "发展的观点"}],
      [kp["quality"]], ["POL_UND", "COG_UND"], 3)
    q(pol, "single_choice", "实践是认识的（　）",
      "D", [{"key": "A", "text": "唯一目的"}, {"key": "B", "text": "唯一来源"}, {"key": "C", "text": "唯一归宿"}, {"key": "D", "text": "基础与来源"}],
      [kp["practice"]], ["POL_UND", "COG_UND"], 3)
    q(pol, "single_choice", "第一次鸦片战争后，中国被迫签订的不平等条约是（　）",
      "A", [{"key": "A", "text": "《南京条约》"}, {"key": "B", "text": "《马关条约》"}, {"key": "C", "text": "《辛丑条约》"}, {"key": "D", "text": "《北京条约》"}],
      [kp["opium"]], ["POL_HIST", "COG_MEM"], 3)
    q(pol, "single_choice", "新民主主义革命的开端是（　）",
      "C", [{"key": "A", "text": "辛亥革命"}, {"key": "B", "text": "戊戌变法"}, {"key": "C", "text": "五四运动"}, {"key": "D", "text": "南昌起义"}],
      [kp["revolution"]], ["POL_HIST", "COG_UND"], 3)
    q(pol, "single_choice", "社会主义核心价值观中，国家层面的价值目标是（　）",
      "B", [{"key": "A", "text": "自由、平等、公正、法治"}, {"key": "B", "text": "富强、民主、文明、和谐"}, {"key": "C", "text": "爱国、敬业、诚信、友善"}, {"key": "D", "text": "改革、开放、创新、协调"}],
      [kp["core_values"]], ["POL_VALUE", "COG_MEM"], 2)
    q(pol, "single_choice", "我国现行宪法规定，中华人民共和国是工人阶级领导的、以工农联盟为基础的（　）",
      "A", [{"key": "A", "text": "人民民主专政的社会主义国家"}, {"key": "B", "text": "资本主义国家"}, {"key": "C", "text": "联邦制国家"}, {"key": "D", "text": "君主立宪制国家"}],
      [kp["constitution"]], ["POL_ETHIC", "COG_MEM"], 3)
    q(pol, "multiple_choice", "下列属于社会主义核心价值观个人层面内容的有（　）",
      "CD", [{"key": "A", "text": "富强"}, {"key": "B", "text": "民主"}, {"key": "C", "text": "诚信"}, {"key": "D", "text": "友善"}],
      [kp["core_values"]], ["POL_VALUE", "COG_MEM"], 2)
    q(pol, "judge", "意识是人脑的机能，是对客观世界的反映。（T/F）",
      "T", None, [kp["matter"]], ["POL_UND", "COG_MEM"], 2)
    q(pol, "judge", "矛盾是事物发展的唯一动力，没有其他力量。（T/F）",
      "F", None, [kp["contradict"]], ["POL_UND", "COG_EVA"], 3)
    q(pol, "fill", "坚持依法治国首先要坚持依宪治国，坚持依法执政首先要坚持______执政。",
      "依宪", None, [kp["constitution"]], ["POL_ETHIC", "COG_MEM"], 3)
    q(pol, "fill", "中国共产党人的初心和使命是为中国人民谋幸福，为中华民族谋______。",
      "复兴", None, [kp["revolution"]], ["POL_VALUE", "COG_MEM"], 3)
    q(pol, "subjective", "结合所学，运用“实践与认识的关系”原理，分析大学生为什么要积极参加社会实践。（要求：论点明确，不少于 200 字）",
      "实践是认识的来源、动力和检验真理的唯一标准...",
      None, [kp["practice"]], ["POL_APP", "POL_ARGU", "POL_VALUE", "COG_ANA", "GEN_PROB"], 4,
      rubric={"keywords": ["实践", "认识", "来源", "检验", "真理", "社会", "能力"]})
    q(pol, "subjective", "请从社会主义核心价值观角度，谈谈当代大学生应如何践行“诚信”。（不少于 200 字）",
      "诚信是社会主义核心价值观个人层面的重要内容...",
      None, [kp["core_values"]], ["POL_VALUE", "POL_ARGU", "POL_ETHIC", "GEN_CRIT"], 4,
      rubric={"keywords": ["诚信", "价值观", "践行", "考试", "学术", "道德", "责任"]})

    # ============ 高等数学 ============
    q(math, "single_choice", "lim(x→0) sinx/x =（　）",
      "B", [{"key": "A", "text": "0"}, {"key": "B", "text": "1"}, {"key": "C", "text": "2"}, {"key": "D", "text": "不存在"}],
      [kp["limit_calc"]], ["MAT_CALC", "COG_MEM"], 2)
    q(math, "single_choice", "函数 f(x)=x² 在 x=1 处的导数为（　）",
      "C", [{"key": "A", "text": "0"}, {"key": "B", "text": "1"}, {"key": "C", "text": "2"}, {"key": "D", "text": "3"}],
      [kp["deriv_calc"]], ["MAT_CALC", "COG_APP"], 2)
    q(math, "single_choice", "∫2x dx =（　）",
      "A", [{"key": "A", "text": "x²+C"}, {"key": "B", "text": "2x²+C"}, {"key": "C", "text": "x+C"}, {"key": "D", "text": "x²"}],
      [kp["integral_calc"]], ["MAT_CALC", "COG_APP"], 2)
    q(math, "judge", "可导函数必连续。（T/F）",
      "T", None, [kp["deriv"]], ["MAT_LOGIC", "COG_UND"], 3)
    q(math, "fill", "函数 y=x³ 的极小值点位于 x=______（若没有填“无”）。",
      "无", None, [kp["opt"]], ["MAT_ALG", "COG_APP"], 4)
    q(math, "subjective", "用导数求解：某工厂生产 x 件产品的成本为 C(x)=x²-20x+120（百元），求使平均成本最小的产量。",
      "平均成本 AC=C/x=x-20+120/x，令 d(AC)/dx=1-120/x²=0 得 x=√120≈10.95，故取 x≈11 件时平均成本最小。",
      None, [kp["opt"]], ["MAT_ALG", "MAT_DATA", "GEN_PROB", "COG_APP"], 4,
      rubric={"keywords": ["平均成本", "导数", "求导", "最小", "AC"]})

    db.commit()
    return db.query(M.Question).count()


# ---------------- 试卷 + 考试 ----------------
def build_exam(db, ctx):
    en = ctx["courses"]["EN101"]
    paper = db.query(M.Paper).filter_by(title="大学英语（二）期末综合测评").first()
    if not paper:
        from app.services.paper_service import assemble_paper
        paper = assemble_paper(db, en.id, "大学英语（二）期末综合测评", target_difficulty=3.0,
                               total_score=100,
                               type_distribution={
                                   "single_choice": 8, "multiple_choice": 1, "judge": 2,
                                   "fill": 2, "translation": 2, "essay": 2, "oral": 1,
                               })
    exam = db.query(M.Exam).filter_by(title="大学英语（二）2026 春季期末").first()
    if not exam:
        exam = M.Exam(course_id=en.id, paper_id=paper.id, title="大学英语（二）2026 春季期末",
                      exam_type="online",
                      start_time=datetime.now() - timedelta(days=7),
                      end_time=datetime.now() + timedelta(days=7),
                      duration_minutes=90, status="published",
                      proctor_config={"face": True, "behavior": True, "voice": True,
                                      "liveness": True, "screen_switch": True},
                      created_by=ctx["teacher_id"])
        db.add(exam)
        db.commit()
        db.refresh(exam)
    # 所有学生加入考试
    for u in db.query(M.User).filter(M.User.role == "student").all():
        if not db.query(M.ExamParticipant).filter_by(exam_id=exam.id, user_id=u.id).first():
            db.add(M.ExamParticipant(exam_id=exam.id, user_id=u.id))
    db.commit()
    return paper, exam


# ---------------- 演示会话（已评阅 + 画像） ----------------
def build_demo_sessions(db, ctx, paper, exam):
    teacher_id = ctx["teacher_id"]
    pqs = db.query(M.PaperQuestion).filter_by(paper_id=paper.id).order_by(M.PaperQuestion.order_index).all()
    for uname, ability in ABILITY.items():
        u = db.query(M.User).filter_by(username=uname).first()
        if not u:
            continue
        existing = db.query(M.ExamSession).filter_by(exam_id=exam.id, user_id=u.id).first()
        if existing:
            continue
        # 部分学生模拟考场异常（其中 2 名标记作弊）
        flagged = uname in ("stu06", "stu10")
        session = M.ExamSession(exam_id=exam.id, user_id=u.id, status="graded",
                                start_time=datetime.now() - timedelta(days=3),
                                submit_time=datetime.now() - timedelta(days=3, hours=1),
                                risk_level="high" if flagged else "low",
                                is_flagged=flagged, cheat_confidence=0.86 if flagged else 0.0)
        db.add(session)
        db.flush()
        rng = random.Random(u.id * 17)
        for pq in pqs:
            q = db.query(M.Question).get(pq.question_id)
            correct = rng.random() < ability
            if q.type in ("single_choice", "multiple_choice", "judge", "fill"):
                if correct:
                    ans = q.answer
                else:
                    if q.options:
                        wrong = [o["key"] for o in q.options if o["key"] != q.answer]
                        ans = rng.choice(wrong) if wrong else "X"
                    else:
                        ans = "错误答案占位" if not correct else q.answer
            elif q.type == "oral":
                transcript = ("My name is a student. I plan to practice speaking English every day and "
                              "improve my study plan this semester." if correct else "yes no")
                ans = transcript
            elif q.type in ("essay", "translation", "subjective"):
                kw = (q.scoring_rubric or {}).get("keywords") or []
                hit = [k for k in kw if rng.random() < ability]
                # 用英文/中文模板生成作答
                is_en = q.type in ("essay", "translation") and any(ord(c) < 128 for c in "".join(kw)[:1])
                if correct:
                    if is_en:
                        ans = ("In my opinion, " + ", ".join(hit or kw[:3]) +
                               " play an important role in our life. We should keep learning and "
                               "make progress step by step. Therefore, I believe it is significant for everyone. " * 3)
                    else:
                        ans = ("我认为，".join(["", ""]) + "。".join(hit or kw[:3]) +
                               "是当前需要重点关注的问题。通过学习与实践，我们能够不断提升自身能力，"
                               "形成正确的认识并指导行动。综上所述，我们要坚持理论联系实际，"
                               "在实践中检验和发展认识，努力成为德智体美劳全面发展的时代新人。" * 2)
                else:
                    ans = "不太清楚，简单写一点。" if not is_en else "I think it is good."
            else:
                ans = "作答占位"
            db.add(M.StudentAnswer(session_id=session.id, question_id=q.id, answer=ans,
                                   time_used_sec=rng.randint(40, 300)))
        db.flush()
        try:
            run_auto_grading(db, session, generate_portrait=True)
        except Exception as e:
            print("grading fail", uname, e)
            db.rollback()

    # 对标记作弊的会话注入监考事件 + 证据链
    for uname in ("stu06", "stu10"):
        u = db.query(M.User).filter_by(username=uname).first()
        session = db.query(M.ExamSession).filter_by(exam_id=exam.id, user_id=u.id).first()
        if not session:
            continue
        if db.query(M.ProctorEvent).filter_by(session_id=session.id).count() > 0:
            continue
        fusion = ProctorFusion(session.id)
        events = [("screen_switch", 0.9), ("multi_face", 0.85), ("face_mismatch", 0.92), ("liveness_fail", 0.95)]
        for et, conf in events:
            r = fusion.ingest({"event_type": et, "confidence": conf})
            pe = M.ProctorEvent(session_id=session.id, event_type=et, confidence=conf,
                                severity=r["severity"], detail={"desc": "演示注入"},
                                source="fusion")
            db.add(pe)
            db.flush()
            ev = fusion.evidence[-1]
            db.add(M.EvidenceChain(session_id=session.id, event_id=pe.id,
                                   chain_index=ev["event_id"] - 1,
                                   prev_hash=ev["payload"]["prev_hash"], cur_hash=ev["hash"],
                                   payload=ev["payload"], verified=True))
        session.risk_level = "high"
        session.is_flagged = True
        session.cheat_confidence = fusion.decision_confidence
    db.commit()


# ---------------- 扫描阅卷演示 ----------------
def build_scan_demo(db, ctx):
    en = ctx["courses"]["EN101"]
    exam = db.query(M.Exam).filter_by(title="大学英语（二）2026 春季期末").first()
    batch = db.query(M.ScanBatch).filter_by(title="2026 春季大学英语扫描阅卷批次").first()
    if not batch:
        batch = M.ScanBatch(exam_id=exam.id if exam else en.id,
                            title="2026 春季大学英语扫描阅卷批次", status="grading_done")
        db.add(batch)
        db.flush()
        from app.services.paper_service import paper_detail
        pd = paper_detail(db, exam.paper_id) if exam else {"questions": []}
        from app.services import grading_service as gs
        from app import models as M2
        for i, (name, sno) in enumerate([("陈思远", "2023010101"), ("李沐晴", "2023010102"),
                                          ("张浩然", "2023010201"), ("刘雨桐", "2023010202"),
                                          ("王梓涵", "2023020101"), ("周若曦", "2023030102"),
                                          ("孙一诺", "2023030101"), ("吴承宇", "2023010103")]):
            total = 0.0
            detail = []
            for item in pd.get("questions", []):
                q = db.query(M2.Question).get(item["question_id"])
                rng = random.Random(i * 31)
                if q.type in ("single_choice", "multiple_choice", "judge", "fill"):
                    if rng.random() < 0.7 + 0.2 * (i % 3) / 2:
                        score, fb = item["score"], "答案正确"
                    else:
                        score, fb = 0, "答案错误"
                else:
                    r = gs.grade_subjective("学生扫描作答内容较为完整，涵盖要点。",
                                            {"answer": q.answer or "", "scoring_rubric": q.scoring_rubric or {}},
                                            item["score"])
                    score, fb = r["score"], "扫描识别自动评分"
                total += score
                detail.append({"question_id": q.id, "type": q.type, "score": score, "feedback": fb})
            db.add(M2.ScanPaper(batch_id=batch.id, student_no=sno, student_name=name,
                                ocr_status="done", grading_status="graded",
                                total_score=round(total, 1), grading_detail=detail))
        batch.total_papers = 8
    db.commit()


def main():
    init_db()
    db = SessionLocal()
    ensure_dimensions(db)
    db.commit()
    ctx = build(db)
    qcount = build_questions(db, ctx)
    paper, exam = build_exam(db, ctx)
    build_demo_sessions(db, ctx, paper, exam)
    build_scan_demo(db, ctx)
    print("seed done. questions:", qcount)
    db.close()


if __name__ == "__main__":
    main()
