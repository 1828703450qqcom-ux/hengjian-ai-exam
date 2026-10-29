"""Structured educational sources. Fixed upstream URLs; no downloaded code is executed."""
import hashlib
import html
import json
import os
import random
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from ..config import UPLOAD_DIR

import httpx

SOURCES = {
    'opentdb': {'name': 'Open Trivia DB', 'site': 'https://opentdb.com', 'desc': '真实 API · 英文常识、科学与计算机选择题', 'category': '结构化开放题库', 'accent': '#0ea5e9', 'license': 'CC-BY-SA-4.0'},
    'gsm8k': {'name': 'GSM8K 数学推理', 'site': 'https://github.com/openai/grade-school-math', 'desc': 'GitHub 原始数据 · 英文数学应用题及解题过程', 'category': '结构化开放题库', 'accent': '#10b981', 'license': 'MIT'},
    'mbpp': {'name': 'MBPP Python 编程', 'site': 'https://github.com/google-research/google-research/tree/master/mbpp', 'desc': 'GitHub 原始数据 · Python 编程题、参考代码与测试用例', 'category': '结构化开放题库', 'accent': '#8b5cf6', 'license': 'CC-BY-4.0'},
}
_cache = {}
_lock = threading.Lock()


def _fetch(url):
    # Environment proxies can be opted into for managed networks.
    use_proxy = os.getenv('DATA_SOURCE_USE_ENV_PROXY', 'false').lower() == 'true'
    with httpx.Client(timeout=httpx.Timeout(18, connect=8), trust_env=use_proxy, follow_redirects=False) as client:
        for attempt in range(2):
            try:
                response = client.get(url, headers={'User-Agent': 'HengjianExam/1.0'})
                break
            except httpx.TransportError:
                if attempt:
                    raise
        response.raise_for_status()
        if len(response.content) > 8_000_000:
            raise ValueError('数据集超过 8 MB 限制')
        return response.text


def _dataset(key):
    urls = {
        'gsm8k': 'https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/test.jsonl',
        'mbpp': 'https://raw.githubusercontent.com/google-research/google-research/master/mbpp/sanitized-mbpp.json',
    }
    with _lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < 3600:
            return cached[1], True
    cache_file = Path(UPLOAD_DIR) / 'open-data-cache' / f'{key}.json'
    if cache_file.exists() and time.time() - cache_file.stat().st_mtime < 86400:
        try:
            rows = json.loads(cache_file.read_text(encoding='utf8'))
            with _lock:
                _cache[key] = (time.monotonic(), rows)
            return rows, True
        except (ValueError, OSError):
            pass
    text = _fetch(urls[key])
    rows = [json.loads(line) for line in text.splitlines() if line.strip()] if key == 'gsm8k' else json.loads(text)
    with _lock:
        _cache[key] = (time.monotonic(), rows)
        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            temporary = cache_file.with_suffix('.tmp')
            temporary.write_text(json.dumps(rows, ensure_ascii=False), encoding='utf8')
            temporary.replace(cache_file)
        except OSError:
            pass
    return rows, False


def _base(key, external_id, stem, answer, analysis, qtype='subjective', options=None):
    cfg = SOURCES[key]
    return {'type': qtype, 'stem': stem, 'answer': answer, 'analysis': analysis, 'options': options or [],
            'difficulty': 3, 'source': f'open:{key}', 'source_key': key, 'source_db': cfg['name'],
            'source_url': cfg['site'], 'external_id': str(external_id), 'license': cfg['license'],
            'retrieved_at': datetime.now(timezone.utc).isoformat(), 'language': 'en',
            'structured': True, 'tags': [cfg['name'], '英文原题']}


def search_source(key, keyword='', count=10, qtype=''):
    if key not in SOURCES:
        raise ValueError('未知开放数据源')
    count = min(max(count, 1), 20)
    cached = False
    items = []
    if key == 'opentdb':
        if qtype and qtype not in ('single_choice', 'judge'):
            return [], {'status': 'empty', 'count': 0, 'message': '此源仅支持单选和判断题'}
        # Official API has no full-text search; filter the returned batch locally.
        kind = 'boolean' if qtype == 'judge' else 'multiple'
        data = json.loads(_fetch(f'https://opentdb.com/api.php?amount=50&type={kind}'))
        if data.get('response_code') != 0:
            raise ValueError('上游限流或没有匹配题目，请稍后重试')
        for row in data.get('results', []):
            stem = html.unescape(row['question'])
            correct = html.unescape(row['correct_answer'])
            uid = hashlib.sha256(stem.encode()).hexdigest()
            choices = [html.unescape(x) for x in row['incorrect_answers']] + [correct]
            random.Random(uid).shuffle(choices)
            if kind == 'boolean':
                options = [{'key': 'T', 'text': 'True'}, {'key': 'F', 'text': 'False'}]
                answer = 'T' if correct == 'True' else 'F'
            else:
                options = [{'key': chr(65+i), 'text': text} for i, text in enumerate(choices)]
                answer = next(x['key'] for x in options if x['text'] == correct)
            q = _base(key, uid, stem, answer, '', 'judge' if kind == 'boolean' else 'single_choice', options)
            q['subject'] = html.unescape(row.get('category', ''))
            q['difficulty'] = {'easy': 2, 'medium': 3, 'hard': 4}.get(row.get('difficulty'), 3)
            items.append(q)
    else:
        if qtype and qtype != 'subjective':
            return [], {'status': 'empty', 'count': 0, 'message': '此源提供主观题，请取消题型筛选'}
        rows, cached = _dataset(key)
        for i, row in enumerate(rows):
            if key == 'gsm8k':
                solution = row['answer']
                q = _base(key, f'test:{i}', row['question'], solution.split('####')[-1].strip(), solution)
                q['source_url'] += '/blob/master/grade_school_math/data/test.jsonl'
                q['subject'] = '数学推理'
            else:
                q = _base(key, row['task_id'], row['prompt'], row['code'], '\n'.join(row.get('test_list', [])))
                q['source_url'] = 'https://github.com/google-research/google-research/blob/master/mbpp/sanitized-mbpp.json'
                q['subject'] = 'Python 编程'
                q['scoring_rubric'] = {'test_cases': row.get('test_list', []), 'note': '测试用例仅供教师参考，本服务不执行代码'}
            items.append(q)
    term = keyword.strip().casefold()
    if term:
        items = [q for q in items if term in (q['stem'] + ' ' + q.get('subject', '')).casefold()]
    items = items[:count]
    return items, {'status': 'ok' if items else 'empty', 'count': len(items), 'cached': cached,
                   'message': '英文原题；关键词按原文匹配。OpenTDB 在当前批次中筛选。' if not items else '已取得结构化原题'}

