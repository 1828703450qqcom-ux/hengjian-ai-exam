"""联网搜索组题服务
通过必应/DuckDuckGo 搜索相关题目，返回可预览的题目候选
支持按关键词、题型、数量、难度筛选，用户确认后入库或加入试卷
"""
import re
import httpx
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed


# 题型关键词映射（用于构造搜索 query）
TYPE_KEYWORDS = {
    "single_choice": "单选题 选择题",
    "multiple_choice": "多选题",
    "judge": "判断题 正误题",
    "fill": "填空题",
    "essay": "作文题 写作",
    "translation": "翻译题",
    "oral": "口语题",
    "subjective": "主观题 简答题 论述题",
}

TYPE_LABEL = {
    "single_choice": "单选题", "multiple_choice": "多选题", "judge": "判断题",
    "fill": "填空题", "essay": "作文", "translation": "翻译", "oral": "口语", "subjective": "主观题",
}

# 多数据源配置：每个数据源对应搜索限定符和名称
DATA_SOURCES = {
    "general": {"name": "全网教育资源", "site": "", "desc": "必应与 DuckDuckGo 聚合检索", "category": "综合资源", "accent": "#2563eb"},
    "zxxk": {"name": "学科网", "site": "site:zxxk.com", "desc": "分学科试题与成套试卷", "category": "基础教育", "accent": "#0ea5e9"},
    "wenku": {"name": "百度文库", "site": "site:wenku.baidu.com", "desc": "文档型题库与教学资料", "category": "文档资源", "accent": "#8b5cf6"},
    "jyeoo": {"name": "菁优网", "site": "site:jyeoo.com", "desc": "数理化题目与解析", "category": "理工题库", "accent": "#10b981"},
    "zujuan": {"name": "组卷网", "site": "site:zujuan.com", "desc": "章节化智能组卷资源", "category": "专业题库", "accent": "#f59e0b"},
    "koolearn": {"name": "新东方在线", "site": "site:koolearn.com", "desc": "英语、考研与语言能力题库", "category": "语言考试", "accent": "#ec4899"},
    "offcn": {"name": "中公教育", "site": "site:offcn.com", "desc": "职业教育与公共考试题库", "category": "职业考试", "accent": "#ef4444"},
    "mooc": {"name": "中国大学MOOC", "site": "site:icourse163.org", "desc": "高校课程练习与开放课程内容", "category": "高校课程", "accent": "#0891b2"},
    "xuetangx": {"name": "学堂在线", "site": "site:xuetangx.com", "desc": "高校精品课程与章节测验", "category": "高校课程", "accent": "#4f46e5"},
    "openstax": {"name": "OpenStax", "site": "site:openstax.org", "desc": "开放教材与标准化练习题", "category": "开放教育", "accent": "#16a34a"},
    "khan": {"name": "Khan Academy", "site": "site:khanacademy.org", "desc": "数学、科学与计算机练习资源", "category": "开放教育", "accent": "#14b8a6"},
}


def _clean_html(text: str) -> str:
    """去除 HTML 标签，清理空白"""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def search_bing(query: str, count: int = 10) -> list[dict]:
    """必应搜索，返回标题/URL/摘要列表"""
    url = "https://www.bing.com/search"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    results = []
    try:
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            resp = client.get(url, params={"q": query, "count": count}, headers=headers)
            if resp.status_code != 200:
                return results
            html = resp.text
            # 提取搜索结果块
            blocks = re.findall(r'<li class="b_algo".*?</li>', html, re.DOTALL)
            for block in blocks[:count]:
                title_m = re.search(r'<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>(.*?)</a></h2>', block, re.DOTALL)
                if not title_m:
                    continue
                link = title_m.group(1)
                title = _clean_html(title_m.group(2))
                # 摘要
                snippet_m = re.search(r'<p[^>]*>(.*?)</p>', block, re.DOTALL)
                snippet = _clean_html(snippet_m.group(1)) if snippet_m else ""
                if title:
                    results.append({"title": title, "url": link, "snippet": snippet, "source": "bing"})
    except Exception:
        pass
    return results


def search_duckduckgo(query: str, count: int = 10) -> list[dict]:
    """DuckDuckGo HTML 版搜索（备用）"""
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    results = []
    try:
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            resp = client.post(url, data={"q": query}, headers=headers)
            if resp.status_code != 200:
                return results
            html = resp.text
            blocks = re.findall(r'<div class="result results_links.*?">.*?</div>\s*</div>', html, re.DOTALL)
            for block in blocks[:count]:
                title_m = re.search(r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', block, re.DOTALL)
                if not title_m:
                    continue
                link = title_m.group(1)
                title = _clean_html(title_m.group(2))
                snippet_m = re.search(r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>', block, re.DOTALL)
                snippet = _clean_html(snippet_m.group(1)) if snippet_m else ""
                if title:
                    results.append({"title": title, "url": link, "snippet": snippet, "source": "duckduckgo"})
    except Exception:
        pass
    return results


def extract_question_from_result(result: dict, qtype: str = "") -> Optional[dict]:
    """从搜索结果中提取题目候选"""
    title = result.get("title", "")
    snippet = result.get("snippet", "")
    combined = f"{title} {snippet}"

    # 尝试提取选项
    options = []
    opt_matches = re.findall(r"([A-H])[\.、\)\]\s]+([^A-H]{2,60}?)(?=[A-H][\.、\)\]\s]|$|答案|解析)", combined)
    for key, text in opt_matches[:8]:
        options.append({"key": key, "text": text.strip()})

    # 尝试提取答案
    answer = ""
    ans_m = re.search(r"(?:答案|参考答案|正确答案)[:：]?\s*([A-H]{1,5}|对|错|正确|错误)", combined)
    if ans_m:
        answer = ans_m.group(1)

    # 题干：取标题（去掉"答案""解析"等后缀）
    stem = re.sub(r"[（(].*?答案.*?[)）]", "", title).strip()
    if len(stem) < 4:
        stem = snippet[:120]

    # 推断题型
    if not qtype:
        if options:
            qtype = "multiple_choice" if answer and len(answer) > 1 else "single_choice"
        elif answer in ("对", "错", "正确", "错误"):
            qtype = "judge"
        else:
            qtype = "subjective"

    if qtype == "judge" and not options:
        options = [{"key": "T", "text": "正确"}, {"key": "F", "text": "错误"}]

    return {
        "type": qtype,
        "stem": stem,
        "options": options,
        "answer": answer,
        "analysis": snippet if snippet != stem else "",
        "difficulty": 3.0,
        "source": f"联网搜索-{result.get('source', '')}",
        "source_url": result.get("url", ""),
        "score": 0,
        "_parsed": True,
    }


def web_search_questions(
    keyword: str,
    qtype: str = "",
    count: int = 10,
    course_name: str = "",
    difficulty: float = 3.0,
    sources: list = None,
) -> dict:
    """联网搜索题目，支持多数据源并行搜索，返回候选列表"""
    if not keyword.strip():
        return {"ok": False, "error": "请输入搜索关键词", "results": [], "questions": []}

    if not sources:
        sources = ["general"]

    type_kw = TYPE_KEYWORDS.get(qtype, "")
    base_query = " ".join(p for p in [course_name, keyword, type_kw, "试题 答案 解析"] if p)

    all_results = []
    source_stats = {}

    def search_one_source(src_key, src_cfg, query):
        """搜索单个数据源，返回 (src_key, results)"""
        raw = search_bing(query, count * 2)
        if src_key == "general" and len(raw) < 3:
            ddg = search_duckduckgo(query, count * 2)
            existing_urls = {r["url"] for r in raw}
            for r in ddg:
                if r["url"] not in existing_urls:
                    raw.append(r)
        for r in raw:
            r["source_db"] = src_cfg["name"]
            r["source_key"] = src_key
        return src_key, raw, src_cfg["name"]

    # 并发搜索多个数据源
    search_tasks = []
    for src_key in sources:
        src_cfg = DATA_SOURCES.get(src_key)
        if not src_cfg:
            continue
        query = f"{src_cfg['site']} {base_query}".strip() if src_cfg["site"] else base_query
        search_tasks.append((src_key, src_cfg, query))

    with ThreadPoolExecutor(max_workers=min(len(search_tasks), 5)) as executor:
        futures = {executor.submit(search_one_source, k, c, q): k for k, c, q in search_tasks}
        for future in as_completed(futures, timeout=25):
            try:
                src_key, raw, src_name = future.result()
                all_results.extend(raw)
                source_stats[src_key] = {"name": src_name, "count": len(raw)}
            except Exception:
                pass

    # 去重（按标题前30字符）
    seen = set()
    unique_results = []
    for r in all_results:
        key = r.get("title", "")[:30]
        if key and key not in seen:
            seen.add(key)
            unique_results.append(r)

    # 提取题目候选
    questions = []
    for r in unique_results[:count]:
        q = extract_question_from_result(r, qtype)
        if q:
            q["difficulty"] = difficulty
            q["source_db"] = r.get("source_db", "")
            q["source"] = f"外部题库-{r.get('source_key', 'general')}"
            q["quality_score"] = min(98, 72 + (18 if q.get("answer") else 0) + (8 if q.get("analysis") else 0))
            questions.append(q)

    return {
        "ok": True,
        "keyword": keyword,
        "query": base_query,
        "sources": sources,
        "source_stats": source_stats,
        "raw_count": len(unique_results),
        "question_count": len(questions),
        "results": unique_results[:count],
        "questions": questions,
    }
