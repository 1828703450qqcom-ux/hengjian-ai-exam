import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import EChart from '../components/EChart'
import { PageHeader, Tag, Empty, Loading, StatCard, toast } from '../components/ui'

const typeName = { single_choice: '单选题', multiple_choice: '多选题', judge: '判断题', fill: '填空题', essay: '作文', translation: '翻译', oral: '口语', subjective: '主观题' }

export default function QuestionBankManage() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState(null)
  const [courses, setCourses] = useState([])
  const [keyword, setKeyword] = useState('')
  const [courseId, setCourseId] = useState(0)
  const [activeTab, setActiveTab] = useState('list')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [q, c] = await Promise.all([api.get('/questions'), api.get('/system/courses')])
      setQuestions(q.items || [])
      setCourses(c.items || [])
      setError('')
    } catch (e) { setError(e.detail || '题库数据加载失败'); setQuestions([]) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => (questions || []).filter(q =>
    (!courseId || q.course_id === courseId) &&
    (!keyword || `${q.stem} ${q.subject} ${q.type} ${(q.tags || []).join(' ')}`.toLowerCase().includes(keyword.toLowerCase()))
  ), [questions, courseId, keyword])
  const warnings = filtered.filter(q => q.discrimination != null && q.discrimination < 0.3 || q.difficulty < 1 || q.difficulty > 5)
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15))
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * 15, Math.min(page, pageCount) * 15)
  const chart = {
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 14, top: 34, bottom: 48 },
    xAxis: { type: 'category', data: filtered.slice(0, 24).map(q => `Q${q.id}`), axisLabel: { rotate: 35 } },
    yAxis: [{ type: 'value', name: '难度', min: 0, max: 5 }, { type: 'value', name: '区分度', min: 0, max: 1 }],
    series: [
      { name: '难度', type: 'bar', data: filtered.slice(0, 24).map(q => q.difficulty || 0), itemStyle: { color: '#2987ff', borderRadius: [4, 4, 0, 0] } },
      { name: '区分度', type: 'line', yAxisIndex: 1, smooth: true, data: filtered.slice(0, 24).map(q => q.discrimination ?? 0.5), lineStyle: { color: '#10c7cf' }, itemStyle: { color: '#10c7cf' } },
    ],
  }
  if (!questions) return <Loading text="加载题库数据..." />
  return <div>
    <PageHeader title="题库管理" desc="真实题目数据、质量分布与来源管理" actions={<div className="flex"><button className="btn" onClick={load}>刷新数据</button><button className="btn primary" onClick={() => navigate('/question-bank')}>进入智能题库</button></div>} />
    {error && <div className="alert danger mb16">{error}</div>}
    <div className="grid grid-4 mb16">
      <StatCard label="题目总数" value={questions.length} icon="📚" />
      <StatCard label="客观题" value={questions.filter(q => ['single_choice', 'multiple_choice', 'judge', 'fill'].includes(q.type)).length} icon="☑️" />
      <StatCard label="主观题" value={questions.filter(q => ['essay', 'translation', 'oral', 'subjective'].includes(q.type)).length} icon="✍️" />
      <StatCard label="质量关注" value={warnings.length} icon="⚠️" delta="区分度低于 0.30" deltaType={warnings.length ? 'warn' : 'ok'} />
    </div>
    <div className="card mb16"><div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><div className="flex"><button className={`btn sm ${activeTab === 'list' ? 'primary' : ''}`} onClick={() => setActiveTab('list')}>题目列表</button><button className={`btn sm ${activeTab === 'quality' ? 'primary' : ''}`} onClick={() => setActiveTab('quality')}>质量分析</button></div><div className="flex"><select className="input sm" value={courseId} onChange={e => setCourseId(Number(e.target.value))}><option value={0}>全部课程</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input sm" placeholder="搜索题干、学科、标签" value={keyword} onChange={e => setKeyword(e.target.value)} /></div></div></div>
    {activeTab === 'list' ? <div className="card"><div className="card-title">题目列表 <Tag color="blue">{filtered.length} 题</Tag></div>{filtered.length ? <><div className="table-wrap"><table><thead><tr><th>编号</th><th>题型</th><th>学科</th><th>题干</th><th>难度</th><th>区分度</th><th>来源</th><th>操作</th></tr></thead><tbody>{visible.map(q => <tr key={q.id}><td>Q{q.id}</td><td><Tag color="blue">{typeName[q.type] || q.type}</Tag></td><td>{q.subject || '—'}</td><td style={{ minWidth: 250, maxWidth: 380 }}>{q.stem}</td><td>{Number(q.difficulty || 0).toFixed(1)} / 5</td><td>{q.discrimination == null ? '待标定' : Number(q.discrimination).toFixed(2)}</td><td>{q.source || '本地'}</td><td><button className="btn sm" onClick={() => navigate('/question-bank')}>查看与编辑</button></td></tr>)}</tbody></table></div><div className="flex mt16" style={{ justifyContent: 'flex-end' }}><button className="btn sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button><span className="small muted">{Math.min(page, pageCount)} / {pageCount}</span><button className="btn sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>下一页</button></div></> : <Empty title="没有匹配的题目" action={<button className="btn primary" onClick={() => navigate('/question-bank')}>新增或导入题目</button>} />}</div> : <div className="grid grid-2"><div className="card"><div className="card-title">难度与区分度</div>{filtered.length ? <EChart option={chart} height={350} /> : <Empty title="暂无分析数据" />}</div><div className="card"><div className="card-title">需要复核的题目</div>{warnings.length ? warnings.map(q => <div key={q.id} style={{ padding: 12, marginBottom: 8, border: '1px solid #dbe7f5', borderRadius: 9 }}><b>Q{q.id}</b> · {q.stem}<div className="small muted">难度 {q.difficulty} · 区分度 {q.discrimination ?? '待标定'}</div></div>) : <Empty icon="✅" title="当前筛选范围内没有低质量预警" />}</div></div>}
    <div className="card mt16"><div className="card-title">题库扩展入口</div><div className="flex" style={{ flexWrap: 'wrap' }}><button className="btn" onClick={() => navigate('/question-bank')}>文档导入与多数据源检索</button><button className="btn" onClick={() => navigate('/tag-management')}>标签管理</button><button className="btn" onClick={() => navigate('/paper-assembly')}>智能组卷</button></div></div>
  </div>
}

