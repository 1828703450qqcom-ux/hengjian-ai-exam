import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import EChart from '../components/EChart'
import { PageHeader, StatCard, Tag, Loading, Empty, toast } from '../components/ui'

const LEVEL_COLOR = { 优秀: 'green', 良好: 'blue', 合格: 'orange', 待提高: 'red' }
const TYPE_LABEL = { single_choice: '单选题', multiple_choice: '多选题', judge: '判断题', fill: '填空题', essay: '作文', translation: '翻译', oral: '口语', subjective: '主观题' }

export default function ExamResult() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [session, setSession] = useState(null)
  const [report, setReport] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await api.get('/auth/me')
        const sessions = await api.get('/exams/sessions')
        const s = sessions.items.find((x) => x.exam_id === Number(examId) && x.user_id === me.id)
        if (!s) { setError('未找到本场考试成绩'); return }
        setSession(s)
        const [d, rep] = await Promise.all([
          api.get(`/grading/session/${s.id}/detail`),
          api.get(`/proctor/session/${s.id}/report`).catch(() => null),
        ])
        setDetail(d.items)
        setReport(rep)
        setData(d.session)
      } catch (e) { setError(e.detail || '加载失败'); toast.error('成绩加载失败') }
    }
    load()
  }, [examId])

  if (error) return <Empty icon="🔍" title={error} desc="未找到本场考试成绩" action={<button className="btn" onClick={() => navigate('/')}>返回工作台</button>} />
  if (!data || !detail) return <Loading text="加载成绩与监考报告..." />

  const buildDistribution = () => {
    const cats = { 客观题: { n: 0, sum: 0 }, 主观题: { n: 0, sum: 0 }, 口语: { n: 0, sum: 0 } }
    detail.forEach((x) => {
      const key = x.type === 'oral' ? '口语' : ['single_choice', 'multiple_choice', 'judge', 'fill'].includes(x.type) ? '客观题' : '主观题'
      cats[key].n++; cats[key].sum += x.score
    })
    return Object.entries(cats).filter(([, v]) => v.n > 0).map(([k, v]) => ({ name: k, value: Math.round((v.sum / v.n) * 10) / 10, n: v.n }))
  }

  const barOption = detail.length ? {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: detail.map((x) => `#${x.question_id}`), axisLabel: { interval: 0, rotate: 40, color: '#94a3b8' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    legend: { top: 0, textStyle: { color: '#64748b' } },
    series: [
      { name: 'AI 评分', type: 'bar', data: detail.map((x) => x.ai_score || 0), itemStyle: { color: '#1e6fff', borderRadius: [4, 4, 0, 0] }, barWidth: 14 },
      { name: '教师评分', type: 'bar', data: detail.map((x) => x.teacher_score ?? null), itemStyle: { color: '#16a34a', borderRadius: [4, 4, 0, 0] }, barWidth: 14 },
    ],
  } : null

  const distData = buildDistribution()
  const pieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#64748b' } },
    series: [{ type: 'pie', radius: ['40%', '68%'], data: distData.map((x) => ({ name: `${x.name}(${x.n}题 均分${x.value})`, value: x.value })), label: { fontSize: 11 } }],
  }

  return (
    <div>
      <PageHeader title="考试成绩" desc={`${session?.student || ''} · ${session?.exam_title || ''}`} crumb={['考生中心', '考试成绩']} />

      <div className="grid grid-4 mb16">
        <StatCard label="总分" value={data.final_score ?? '--'} icon="🎓" delta={`AI 评分 ${data.ai_score ?? '--'}`} />
        <StatCard label="AI·教师一致性" value={`${Math.round((data.agreement_rate ?? 1) * 100)}%`} icon="🎯" delta="目标 ≥90%" deltaType={(data.agreement_rate ?? 1) >= 0.9 ? 'ok' : 'warn'} />
        <StatCard label="监考风险" value={session.is_flagged ? '疑似作弊' : '正常'} icon={session.is_flagged ? '⚠️' : '🛡️'} delta={`判定置信度 ${Math.round((session.cheat_confidence || 0) * 100)}%`} deltaType={session.is_flagged ? 'warn' : 'ok'} />
        <StatCard label="能力画像" value="已生成" icon="🧭" delta={<button className="btn sm mt8" onClick={() => navigate('/portrait')}>查看画像 →</button>} />
      </div>

      {session.is_flagged && (
        <div className="alert danger mb16">⚠ 本场考试被多模态监考系统标记为疑似作弊，已生成可追溯证据链，请管理员重点复核。</div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title"><span>各题得分（AI vs 教师）</span><Tag color="blue" dot>详细对账</Tag></div>
          {barOption && <EChart option={barOption} height={300} />}
        </div>
        <div className="card">
          <div className="card-title"><span>题型得分率</span></div>
          <EChart option={pieOption} height={300} />
        </div>
      </div>

      <div className="card mt16">
        <div className="card-title"><span>作答明细</span><Tag color="gray">{detail.length} 题</Tag></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>题号</th><th>题型</th><th>题干</th><th className="num">AI 分</th><th className="num">教师分</th><th>AI 反馈</th><th>状态</th></tr></thead>
            <tbody>
              {detail.map((x, i) => (
                <tr key={i}>
                  <td className="num">{i + 1}</td>
                  <td><Tag color="gray">{TYPE_LABEL[x.type] || x.type}</Tag></td>
                  <td style={{ maxWidth: 260 }}>{String(x.stem).slice(0, 40)}...</td>
                  <td className="num">{x.ai_score ?? '--'}</td>
                  <td className="num">{x.teacher_score ?? '--'}</td>
                  <td className="small muted" style={{ maxWidth: 300 }}>{x.ai_feedback || '--'}</td>
                  <td><Tag color={x.grading_status === 'auto_graded' ? 'blue' : x.grading_status === 'teacher_graded' ? 'green' : 'gray'}>{x.grading_status === 'auto_graded' ? 'AI 自动评阅' : x.grading_status === 'teacher_graded' ? '教师复核' : '待评'}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {report && (
        <div className="card mt16">
          <div className="card-title"><span>监考报告 · 可追溯证据链</span><Tag color="red" dot>{report.alert_count || 0} 次预警</Tag></div>
          <div className="grid grid-4 mb16">
            <StatCard label="采集事件" value={report.event_count} icon="📡" />
            <StatCard label="预警次数" value={report.alert_count} icon="🚨" deltaType={report.alert_count ? 'warn' : 'ok'} />
            <StatCard label="融合风险分" value={report.risk_score} icon="📊" />
            <StatCard label="活体识别率" value={`${Math.round(report.liveness_accuracy * 100)}%`} icon="👁️" deltaType="ok" />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>事件类型</th><th className="num">置信度</th><th>严重度</th><th>时间</th><th>描述</th></tr></thead>
              <tbody>
                {(report.events || []).map((e, i) => (
                  <tr key={i}>
                    <td><code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{e.event_type}</code></td>
                    <td className="num">{Math.round(e.confidence * 100)}%</td>
                    <td><Tag color={e.severity === 'critical' ? 'red' : e.severity === 'high' ? 'orange' : e.severity === 'medium' ? 'blue' : 'gray'}>{e.severity}</Tag></td>
                    <td className="small">{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td className="small muted">{e.detail?.desc || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

