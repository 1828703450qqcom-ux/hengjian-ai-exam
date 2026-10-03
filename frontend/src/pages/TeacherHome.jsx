import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { PageHeader, StatCard, Tag, Empty, Loading, Progress } from '../components/ui'
import EChart from '../components/EChart'

function MiniRing({ value, max = 100, color = '#3b82f6', size = 48 }) {
  const pct = Math.min(100, (value / max) * 100)
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1f2937">{Math.round(pct)}%</text>
    </svg>
  )
}

function MiniBars({ data, color = '#3b82f6', height = 40 }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, flexShrink: 0 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          width: 6, height: `${(v / max) * 100}%`, minHeight: 3,
          background: color, borderRadius: 2, opacity: 0.4 + (i / data.length) * 0.6
        }} />
      ))}
    </div>
  )
}

function MiniLine({ data, color = '#3b82f6', width = 80, height = 40 }) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2
    const y = height - 2 - ((v - min) / range) * (height - 6)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width - 2} cy={height - 2 - ((data[data.length - 1] - min) / range) * (height - 6)} r="3" fill={color} />
    </svg>
  )
}

export default function TeacherHome() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [papers, setPapers] = useState([])
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/dashboard/statistics').then(setStats).catch(() => {})
    api.get('/exams/sessions').then((d) => setSessions(d.items)).catch(() => [])
    api.get('/papers').then((d) => setPapers(d.items)).catch(() => [])
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(u)
  }, [])

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { data: ['提交', '评阅', '异常'], right: 10, top: 0, textStyle: { color: '#6b7280', fontSize: 12 } },
    grid: { left: 40, right: 20, top: 35, bottom: 25 },
    xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f3f4f6' } }, axisLabel: { color: '#6b7280', fontSize: 11 } },
    series: [
      { name: '提交', type: 'line', smooth: true, data: [12, 18, 15, 22, 28, 8, 5], itemStyle: { color: '#3b82f6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.25)' }, { offset: 1, color: 'rgba(59,130,246,0.02)' }] } } },
      { name: '评阅', type: 'line', smooth: true, data: [10, 16, 14, 20, 25, 6, 4], itemStyle: { color: '#10b981' } },
      { name: '异常', type: 'line', smooth: true, data: [1, 2, 0, 3, 1, 0, 0], itemStyle: { color: '#f59e0b' } }
    ]
  }), [])

  const subjectOption = useMemo(() => {
    const courseScores = {}
    papers.forEach(p => { courseScores[p.course] = (courseScores[p.course] || 0) + 1 })
    const entries = Object.entries(courseScores).slice(0, 6)
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', textStyle: { color: '#374151', fontSize: 12 } },
      grid: { left: 80, right: 30, top: 10, bottom: 20 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f3f4f6' } }, axisLabel: { color: '#6b7280', fontSize: 11 } },
      yAxis: { type: 'category', data: entries.map(e => e[0]).reverse(), axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#374151', fontSize: 12 } },
      series: [{ type: 'bar', data: entries.map((e, i) => ({ value: e[1], itemStyle: { color: colors[i % colors.length], borderRadius: [0, 4, 4, 0] } })).reverse(), barWidth: 16, label: { show: true, position: 'right', color: '#6b7280', fontSize: 11 } }]
    }
  }, [papers])

  if (!sessions) return <Loading text="加载教学工作台..." />

  const pending = sessions.filter((s) => s.status === 'submitted' || s.status === 'grading')
  const graded = sessions.filter((s) => s.status === 'graded')
  const flagged = sessions.filter((s) => s.is_flagged)
  const reviewed = graded.filter((s) => s.agreement_rate != null)
  const avgAgree = reviewed.length ? (reviewed.reduce((a, s) => a + (s.agreement_rate || 0), 0) / reviewed.length) : 0
  const reviewRate = graded.length ? reviewed.length / graded.length : 0

  const today = new Date()
  const greeting = today.getHours() < 12 ? '上午好' : today.getHours() < 18 ? '下午好' : '晚上好'
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`

  return (
    <div>
      {/* 欢迎横幅 */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 4px 20px rgba(59,130,246,0.25)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 4 }}>{dateStr} · 星期{'日一二三四五六'[today.getDay()]}</div>
          <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0 }}>{greeting}，{user?.name || '老师'} 👋</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '8px 0 0' }}>
            今天有 <b style={{ color: '#fff' }}>{pending.length}</b> 份试卷待评阅，
            <b style={{ color: '#fff' }}> {flagged.length}</b> 条异常标记需要处理
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, position: 'relative', zIndex: 1 }}>
          <button onClick={() => navigate('/exam-management')} style={{
            background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500,
            backdropFilter: 'blur(10px)', transition: 'all 0.2s'
          }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.15)'}>
            📋 创建考试
          </button>
          <button onClick={() => navigate('/paper-assembly')} style={{
            background: '#fff', color: '#1e40af', border: 'none',
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.2s'
          }} onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'} onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
            📝 智能组卷
          </button>
        </div>
        {/* 装饰圆 */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 60, bottom: -60, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* 数据统计卡片 - 带迷你图表 */}
      <div className="grid grid-4 mb16">
        <div style={{
          background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>📥 待评阅试卷</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>{pending.length}</div>
            <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>AI 已初评，待复核</div>
          </div>
          <MiniBars data={[3, 5, 2, 7, 4, 6, pending.length]} color="#f59e0b" />
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>✅ 已评阅</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>{graded.length}</div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>教师复核率 {Math.round(reviewRate * 100)}%</div>
          </div>
          <MiniRing value={reviewRate * 100} color="#10b981" />
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>🎯 AI·教师一致性</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: avgAgree >= 0.9 ? '#10b981' : '#f59e0b' }}>
              {reviewed.length ? Math.round(avgAgree * 100) + '%' : '--'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>目标 ≥90% · 已复核 {reviewed.length} 份</div>
          </div>
          <MiniRing value={avgAgree * 100} color={avgAgree >= 0.9 ? '#10b981' : '#f59e0b'} />
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>⚠️ 异常标记</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: flagged.length ? '#ef4444' : '#10b981' }}>{flagged.length}</div>
            <div style={{ fontSize: 12, color: flagged.length ? '#ef4444' : '#10b981', marginTop: 4 }}>{flagged.length ? '存在疑似作弊，请复核' : '无异常'}</div>
          </div>
          <MiniLine data={[0, 1, 0, 2, 1, 0, flagged.length]} color={flagged.length ? '#ef4444' : '#10b981'} />
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-2 mb16">
        <div className="card">
          <div className="card-title"><span>📊 本周考试趋势</span><Tag color="blue" dot>近7天</Tag></div>
          <EChart option={trendOption} height={260} />
        </div>
        <div className="card">
          <div className="card-title"><span>📚 课程试卷分布</span><Tag color="purple" dot>按课程</Tag></div>
          <EChart option={subjectOption} height={260} />
        </div>
      </div>

      {/* 表格区域 */}
      <div className="grid grid-2 mb16">
        <div className="card">
          <div className="card-title"><span>试卷库</span><button className="btn primary sm" onClick={() => navigate('/paper-assembly')}>+ 智能组卷</button></div>
          {papers.length === 0 ? <Empty icon="📄" title="暂无试卷" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>试卷</th><th>课程</th><th className="num">总分</th><th>难度</th></tr></thead>
                <tbody>
                  {papers.slice(0, 6).map((p) => (
                    <tr key={p.id}>
                      <td><b>{p.title}</b></td><td>{p.course}</td>
                      <td className="num">{p.total_score}</td>
                      <td><Tag color={p.difficulty >= 4 ? 'red' : p.difficulty >= 3 ? 'orange' : 'green'}>{p.difficulty}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title"><span>AI 评阅队列</span><button className="btn sm" onClick={() => navigate('/grading')}>进入评阅 →</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>考生</th><th>状态</th><th className="num">AI 分</th><th>一致性</th></tr></thead>
              <tbody>
                {sessions.slice(0, 8).map((s) => (
                  <tr key={s.id} className={s.is_flagged ? 'row-flagged' : ''}>
                    <td><b>{s.student}</b></td>
                    <td><Tag color={s.is_flagged ? 'red' : s.status === 'graded' ? 'green' : 'orange'} dot>{s.is_flagged ? '异常' : s.status === 'graded' ? '已评' : '待评'}</Tag></td>
                    <td className="num">{s.ai_score ?? '--'}</td>
                    <td>{s.agreement_rate != null ? <Tag color={s.agreement_rate >= 0.9 ? 'green' : 'orange'}>{Math.round(s.agreement_rate * 100)}%</Tag> : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {stats && (
        <div className="card">
          <div className="card-title"><span>平台数据概览</span><Tag color="blue" dot>实时</Tag></div>
          <div className="grid grid-4">
            <div><div className="label muted">题目总数</div><div className="value hl">{stats.questions || 0}</div></div>
            <div><div className="label muted">能力画像</div><div className="value hl">{stats.snapshots || 0}</div></div>
            <div><div className="label muted">已评阅会话</div><div className="value hl">{stats.graded || 0}</div></div>
            <div><div className="label muted">异常标记</div><div className="value hl" style={{ color: stats.flagged ? '#dc2626' : '' }}>{stats.flagged || 0}</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
