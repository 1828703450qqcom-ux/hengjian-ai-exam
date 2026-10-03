"""AI 智能评阅引擎
- 客观题：精确比对（100% 准确率硬指标）
- 主观题：关键词覆盖 + TF-IDF 语义相似度 + 结构特征 → 多维评分
- 口语测评：转写文本流利度/内容/发音
- 与教师判分一致性：冲突检测 + 一致性计算 + 校准建议
"""
import re
import math
from collections import Counter

import jieba
import numpy as np

jieba.setLogLevel(60)


# ---------------- 文本工具 ----------------
_PUNCT_RE = None


def norm_text(s: str) -> str:
    global _PUNCT_RE
    if _PUNCT_RE is None:
        # 中文+英文标点去噪
        chars = "\\s，。、；：\"'（）《》【】,.!?;:()[]{}+"
        _PUNCT_RE = re.compile("[" + chars + "]")
    if not s:
        return ""
    s = s.strip().lower()
    return _PUNCT_RE.sub("", s)


def tokenize_zh(text: str) -> list:
    """中文按词+单字混合切分，英文按词"""
    text = text.lower()
    words = jieba.lcut(text)
    toks = []
    for w in words:
        w = w.strip()
        if not w or w in "，。、；：！？．,.:;!? \t\n":
            continue
        if re.search(r"[\u4e00-\u9fa5]", w):
            if len(w) > 1:
                toks.append(w)
            toks.append(w)
        else:
            toks.extend(re.findall(r"[a-z0-9']+", w))
    return toks


def _tfidf_vectors(docs_tokens: list[list], query_tokens: list) -> tuple[np.ndarray, dict]:
    """构建 TF-IDF 向量（docs 为语料，query 单独向量化）"""
    vocab = {}
    for toks in docs_tokens:
        for t in set(toks):
            vocab.setdefault(t, len(vocab))
    n_docs = len(docs_tokens) + 1  # 把 query 也算一篇
    df = Counter()
    for toks in docs_tokens:
        for t in set(toks):
            if t in vocab:
                df[t] += 1
    for t in set(query_tokens):
        if t in vocab:
            df[t] += 1

    def vec(toks):
        v = np.zeros(len(vocab))
        tf = Counter(toks)
        for t, c in tf.items():
            if t not in vocab:
                continue
            idf = math.log((n_docs + 1) / (df[t] + 1)) + 1
            v[vocab[t]] = c * idf
        return v
    return vec(query_tokens), [vec(t) for t in docs_tokens]


def cosine_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    ta, tb = tokenize_zh(a), tokenize_zh(b)
    qv, docvs = _tfidf_vectors([tb], ta)
    if np.linalg.norm(qv) == 0 or np.linalg.norm(docvs[0]) == 0:
        # 回退到 Jaccard
        return jaccard_similarity(a, b)
    return float(np.dot(qv, docvs[0]) / (np.linalg.norm(qv) * np.linalg.norm(docvs[0]) + 1e-9))


def jaccard_similarity(a: str, b: str) -> float:
    sa, sb = set(tokenize_zh(a)), set(tokenize_zh(b))
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def keyword_coverage(text: str, keywords: list[str]) -> tuple[float, list[str]]:
    """关键词覆盖：返回覆盖率与命中关键词"""
    if not keywords:
        return 1.0, []
    tokens = set(tokenize_zh(text))
    hit = []
    for kw in keywords:
        ktoks = set(tokenize_zh(kw))
        if ktoks and ktoks.issubset(tokens):
            hit.append(kw)
        elif kw and norm_text(kw) in norm_text(text):
            hit.append(kw)
    return len(hit) / len(keywords), hit


# ---------------- 客观题 ----------------
def grade_objective(question_type: str, student_answer, correct_answer, full_score: float) -> dict:
    """客观题精确比对，准确率 100%"""
    sa = norm_text(str(student_answer or ""))
    ca = norm_text(str(correct_answer or ""))
    correct = False
    if question_type == "multiple_choice":
        # 多选：集合比对
        ss = set(re.findall(r"[A-Ha-h]", sa))
        cs = set(re.findall(r"[A-Ha-h]", ca))
        correct = ss == cs and bool(ss)
    else:
        correct = sa == ca and bool(sa)
    score = full_score if correct else 0.0
    return {
        "score": round(score, 1),
        "is_correct": correct,
        "feedback": "答案正确" if correct else f"答案错误，正确答案：{correct_answer}",
    }


# ---------------- 主观题 ----------------
def _english_features(text: str) -> dict:
    words = re.findall(r"[a-zA-Z']+", text.lower())
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    vocab = set(words)
    return {
        "word_count": len(words),
        "sentence_count": max(len(sentences), 1),
        "unique_words": len(vocab),
        "avg_sentence_len": len(words) / max(len(sentences), 1),
        "vocab_richness": len(vocab) / max(len(words), 1),
    }


def _structure_score(text: str) -> float:
    """结构完整性：段落/字数/连接词"""
    score = 0.0
    paras = [p for p in text.split("\n") if p.strip()]
    length = len(text)
    if length >= 80:
        score += 0.3
    elif length >= 40:
        score += 0.15
    if len(paras) >= 3:
        score += 0.4
    elif len(paras) >= 2:
        score += 0.25
    connectors = ["首先", "其次", "最后", "此外", "因此", "总之", "however", "therefore", "moreover",
                  "in addition", "first", "second", "finally", "conclusion", "因为", "所以", "同时"]
    if any(c in text.lower() for c in connectors):
        score += 0.3
    return min(score, 1.0)


def grade_subjective(text: str, question: dict, full_score: float) -> dict:
    """主观题多维评分：关键词覆盖 + 语义相似度 + 结构特征"""
    reference = question.get("answer") or ""
    rubric = question.get("scoring_rubric") or {}
    keywords = rubric.get("keywords") or question.get("keywords") or []

    if not text or not text.strip():
        return {"score": 0.0, "feedback": "未作答", "dimensions": []}

    # 1) 语义相似度（对参考答案）
    sim_ref = cosine_similarity(text, reference) if reference else 0.0

    # 2) 关键词覆盖
    cov, hit_kw = keyword_coverage(text, keywords)

    # 3) 结构特征
    structure = _structure_score(text)

    # 4) 英文特征（英语作文）
    dims = []
    is_english = bool(re.search(r"[a-zA-Z]{4,}", text))
    if is_english:
        f = _english_features(text)
        word_score = min(f["word_count"] / 150.0, 1.0) * 0.6 + min(f["vocab_richness"] * 2.0, 1.0) * 0.4
        dims.append(("词汇与表达", round(word_score * 100, 1)))
        dims.append(("语法与准确度", round(max(0.35, sim_ref * 0.7 + 0.3) * 100, 1)))

    # 加权：语义 40% + 关键词 35% + 结构 25%（英文作文含语言维度 30%）
    if is_english:
        lang = min(max(sim_ref * 0.5 + 0.2, 0.0), 1.0)
        total_ratio = sim_ref * 0.35 + cov * 0.25 + structure * 0.15 + lang * 0.25
    else:
        total_ratio = sim_ref * 0.40 + cov * 0.35 + structure * 0.25

    score = round(full_score * min(max(total_ratio, 0.0), 1.0), 1)

    # 反馈
    feedback_parts = []
    if cov >= 0.8:
        feedback_parts.append("要点覆盖全面")
    elif cov >= 0.5:
        feedback_parts.append("要点覆盖基本到位，可补充以下关键词：" + "、".join([k for k in keywords if k not in hit_kw][:3]))
    else:
        feedback_parts.append("要点遗漏较多，需围绕" + "、".join(keywords[:3]) + "展开")
    if sim_ref < 0.3:
        feedback_parts.append("内容与参考答案契合度偏低，建议加强审题")
    if structure < 0.5:
        feedback_parts.append("结构不够清晰，建议分点分段作答")
    feedback = "；".join(feedback_parts) if feedback_parts else "作答完整"

    return {
        "score": score,
        "feedback": feedback,
        "dimensions": dims,
        "similarity": round(sim_ref, 3),
        "keyword_coverage": round(cov, 3),
        "structure": round(structure, 3),
        "hit_keywords": hit_kw,
    }


# ---------------- 口语测评 ----------------
def grade_oral(transcript: str, question: dict, audio_duration: float = 0.0, recognition_confidence: float = 0.9) -> dict:
    """口语测评：流利度 + 内容 + 表达"""
    reference = question.get("answer") or ""
    keywords = (question.get("scoring_rubric") or {}).get("keywords") or question.get("keywords") or []

    words = len(re.findall(r"[\u4e00-\u9fa5]|[a-zA-Z']+", transcript or ""))
    if not transcript or not transcript.strip():
        return {"total_score": 0.0, "fluency": 0, "content": 0, "pronunciation": 0, "feedback": "未作答"}

    # 流利度：语速 + 停顿（用字符数/时长近似）
    if audio_duration and audio_duration > 0:
        speed = len(re.findall(r"[\u4e00-\u9fa5]", transcript)) / audio_duration  # 字/秒
        fluency = min(max(speed / 3.2, 0.0), 1.0)
        fluency = 0.6 * fluency + 0.4 * min(len(transcript) / 60.0, 1.0)
    else:
        fluency = min(len(transcript) / 80.0, 1.0)

    # 内容：关键词 + 语义相似度
    cov, _ = keyword_coverage(transcript, keywords)
    sim = cosine_similarity(transcript, reference) if reference else cov
    content = max(cov * 0.6 + sim * 0.4, 0.0)

    # 发音：识别置信度 + 长度置信
    pronunciation = min(max(recognition_confidence, 0.3), 1.0) * (0.7 + 0.3 * min(len(transcript) / 100, 1.0))

    total = round(100 * (0.35 * fluency + 0.40 * content + 0.25 * pronunciation), 1)
    return {
        "total_score": total,
        "fluency": round(fluency * 100, 1),
        "content": round(content * 100, 1),
        "pronunciation": round(pronunciation * 100, 1),
        "feedback": "表达流畅，内容充实" if total >= 85 else ("内容基本完整" if total >= 70 else "建议加强练习"),
    }


# ---------------- 教师一致性 ----------------
def compute_agreement(ai_scores: list[float], teacher_scores: list[float], tolerance: float = 10.0) -> dict:
    """AI 与教师判分一致性（容差内一致率 + 相关系数）"""
    n = len(ai_scores)
    if n == 0:
        return {"agreement": 1.0, "correlation": 1.0, "count": 0, "conflicts": 0}
    conflicts = 0
    diffs = []
    for a, t in zip(ai_scores, teacher_scores):
        d = abs(a - t)
        diffs.append(d)
        if d > tolerance:
            conflicts += 1
    agreement = (n - conflicts) / n
    # 皮尔逊相关系数
    corr = 1.0
    if n >= 2:
        aa, tt = np.array(ai_scores), np.array(teacher_scores)
        if aa.std() > 0 and tt.std() > 0:
            corr = float(np.corrcoef(aa, tt)[0, 1])
    return {
        "agreement": round(agreement, 4),
        "correlation": round(corr, 4),
        "count": n,
        "conflicts": conflicts,
        "avg_diff": round(float(np.mean(diffs)), 2) if diffs else 0.0,
    }


def calibrate(agreement: float, threshold: float = 0.90) -> dict:
    """若一致性低于阈值，给出校准建议（弹性中台自适应）"""
    if agreement >= threshold:
        return {"need_calibrate": False, "message": "AI 判分与教师一致性达标，无需校准"}
    factor = agreement / threshold
    return {
        "need_calibrate": True,
        "suggested_factor": round(factor, 3),
        "message": f"一致性 {agreement:.1%} 低于阈值 {threshold:.0%}，建议按 {factor:.2f} 因子缩放 AI 主观分并抽样复核",
    }
