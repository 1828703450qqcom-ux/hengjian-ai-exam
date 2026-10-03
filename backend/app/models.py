"""智衡云枢系统 - 数据模型
覆盖：用户/课程/知识图谱/能力维度/题库/组卷/考试/作答/评阅/监考/能力画像
"""
import hashlib
import json
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, JSON, Index,
)
from sqlalchemy.orm import relationship
from .database import Base


def _hash_password(password: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), b"ds-exam-salt", 100_000).hex()


# ---------------- 用户与组织 ----------------
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    name = Column(String(64), nullable=False)
    role = Column(String(16), nullable=False, default="student")  # admin/teacher/student/proctor
    student_no = Column(String(32), index=True)
    email = Column(String(128))
    college = Column(String(128))       # 学院
    major = Column(String(128))         # 专业
    grade = Column(String(16))          # 年级
    face_descriptor = Column(JSON)      # 注册人脸特征向量（多模态身份底库）
    face_photo_url = Column(String(256))  # 证件照（身份核验底库）
    voiceprint_id = Column(String(64))  # 声纹标识
    status = Column(String(16), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    def set_password(self, pw):
        self.password_hash = _hash_password(pw)

    def check_password(self, pw):
        return self.password_hash == _hash_password(pw)

    def to_dict(self, with_face=False):
        d = {
            "id": self.id, "username": self.username, "name": self.name,
            "role": self.role, "student_no": self.student_no, "email": self.email,
            "college": self.college, "major": self.major, "grade": self.grade,
            "status": self.status, "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if with_face and self.face_descriptor:
            d["face_registered"] = True
        return d


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True)
    code = Column(String(32), unique=True)
    name = Column(String(128), nullable=False)
    credit = Column(Float, default=3.0)
    teacher_id = Column(Integer, ForeignKey("users.id"))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class CourseTeacher(Base):
    """课程教师关联（支持多教师、多角色、权限控制）"""
    __tablename__ = "course_teachers"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), index=True)
    role = Column(String(32), default="teacher")  # 主讲教师/助教/题库管理员/阅卷教师
    can_edit_questions = Column(Boolean, default=True)   # 是否可编辑题库
    can_assemble_paper = Column(Boolean, default=True)   # 是否可组卷
    can_grade = Column(Boolean, default=False)            # 是否可阅卷
    can_view_analytics = Column(Boolean, default=True)    # 是否可查看分析
    joined_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_course_teacher", "course_id", "teacher_id", unique=True),
    )


class CourseObjective(Base):
    """课程目标（OBE 成果导向）"""
    __tablename__ = "course_objectives"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    code = Column(String(32))          # 如 CLO1
    name = Column(String(128))
    weight = Column(Float, default=1.0)
    description = Column(Text)


class KnowledgePoint(Base):
    """知识点（知识图谱节点，树形结构）"""
    __tablename__ = "knowledge_points"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), index=True)
    code = Column(String(32))
    name = Column(String(128), nullable=False)
    level = Column(Integer, default=1)       # 层级：1 章 / 2 节 / 3 知识点
    parent_id = Column(Integer, ForeignKey("knowledge_points.id"))
    objective_id = Column(Integer, ForeignKey("course_objectives.id"))  # 关联课程目标
    weight = Column(Float, default=1.0)


class KnowledgeRelation(Base):
    """知识图谱边：前置 / 包含 / 关联"""
    __tablename__ = "knowledge_relations"
    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, ForeignKey("knowledge_points.id"), index=True)
    target_id = Column(Integer, ForeignKey("knowledge_points.id"))
    relation_type = Column(String(16))   # prerequisite / contains / related
    strength = Column(Float, default=0.5)


class CapabilityDimension(Base):
    """能力维度（≥50 维能力画像的维度定义，含量化硬指标）"""
    __tablename__ = "capability_dimensions"
    id = Column(Integer, primary_key=True)
    code = Column(String(32), unique=True)
    name = Column(String(64), nullable=False)
    category = Column(String(32))        # 认知层级 / 学科能力 / 通用素养 / 语言能力 / 思政素养
    description = Column(Text)
    metric = Column(String(128))         # 量化指标定义


# ---------------- 题库 ----------------
class QuestionSource(Base):
    """题库外部数据源注册表。"""
    __tablename__ = "question_sources"
    id = Column(Integer, primary_key=True)
    key = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(64), nullable=False)
    category = Column(String(32), default="综合题库")
    base_url = Column(String(256))
    description = Column(String(256))
    enabled = Column(Boolean, default=True)
    status = Column(String(16), default="ready")
    question_count = Column(Integer, default=0)
    last_sync_at = Column(DateTime)
    config = Column(JSON, default=dict)


class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), index=True)
    type = Column(String(32), nullable=False)  # single_choice/multiple_choice/judge/fill/subjective/essay/translation/oral
    subject = Column(String(32))          # 英语/思政/数学/...
    stem = Column(Text, nullable=False)
    options = Column(JSON)                # [{key, text}]
    answer = Column(Text)                 # 客观题标准答案；主观题参考要点
    analysis = Column(Text)               # 解析 / 评分要点
    scoring_rubric = Column(JSON)         # 主观题评分维度
    difficulty = Column(Float, default=3.0)  # 1-5
    discrimination = Column(Float, default=0.5)  # 区分度
    source = Column(String(16), default="online")  # online 在线 / scan 扫描
    tags = Column(JSON)
    status = Column(String(16), default="active")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class QuestionKP(Base):
    """题目→知识点 映射（带权重）"""
    __tablename__ = "question_kp"
    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    kp_id = Column(Integer, ForeignKey("knowledge_points.id"))
    weight = Column(Float, default=1.0)


class QuestionDim(Base):
    """题目→能力维度 映射（带权重）"""
    __tablename__ = "question_dim"
    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    dim_id = Column(Integer, ForeignKey("capability_dimensions.id"))
    weight = Column(Float, default=1.0)


# ---------------- 组卷 ----------------
class Paper(Base):
    __tablename__ = "papers"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    title = Column(String(128), nullable=False)
    total_score = Column(Float, default=100.0)
    difficulty = Column(Float, default=3.0)
    status = Column(String(16), default="draft")  # draft/published
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class PaperQuestion(Base):
    __tablename__ = "paper_questions"
    id = Column(Integer, primary_key=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    order_index = Column(Integer, default=0)
    score = Column(Float, default=5.0)


# ---------------- 考试 ----------------
class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    paper_id = Column(Integer, ForeignKey("papers.id"))
    title = Column(String(128), nullable=False)
    exam_type = Column(String(16), default="online")  # online 在线 / paper 纸笔 / scan 扫描
    exam_level = Column(String(16), default="class")  # class 班级考试 / school 校级考试
    semester = Column(String(32))  # 学期
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_minutes = Column(Integer, default=90)
    status = Column(String(16), default="draft")  # draft/published/ongoing/finished
    proctor_config = Column(JSON)   # {face:true, behavior:true, voice:true, liveness:true, screen_switch:true, video_channels:3}
    exam_rules = Column(JSON)  # 考试规则：{late_limit_min, submit_limit_min, question_display, auto_submit}
    grading_config = Column(JSON)  # 阅卷规则：{grading_start_time, grading_mode, double_grading, error_threshold, graders}
    result_config = Column(JSON)  # 成绩发布：{publish_time, show_answer, show_ranking}
    integrity_pledge = Column(Text)  # 考试承诺书内容
    is_template = Column(Boolean, default=False)  # 是否为考试模板
    template_name = Column(String(64))  # 模板名称
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    paper = relationship("Paper")


class ExamParticipant(Base):
    __tablename__ = "exam_participants"
    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String(16), default="pending")  # pending/attended/absent
    checked_in = Column(Boolean, default=False)       # 是否已完成考前签到
    checkin_time = Column(DateTime)                    # 签到时间
    device_check = Column(JSON)                         # 设备检测结果
    checkin_data = Column(JSON)                         # 签到采集数据（身份信息等）


class ExamSession(Base):
    """考生一次考试会话"""
    __tablename__ = "exam_sessions"
    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    submit_time = Column(DateTime)
    status = Column(String(16), default="in_progress")  # in_progress/submitted/grading/graded/flagged
    ai_score = Column(Float)
    teacher_score = Column(Float)
    final_score = Column(Float)
    agreement_rate = Column(Float)     # AI 与教师判分一致性
    risk_level = Column(String(16), default="low")  # low/medium/high/critical（监考风险）
    is_flagged = Column(Boolean, default=False)     # 是否判定疑似作弊
    cheat_confidence = Column(Float, default=0.0)
    extra_time_sec = Column(Integer, default=0)
    extended_time_minutes = Column(Integer, default=0)  # 延时考试时间（分钟）
    restored = Column(Boolean, default=False)  # 是否恢复考试
    restore_count = Column(Integer, default=0)  # 恢复次数
    integrity_signed = Column(Boolean, default=False)  # 是否签署诚信承诺书
    device_checked = Column(Boolean, default=False)  # 是否完成设备检测
    face_verified = Column(Boolean, default=False)  # 是否完成人脸核验
    exam = relationship("Exam")
    user = relationship("User")


class StudentAnswer(Base):
    __tablename__ = "student_answers"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    answer = Column(Text)               # 客观题：选项；主观题：文本/JSON
    ai_score = Column(Float)
    ai_feedback = Column(Text)
    teacher_score = Column(Float)
    teacher_feedback = Column(Text)
    final_score = Column(Float)
    is_correct = Column(Boolean)
    grading_status = Column(String(16), default="pending")  # pending/auto_graded/teacher_graded/conflict
    time_used_sec = Column(Integer, default=0)
    graded_at = Column(DateTime)
    audio_transcript = Column(Text)     # 口语转写文本
    audio_url = Column(String(256))
    audio_duration = Column(Float)


# ---------------- 双评与仲裁、阅卷质量监控 ----------------
class GradingRecord(Base):
    """阅卷记录（支持双评：每位教师独立评分）"""
    __tablename__ = "grading_records"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    answer_id = Column(Integer, ForeignKey("student_answers.id"), index=True)
    grader_id = Column(Integer, ForeignKey("users.id"), index=True)  # 阅卷教师
    score = Column(Float)  # 评分
    feedback = Column(Text)  # 评语
    grading_round = Column(Integer, default=1)  # 评阅轮次：1初评/2复评/3仲裁
    is_ai = Column(Boolean, default=False)  # 是否AI评阅
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GradeArbitration(Base):
    """仲裁记录（双评分差超阈值时自动提交仲裁）"""
    __tablename__ = "grade_arbitrations"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    answer_id = Column(Integer, ForeignKey("student_answers.id"), index=True)
    first_grader_id = Column(Integer, ForeignKey("users.id"))  # 第一评阅教师
    second_grader_id = Column(Integer, ForeignKey("users.id"))  # 第二评阅教师
    first_score = Column(Float)  # 第一评分
    second_score = Column(Float)  # 第二评分
    score_diff = Column(Float)  # 分差
    threshold = Column(Float)  # 误差阈值
    arbitrator_id = Column(Integer, ForeignKey("users.id"))  # 仲裁教师
    final_score = Column(Float)  # 仲裁最终成绩
    arbitration_feedback = Column(Text)  # 仲裁意见
    status = Column(String(16), default="pending")  # pending/resolved
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)


class GradingQualityLog(Base):
    """阅卷质量监控日志（组长抽样查看、打回重评）"""
    __tablename__ = "grading_quality_logs"
    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), index=True)
    grader_id = Column(Integer, ForeignKey("users.id"), index=True)  # 被检查的阅卷教师
    checker_id = Column(Integer, ForeignKey("users.id"))  # 检查的组长
    answer_id = Column(Integer, ForeignKey("student_answers.id"))
    action = Column(String(16))  # sample抽样/reject打回/approve通过
    original_score = Column(Float)
    suggested_score = Column(Float)
    reason = Column(Text)  # 打回原因
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------- 多模态监考 ----------------
class ProctorEvent(Base):
    __tablename__ = "proctor_events"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), index=True)
    event_type = Column(String(32), index=True)
    # face_mismatch 人脸不匹配 / liveness_fail 活体失败 / multi_face 多人 / face_out 离开画面
    # screen_switch 切屏 / audio_anomaly 声音异常 / head_pose 头部异常 / device 设备异常
    timestamp = Column(DateTime, default=datetime.utcnow)
    confidence = Column(Float, default=0.0)
    severity = Column(String(16), default="low")  # low/medium/high/critical
    detail = Column(JSON)
    snapshot_url = Column(String(256))  # 证据截图/视频帧
    source = Column(String(16), default="client")  # client 前端采集 / fusion 中台融合
    ack = Column(Boolean, default=False)


class EvidenceChain(Base):
    """可追溯证据链（哈希链）"""
    __tablename__ = "evidence_chain"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), index=True)
    event_id = Column(Integer, ForeignKey("proctor_events.id"))
    chain_index = Column(Integer, default=0)
    prev_hash = Column(String(128))
    cur_hash = Column(String(128))
    payload = Column(JSON)               # 哈希原文（用于可追溯校验）
    verified = Column(Boolean, default=False)


# ---------------- 能力画像 ----------------
class CapabilitySnapshot(Base):
    __tablename__ = "capability_snapshots"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    generated_at = Column(DateTime, default=datetime.utcnow)
    match_score = Column(Float)          # 画像匹配度
    overall_level = Column(String(16))   # 优秀/良好/合格/待提高
    summary = Column(Text)
    learning_advice = Column(JSON)       # 个性化学习建议列表
    dim_count = Column(Integer, default=0)


class CapabilityScore(Base):
    __tablename__ = "capability_scores"
    id = Column(Integer, primary_key=True)
    snapshot_id = Column(Integer, ForeignKey("capability_snapshots.id"), index=True)
    dimension_id = Column(Integer, ForeignKey("capability_dimensions.id"))
    score = Column(Float)                # 0-100
    level = Column(String(16))
    mastery_ratio = Column(Float)        # 掌握率
    question_count = Column(Integer, default=0)  # 直接评估题目数
    inferred = Column(Boolean, default=False)    # 是否由知识图谱推断


class CapabilityEvidence(Base):
    """能力画像证据明细，用于记录画像分数的来源与可信度。"""
    __tablename__ = "capability_evidence"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    snapshot_id = Column(Integer, ForeignKey("capability_snapshots.id"), index=True)
    dimension_id = Column(Integer, ForeignKey("capability_dimensions.id"), index=True)
    source_type = Column(String(32), default="exam")
    source_ref = Column(String(128))
    evidence_value = Column(Float)
    reliability = Column(Float, default=0.85)
    occurred_at = Column(DateTime, default=datetime.utcnow)


class KnowledgeMastery(Base):
    __tablename__ = "knowledge_mastery"
    id = Column(Integer, primary_key=True)
    snapshot_id = Column(Integer, ForeignKey("capability_snapshots.id"), index=True)
    kp_id = Column(Integer, ForeignKey("knowledge_points.id"))
    mastery = Column(Float)              # 0-100
    level = Column(String(16))


# ---------------- 课程标签管理体系 ----------------
class CourseTag(Base):
    """课程标签体系（知识点/章节/难度/自定义标签，支持5级树形结构）
    对应考试大纲管理，便于题库分类管理和查询、组卷
    """
    __tablename__ = "course_tags"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), index=True)
    tag_type = Column(String(16), index=True)  # knowledge(知识点)/chapter(章节)/difficulty(难度)/custom(自定义)
    name = Column(String(128), nullable=False)  # 标签名称
    code = Column(String(64))  # 标签编码
    level = Column(Integer, default=1)  # 层级：1-5级
    parent_id = Column(Integer, ForeignKey("course_tags.id"))  # 父标签ID
    difficulty_value = Column(Float)  # 难度值（仅难度标签使用，0-1，越大越难）
    description = Column(Text)  # 标签描述
    sort_order = Column(Integer, default=0)  # 排序
    created_by = Column(Integer, ForeignKey("users.id"))  # 创建人
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_course_tag_type", "course_id", "tag_type"),
    )


# ---------------- 印刷管理系统 ----------------
class PrintFactory(Base):
    """印厂管理"""
    __tablename__ = "print_factories"
    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)  # 印厂名称
    manager_id = Column(Integer, ForeignKey("users.id"))  # 印刷管理员
    reviewer_id = Column(Integer, ForeignKey("users.id"))  # 审核员
    contact_phone = Column(String(32))  # 联系电话
    address = Column(String(256))  # 地址
    support_binding = Column(Boolean, default=True)  # 是否支持装订
    support_packaging = Column(Boolean, default=True)  # 是否支持分装
    paper_types = Column(JSON, default=list)  # 支持的纸张类型
    status = Column(String(16), default="active")  # active/disabled
    created_at = Column(DateTime, default=datetime.utcnow)


class PrintTask(Base):
    """印刷任务"""
    __tablename__ = "print_tasks"
    id = Column(Integer, primary_key=True)
    task_no = Column(String(32), unique=True, index=True)  # 任务编号
    title = Column(String(256), nullable=False)  # 任务标题
    exam_id = Column(Integer, ForeignKey("exams.id"))  # 关联考试
    course_id = Column(Integer, ForeignKey("courses.id"))  # 关联课程
    factory_id = Column(Integer, ForeignKey("print_factories.id"))  # 印厂
    creator_id = Column(Integer, ForeignKey("users.id"))  # 创建人
    paper_count = Column(Integer, default=0)  # 试卷份数
    answer_sheet_count = Column(Integer, default=0)  # 答题卡份数
    paper_type = Column(String(32), default="A3")  # 试卷纸张类型
    answer_sheet_type = Column(String(32), default="A3")  # 答题卡纸张类型
    binding_requirement = Column(Text)  # 装订要求
    packaging_requirement = Column(Text)  # 分装要求
    deadline = Column(DateTime)  # 截止日期
    contact_phone = Column(String(32))  # 效果确认电话
    status = Column(String(32), default="draft")  # draft/pending_review/reviewing/rejected/accepted/printing/completed/picking_up/completed
    confidentiality_enabled = Column(Boolean, default=True)  # 保密性设置（审核过程是否允许预览）
    paper_file_url = Column(String(256))  # 试卷文件
    answer_sheet_file_url = Column(String(256))  # 答题卡文件
    attachment_url = Column(String(256))  # 附件
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PrintReview(Base):
    """印刷审核记录"""
    __tablename__ = "print_reviews"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("print_tasks.id"), index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    review_result = Column(String(16))  # approved/rejected
    review_comment = Column(Text)  # 审核意见
    reviewed_at = Column(DateTime, default=datetime.utcnow)


class PrintRecord(Base):
    """印刷进度记录"""
    __tablename__ = "print_records"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("print_tasks.id"), index=True)
    action = Column(String(32))  # accepted/start_printing/complete_printing/start_picking/complete_picking
    operator_id = Column(Integer, ForeignKey("users.id"))
    paper_sheets_used = Column(Integer, default=0)  # 试卷用纸数
    answer_sheet_sheets_used = Column(Integer, default=0)  # 答题卡用纸数
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class PrintPickup(Base):
    """领取记录"""
    __tablename__ = "print_pickups"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("print_tasks.id"), index=True)
    picker_name = Column(String(64))  # 领取人姓名
    picker_dept = Column(String(128))  # 领取部门
    paper_count = Column(Integer, default=0)  # 领取试卷数
    answer_sheet_count = Column(Integer, default=0)  # 领取答题卡数
    picked_at = Column(DateTime, default=datetime.utcnow)
    operator_id = Column(Integer, ForeignKey("users.id"))


class ObjectiveAchievement(Base):
    __tablename__ = "objective_achievement"
    id = Column(Integer, primary_key=True)
    snapshot_id = Column(Integer, ForeignKey("capability_snapshots.id"), index=True)
    objective_id = Column(Integer, ForeignKey("course_objectives.id"))
    achievement = Column(Float)          # 达成度 0-1


# ---------------- 口语测评 & 扫描阅卷 ----------------
class OralAssessment(Base):
    __tablename__ = "oral_assessments"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    transcript = Column(Text)
    fluency_score = Column(Float)        # 流利度
    pronunciation_score = Column(Float)  # 发音准确度
    content_score = Column(Float)        # 内容完整性
    total_score = Column(Float)
    audio_duration = Column(Float)
    detail = Column(JSON)


class ScanBatch(Base):
    __tablename__ = "scan_batches"
    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey("exams.id"))
    title = Column(String(128))
    total_papers = Column(Integer, default=0)
    status = Column(String(16), default="processing")  # processing/ocr_done/grading_done
    created_at = Column(DateTime, default=datetime.utcnow)


class ScanPaper(Base):
    __tablename__ = "scan_papers"
    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("scan_batches.id"), index=True)
    student_no = Column(String(32))
    student_name = Column(String(64))
    scan_url = Column(String(256))
    ocr_status = Column(String(16), default="pending")
    grading_status = Column(String(16), default="pending")
    total_score = Column(Float)
    grading_detail = Column(JSON)


# ---------------- 系统指标 / 审计日志 ----------------
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(64))
    target = Column(String(128))
    detail = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class KpiRecord(Base):
    """关键指标实时记录（弹性中台监控）"""
    __tablename__ = "kpi_records"
    id = Column(Integer, primary_key=True)
    metric = Column(String(64), index=True)
    value = Column(Float)
    unit = Column(String(32))
    recorded_at = Column(DateTime, default=datetime.utcnow)
