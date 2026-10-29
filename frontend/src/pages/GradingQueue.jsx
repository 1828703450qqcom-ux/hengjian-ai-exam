import { useEffect, useState } from 'react'
import api from '../api'
import EChart from '../components/EChart'
import './grading.css'
import { PageHeader, Tag, Empty, Loading, StatCard, toast } from '../components/ui'

const TYPE_LABEL = { single_choice: '单选题', multiple_choice: '多选题', judge: '判断题', fill: '填空题', essay: '作文', translation: '翻译', oral: '口语', subjective: '主观题' }

const SUBJECTIVE = new Set(['essay', 'translation', 'oral', 'subjective'])

export default function GradingQueue({ subjectiveOnly = false }) {
  const [sessions, setSessions] = useState(null)
  const [detail, setDetail] = useState(null)
  const [scores, setScores] = useState({})
  const [feedback, setFeedback] = useState({})
  const [result, setResult] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [arbitrations, setArbitrations] = useState([])
  const [arbScores, setArbScores] = useState({})
  const [busyAnswer, setBusyAnswer] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [d, a] = await Promise.all([api.get('/exams/sessions'), api.get('/exams-enhanced/double-grade/arbitrations')])
      setSessions(d.items.filter((s) => ['graded', 'submitted', 'grading'].includes(s.status)))
      setArbitrations(a.arbitrations || [])
      setError('')
    } catch (e) { setError(e.detail || '评阅数据加载失败'); setSessions([]) }
  }

  useEffect(() => { load() }, [])

  const open = async (s) => {
    setSessionId(s.id)
    setResult(null)
    try {
      const d = await api.get(`/grading/session/${s.id}/detail`)
      setDetail(d)
      const sc = {}, fb = {}
      d.items.forEach((x) => { sc[x.question_id] = x.teacher_score ?? x.ai_score ?? ''; fb[x.question_id] = x.teacher_feedback || '' })
      setScores(sc); setFeedback(fb)
    } catch (e) { toast.error(e.detail || '读取试卷失败') }
  }

  const submitTeacher = async () => {
    if (!sessionId) return
    setSubmitting(true)
    try {
      const numeric = {}
      detail.items.filter(x => !subjectiveOnly || SUBJECTIVE.has(x.type)).forEach(x => {
        const v = scores[x.question_id]
        if (v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > x.score) throw new Error(`第 ${x.question_id} 题评分须在 0 至 ${x.score} 之间`)
        numeric[x.question_id] = Number(v)
      })
      if (!Object.keys(numeric).length) throw new Error('当前试卷没有可评阅的题目')
      const r = await api.post(`/grading/session/${sessionId}/teacher`, { teacher_scores: numeric, teacher_feedback: feedback })
      setResult(r)
      await load()
      toast.success(r.agreement.agreement >= 0.9 ? '一致性达标 ✓' : '已提交，一致性未达 90%，请查看校准建议')
    } catch (e) { toast.error(e.detail || e.message || '提交失败') } finally { setSubmitting(false) }
  }

  const doubleGrade = async (x) => {
    const value = Number(scores[x.question_id])
    if (!Number.isFinite(value) || value < 0 || value > x.score) { toast.warning(`请输入 0 至 ${x.score} 分`); return }
    setBusyAnswer(x.answer_id)
    try {
      const r = await api.post('/exams-enhanced/double-grade/submit', { answer_id: x.answer_id, score: value, feedback: feedback[x.question_id] || '' })
      toast.success(r.message || '双评已提交')
      await load()
    } catch (e) { toast.error(e.detail || '双评提交失败') } finally { setBusyAnswer(null) }
  }

  const arbitrate = async (a) => {
    const value = Number(arbScores[a.id])
    if (!Number.isFinite(value) || arbScores[a.id] === '' || arbScores[a.id] == null || value < 0) { toast.warning('请输入有效的仲裁分数'); return }
    setBusyAnswer(`a${a.id}`)
    try {
      await api.post('/exams-enhanced/double-grade/arbitrate', { arbitration_id: a.id, final_score: value })
      toast.success('仲裁结果已保存'); await load()
    } catch (e) { toast.error(e.detail || '仲裁失败') } finally { setBusyAnswer(null) }
  }

  const agreeOption = result?.agreement ? {
    tooltip: { trigger: 'item' },
    title: { text: `${(result.agreement.agreement * 100).toFixed(1)}%`, left: 'center', top: 'middle', textStyle: { fontSize: 22, fontWeight: 700, color: '#334155' } },
    graphic: [{ type: 'text', left: 'center', top: '38%', style: { text: '一致性', fontSize: 12, fill: '#94a3b8' } }],
    series: [{
      type: 'pie', radius: ['62%', '80%'], label: { show: false }, silent: true,
      data: [
        { value: result.agreement.agreement, name: '一致', itemStyle: { color: '#16a34a' } },
        { value: Math.max(1 - result.agreement.agreement, 0.001), name: '冲突', itemStyle: { color: '#dc2626' } },
      ],
    }],
  } : null

  if (!sessions) return <Loading text="加载评阅队列..." />

  const reviewed = sessions.filter((s) => s.teacher_score != null)
  const flagged = sessions.filter((s) => s.is_flagged)

  return (
    <div>
      <PageHeader title={subjectiveOnly ? '主观题智能评阅' : 'AI 智能评阅'} desc="查看真实作答与评分依据，完成教师复核、双评和仲裁" actions={<button className="btn" onClick={load}>刷新队列</button>} />
      {error && <div className="alert danger mb16">{error}</div>}

      <div className="grid grid-3 mb16">
        <StatCard label="评阅队列" value={sessions.length} icon="📥" delta="AI 已初评" />
        <StatCard label="已复核" value={reviewed.length} icon="✅" delta="教师已确认" />
        <StatCard label="待仲裁" value={arbitrations.filter(a => a.status === 'pending').length} icon="⚖️" delta="双评分差超过阈值" deltaType="warn" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title"><span>评阅队列</span><Tag color="gray" dot>{sessions.length} 份</Tag></div>
          {sessions.length === 0 ? <Empty icon="📥" title="暂无待评阅试卷" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>考生</th><th>考试</th><th className="num">AI 分</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className={s.is_flagged ? 'row-flagged' : ''}>
                      <td><b>{s.student}</b></td><td>{s.exam_title}</td>
                      <td className="num">{s.ai_score ?? '--'}</td>
                      <td><Tag color={s.is_flagged ? 'red' : s.teacher_score != null ? 'green' : 'orange'} dot>{s.is_flagged ? '异常' : s.teacher_score != null ? '已复核' : 'AI 已评'}</Tag></td>
                      <td><button className="btn sm primary" onClick={() => open(s)}>评阅</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          {detail ? (
            <>
              <div className="card-title">
                <span>教师评阅：{detail.session?.ai_score != null ? `AI 分 ${detail.session.ai_score}` : ''}</span>
                <Tag color="blue" dot>目标一致性 ≥90%</Tag>
              </div>
              <div className="small muted mb16">逐题核对作答、参考答案和 AI 评语；教师分数不能超过题目满分。</div>
              <div style={{ maxHeight: 620, overflowY: 'auto', display: 'grid', gap: 12 }}>
                {detail.items.filter(x => !subjectiveOnly || SUBJECTIVE.has(x.type)).map((x, i) => (
                  <article className="grading-answer" key={x.answer_id}>
                    <div className="flex" style={{ justifyContent: 'space-between' }}><b>第 {i + 1} 题 · {TYPE_LABEL[x.type] || x.type}</b><Tag color={x.grading_status === 'conflict' ? 'red' : 'blue'}>{x.grading_status === 'conflict' ? '待仲裁' : `${x.score} 分`}</Tag></div>
                    <p><b>题目：</b>{x.stem}</p>
                    <p><b>学生作答：</b>{x.student_answer || '未作答'}</p>
                    <p><b>参考答案：</b>{x.answer || '未设置'}</p>
                    {x.analysis && <p><b>评分要点：</b>{x.analysis}</p>}
                    {Object.keys(x.scoring_rubric || {}).length > 0 && <p><b>评分标准：</b>{JSON.stringify(x.scoring_rubric)}</p>}
                    <div className="grading-ai-note">AI 初评 {x.ai_score ?? '未评分'} / {x.score} · {x.ai_feedback || '暂无 AI 评语'}</div>
                    <div className="grading-controls"><label>教师评分 <input aria-label={`第 ${i + 1} 题教师评分`} className="input" type="number" min="0" max={x.score} step="0.1" value={scores[x.question_id] ?? ''} onChange={e => setScores({ ...scores, [x.question_id]: e.target.value })} /></label><label>教师评语 <input aria-label={`第 ${i + 1} 题教师评语`} className="input" value={feedback[x.question_id] ?? ''} onChange={e => setFeedback({ ...feedback, [x.question_id]: e.target.value })} placeholder="填写复核依据" /></label></div>
                    {SUBJECTIVE.has(x.type) && <button className="btn sm" disabled={busyAnswer === x.answer_id} onClick={() => doubleGrade(x)}>提交独立双评</button>}
                  </article>
                ))}
                {subjectiveOnly && !detail.items.some(x => SUBJECTIVE.has(x.type)) && <Empty title="这份试卷没有主观题" />}
              </div>
              <div className="flex mt16">
                <button className="btn primary" onClick={submitTeacher} disabled={submitting}>{submitting ? '计算中...' : '提交教师评分并计算一致性'}</button>
                <button className="btn" onClick={() => setDetail(null)}>关闭</button>
              </div>
            </>
          ) : <Empty icon="📄" title="选择左侧一份试卷进行评阅" desc="点击评阅按钮开始教师复核" />}
        </div>
      </div>

      {result && (
        <div className="card mt16">
          <div className="card-title"><span>教师判分一致性报告</span><Tag color={result.agreement.agreement >= 0.9 ? 'green' : 'red'} dot>{result.agreement.agreement >= 0.9 ? '达标' : '未达标'}</Tag></div>
          <div className="grid grid-4 mb16">
            <StatCard label="一致性" value={`${(result.agreement.agreement * 100).toFixed(1)}%`} icon="🎯" delta="目标 ≥90%" deltaType={result.agreement.agreement >= 0.9 ? 'ok' : 'warn'} />
            <StatCard label="相关系数" value={result.agreement.correlation.toFixed(3)} icon="📈" />
            <StatCard label="冲突题数" value={result.agreement.conflicts} icon="⚠️" deltaType={result.agreement.conflicts ? 'warn' : 'ok'} />
            <StatCard label="平均分差" value={result.agreement.avg_diff} icon="⚖️" />
          </div>
          <div className="grid grid-2" style={{ alignItems: 'center' }}>
            {agreeOption && <div><EChart option={agreeOption} height={200} /></div>}
            <div>
              <div className={`kpi-badge ${result.agreement.agreement >= 0.9 ? 'kpi-ok' : 'kpi-miss'}`}>
                {result.agreement.agreement >= 0.9 ? '✓ 达到 ≥90% 硬指标' : `未达 90%（当前 ${(result.agreement.agreement * 100).toFixed(1)}%）`}
              </div>
              <div className="alert info mt16" style={{ lineHeight: 1.8 }}>{result.calibration?.message}</div>
            </div>
          </div>
        </div>
      )}
      {arbitrations.some(a => a.status === 'pending') && <div className="card mt16"><div className="card-title">待处理双评仲裁</div><div className="table-wrap"><table><thead><tr><th>会话 / 题目</th><th>一评</th><th>二评</th><th>分差</th><th>最终分</th><th>操作</th></tr></thead><tbody>{arbitrations.filter(a => a.status === 'pending').map(a => <tr key={a.id}><td>#{a.session_id} / #{a.question_id}</td><td>{a.first_score}</td><td>{a.second_score}</td><td>{a.score_diff}（阈值 {a.threshold}）</td><td><input className="input" style={{ width: 90 }} type="number" min="0" step="0.1" value={arbScores[a.id] ?? ''} onChange={e => setArbScores({ ...arbScores, [a.id]: e.target.value })} /></td><td><button className="btn sm primary" disabled={busyAnswer === `a${a.id}`} onClick={() => arbitrate(a)}>确认仲裁</button></td></tr>)}</tbody></table></div></div>}
    </div>
  )
}

