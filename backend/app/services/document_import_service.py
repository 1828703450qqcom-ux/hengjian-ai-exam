"""试卷文档导入解析服务
支持 Word(.docx) / PDF(.pdf) / 纯文本(.txt) 试卷解析
自动识别题型、题干、选项、答案、解析，返回可预览的题目列表
"""
import re
import io
from typing import Optional


# ============ 文档文本提取 ============

def extract_text_from_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    lines = []
    for para in doc.paragraphs:
        t = para.text.strip()
        if t:
            lines.append(t)
    # 表格中的题目
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                t = cell.text.strip()
                if t and t not in lines:
                    lines.append(t)
    return "\n".join(lines)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def extract_text(file_bytes: bytes, filename: str) -> str:
    fn = filename.lower()
    if fn.endswith(".docx"):
        return extract_text_from_docx(file_bytes)
    if fn.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    # txt / md 等纯文本
    for enc in ("utf-8", "gbk", "gb2312", "latin-1"):
        try:
            return file_bytes.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return file_bytes.decode("utf-8", errors="ignore")


# ============ 题目解析正则 ============

# 题目编号：1. / 1、 / 1) / (1) / 一、 / 一.
QUESTION_START = re.compile(
    r"^\s*(?:\d{1,3}[\.、\)]|[\(（]\d{1,3}[\)）]|[一二三四五六七八九十]{1,3}[\.、])\s*"
)

# 选项：A. / A、 / A) / （A）
OPTION_PATTERN = re.compile(r"^\s*([A-H])[\.、\)\]\s]\s*(.+)")

# 答案行
ANSWER_PATTERN = re.compile(
    r"(?:参考答案|答案|正确答案|答)\s*[:：]?\s*([A-H]{1,5}(?=\s|$|[，。、）)\]])|正确|错误|对|错|[Tt][Rr][Uu][Ee]|[Ff][Aa][Ll][Ss][Ee]|[Tt]|[Ff])"
)

# 解析行
ANALYSIS_PATTERN = re.compile(r"(?:解析|答案解析|详细解析|解题思路)\s*[:：]?\s*(.+)")

# 分值
SCORE_PATTERN = re.compile(r"[（(]?\s*(\d{1,2})\s*分\s*[)）]?")

# 题型标题（如 "一、单项选择题" / "Part I. Vocabulary"）
SECTION_PATTERN = re.compile(
    r"^\s*(?:[一二三四五六七八九十]+[、\.]|Part\s*[IVX]+|Section\s*[A-Z])\s*[：:]?\s*(.+)$",
    re.IGNORECASE,
)

# 题型关键词（用于识别章节标题）
SECTION_KEYWORDS = [
    "单项选择", "单选题", "多项选择", "多选题", "选择题",
    "判断", "正误", "填空", "完形", "阅读",
    "翻译", "作文", "写作", "简答", "论述", "主观", "口语", "词汇", "语法",
]


def is_section_title(line: str) -> Optional[str]:
    """判断是否为章节标题，返回章节名或 None"""
    sec_m = SECTION_PATTERN.match(line)
    if not sec_m:
        return None
    title = sec_m.group(1).strip()
    if any(kw in title for kw in SECTION_KEYWORDS):
        return title
    # 形如 "一、单项选择题（每题2分，共20分）"
    if any(kw in line for kw in SECTION_KEYWORDS) and len(line) < 60:
        # 提取题型关键词
        for kw in SECTION_KEYWORDS:
            if kw in line:
                return kw + "题" if not kw.endswith("题") else kw
    return None


def extract_inline_options(text: str) -> tuple[str, list]:
    """从文本中提取同行选项（A. xxx B. xxx C. xxx），返回清理后的文本和选项列表"""
    options = []
    # 匹配 A. xxx 直到下一个选项字母或行尾
    pattern = re.compile(r"([A-H])[\.、\)\]\s]+(.+?)(?=\s*[A-H][\.、\)\]\s]|$)")
    matches = pattern.findall(text)
    if len(matches) >= 2:
        for key, opt_text in matches:
            options.append({"key": key, "text": opt_text.strip()})
        # 从文本中移除选项部分
        cleaned = pattern.sub("", text).strip()
        return cleaned, options
    return text, []


def extract_answer_inline(text: str) -> tuple[str, str]:
    """从文本中提取行内答案，返回清理后的文本和答案"""
    ans_m = ANSWER_PATTERN.search(text)
    if ans_m:
        answer = ans_m.group(1).strip()
        cleaned = (text[:ans_m.start()] + text[ans_m.end():]).strip(" ：:，,。")
        return cleaned, answer
    # 宽松匹配（填空/翻译题）
    loose = re.search(r"(?:参考答案|答案|正确答案|答)\s*[:：]\s*(.+)", text)
    if loose:
        ans_text = loose.group(1).strip()
        ans_text = re.split(r"(?:解析|答案解析|详细解析)", ans_text)[0].strip(" ：:，,。")
        cleaned = (text[:loose.start()] + text[loose.end():]).strip(" ：:，,。")
        return cleaned, ans_text
    return text, ""


def detect_question_type(section_text: str, options_count: int, answer: str) -> str:
    """根据章节标题、选项数、答案推断题型"""
    s = section_text.lower()
    if any(k in s for k in ["多选", "multiple", "multi-select"]):
        return "multiple_choice"
    if any(k in s for k in ["单选", "single", "单项选择", "单项选择题", "选择题"]) and "多选" not in s:
        return "single_choice"
    if any(k in s for k in ["判断", "true/false", "t/f", "正误"]):
        return "judge"
    if any(k in s for k in ["填空", "fill", "blank", "cloze"]):
        return "fill"
    if any(k in s for k in ["作文", "writing", "essay"]):
        return "essay"
    if any(k in s for k in ["翻译", "translation", "translate"]):
        return "translation"
    if any(k in s for k in ["口语", "oral", "speaking"]):
        return "oral"
    if any(k in s for k in ["简答", "论述", "主观", "subjective", "short answer"]):
        return "subjective"
    # 根据选项和答案推断
    if options_count >= 2:
        if answer and len(answer) > 1 and answer.upper() in "ABCDEFGH":
            return "multiple_choice"
        return "single_choice"
    if answer in ("对", "错", "正确", "错误", "T", "F", "True", "False"):
        return "judge"
    return "subjective"


def parse_questions(text: str, default_course_id: int = 1) -> list[dict]:
    """解析文本中的题目，返回题目列表"""
    lines = text.split("\n")
    questions = []
    current = None
    current_section = ""
    pending_section = ""
    current_options = []
    current_answer = ""
    current_analysis = ""
    current_score = 0
    collecting_analysis = False

    def flush():
        nonlocal current, current_options, current_answer, current_analysis, current_score, collecting_analysis
        if current is None:
            return
        qtype = detect_question_type(current_section, len(current_options), current_answer)
        # 判断题选项标准化
        options = current_options
        if qtype == "judge" and not options:
            options = [{"key": "T", "text": "正确"}, {"key": "F", "text": "错误"}]
        questions.append({
            "type": qtype,
            "stem": current.strip(),
            "options": options,
            "answer": current_answer,
            "analysis": current_analysis.strip(),
            "score": current_score or 0,
            "difficulty": 3.0,
            "course_id": default_course_id,
            "source": "文档导入",
            "section": current_section,
            "_parsed": True,
        })
        current = None
        current_options = []
        current_answer = ""
        current_analysis = ""
        current_score = 0
        collecting_analysis = False

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        # 章节标题（延迟应用，避免影响上一题的题型识别）
        sec_title = is_section_title(line)
        if sec_title:
            pending_section = sec_title
            continue

        # 答案行（严格匹配：选择/判断题）
        ans_m = ANSWER_PATTERN.search(line)
        if ans_m and current is not None:
            current_answer = ans_m.group(1).strip()
            collecting_analysis = False
            rest = line[ans_m.end():].strip(" ：:")
            if rest:
                current_analysis = rest
            continue

        # 宽松答案匹配（填空/翻译/主观题，答案为任意文本）
        loose_ans = re.search(r"(?:参考答案|答案|正确答案|答)\s*[:：]\s*(.+)", line)
        if loose_ans and current is not None and not current_answer:
            ans_text = loose_ans.group(1).strip()
            ans_text = re.split(r"(?:解析|答案解析|详细解析|解题思路)", ans_text)[0].strip(" ：:，,。")
            current_answer = ans_text
            collecting_analysis = False
            continue

        # 解析行
        ana_m = ANALYSIS_PATTERN.search(line)
        if ana_m and current is not None:
            current_analysis = ana_m.group(1).strip()
            collecting_analysis = True
            continue

        # 分值
        score_m = SCORE_PATTERN.search(line)
        if score_m and current is not None and not current_score:
            current_score = int(score_m.group(1))

        # 选项行（每行一个选项，或同行多个选项 A. xxx B. xxx）
        opt_m = OPTION_PATTERN.match(line)
        if opt_m and current is not None:
            # 先检查是否同行多选项
            cleaned, inline_opts = extract_inline_options(line)
            if len(inline_opts) >= 2:
                current_options = inline_opts
                if cleaned.strip():
                    current += " " + cleaned.strip()
            else:
                current_options.append({"key": opt_m.group(1), "text": opt_m.group(2).strip()})
            collecting_analysis = False
            continue

        # 题目起始行
        q_m = QUESTION_START.match(line)
        if q_m:
            flush()
            # 应用延迟的章节标题（上一题已用旧章节 flush）
            if pending_section:
                current_section = pending_section
                pending_section = ""
            stem = line[q_m.end():].strip()
            stem = SCORE_PATTERN.sub("", stem).strip()
            # 提取行内答案
            stem, inline_ans = extract_answer_inline(stem)
            if inline_ans:
                current_answer = inline_ans
            # 提取同行选项（如 "A. xxx B. xxx C. xxx"）
            stem, inline_opts = extract_inline_options(stem)
            if inline_opts:
                current_options = inline_opts
            current = stem
            collecting_analysis = False
            continue

        # 续行（题干或解析的延续）
        if current is not None:
            if collecting_analysis:
                current_analysis += " " + line
            else:
                # 检查续行中是否包含同行选项
                cleaned, inline_opts = extract_inline_options(line)
                if inline_opts and not current_options:
                    current_options = inline_opts
                    if cleaned:
                        current += " " + cleaned
                else:
                    # 检查续行中是否包含答案
                    cleaned, inline_ans = extract_answer_inline(line)
                    if inline_ans:
                        current_answer = inline_ans
                        if cleaned:
                            current += " " + cleaned
                    else:
                        current += " " + line

    flush()
    return questions


def import_questions_from_file(file_bytes: bytes, filename: str, course_id: int = 1) -> dict:
    """从上传文件解析题目，返回预览结果"""
    try:
        text = extract_text(file_bytes, filename)
    except Exception as e:
        return {"ok": False, "error": f"文档解析失败：{str(e)}", "questions": [], "text_preview": ""}

    if not text.strip():
        return {"ok": False, "error": "文档内容为空或无法提取文本", "questions": [], "text_preview": ""}

    questions = parse_questions(text, course_id)

    # 题型统计
    type_count = {}
    for q in questions:
        type_count[q["type"]] = type_count.get(q["type"], 0) + 1

    return {
        "ok": True,
        "filename": filename,
        "total": len(questions),
        "type_count": type_count,
        "questions": questions,
        "text_preview": text[:2000],
    }
