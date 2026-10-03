import { useEffect, useState } from 'react'
import api from '../api'
import EChart from '../components/EChart'
import { PageHeader, Tag, Empty, Loading, StatCard, toast } from '../components/ui'

const TYPE_LABEL = { single_choice: '单选题', multiple_choice: '多选题', judge: '判断题', fill: '填空题', essay: '作文', translation: '翻译', oral: '口语', subjective: '主观题' }

export default function GradingQueue() {
  const [sessions, setSessions] = useState(null)
  const [detail, setDetail] = useState(null)
  const [scores, setScores] = useState({})
  const [feedback, setFeedback] = useState({})
  const [result, setResult] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => api.get('/exams/sessions').then((d) => setSessions(d.items.filter((s) => s.status === 'graded' || s.status === 'submitted')))

  useEffect(() => { load() }, [])

  const open = async (s) => {
    setSessionId(s.id)
    setResult(null)
    const d = await api.get(`/grading/session/${s.id}/detail`)
    setDetail(d)
    const sc = {}
    d.items.forEach((x) => { sc[x.question_id] = x.teacher_score ?? x.ai_score ?? '' })
    setScores(sc)
  }

  const submitTeacher = async () => {
    if (!sessionId) return
    setSubmitting(true)
    try {
      const numeric = {}
      Object.entries(scores).forEach(([qid, v]) => { if (v !== '') numeric[qid] = Number(v) })
      const r = await api.post(`/grading/session/${sessionId}/teacher`, { teacher_scores: numeric, teacher_feedback: feedback })
      setResult(r)
      load()
      toast.success(r.agreement.agreement >= 0.9 ? '一致性达标 ✓' : '已提交，一致性未达 90%，请查看校准建议')
    } catch (e) { toast.error(e.detail || '提交失败') } finally { setSubmitting(false) }
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
      <PageHeader title="AI 智能评阅" desc="AI 自动评阅 + 教师复核，实时计算判分一致性并给出校准建议" />

      <div className="grid grid-3 mb16">
        <StatCard label="评阅队列" value={sessions.length} icon="📥" delta="AI 已初评" />
        <StatCard label="已复核" value={reviewed.length} icon="✅" delta="教师已确认" />
        <StatCard label="异常标记" value={flagged.length} icon="⚠️" delta={flagged.length ? '存在疑似作弊' : '无异常'} deltaType={flagged.length ? 'warn' : 'ok'} />
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
              <div className="small muted mb16">修改分数后提交，系统自动计算一致性并给出校准建议。</div>
              <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th className="num">#</th><th>题型</th><th className="num">AI 分</th><th className="num">教师分</th></tr></thead>
                  <tbody>
                    {detail.items.map((x, i) => (
                      <tr key={x.question_id}>
                        <td className="num">{i + 1}</td>
                        <td><Tag color="gray">{TYPE_LABEL[x.type] || x.type}</Tag></td>
                        <td className="num">{x.ai_score ?? '--'}</td>
                        <td className="num"><input className="input" style={{ width: 76, textAlign: 'center' }} type="number" step="0.1" value={scores[x.question_id] ?? ''} onChange={(e) => setScores({ ...scores, [x.question_id]: e.target.value })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
    </div>
  )
}
