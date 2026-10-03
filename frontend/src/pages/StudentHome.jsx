import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { PageHeader, StatCard, Tag, Empty, Loading, toast } from '../components/ui'
import EChart from '../components/EChart'

const STATUS = {
  not_started: ['未开始', 'gray'], in_progress: ['进行中', 'blue'], submitted: ['已交卷', 'orange'],
  grading: ['评阅中', 'orange'], graded: ['已出分', 'green'], flagged: ['异常标记', 'red'],
}
const EXAM_TYPE = { online: '在线考试', scan: '扫描阅卷', paper: '纸笔考试' }

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

export default function StudentHome() {
  const [items, setItems] = useState(null)
  const [stats, setStats] = useState(null)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/exams/available').then((d) => setItems(d.items)).catch(() => setItems([]))
    api.get('/capability/my').then((d) => setStats(d.exists ? { match: d.match_score, level: d.overall_level, dims: d.dim_count, radar: d.radar || {} } : null)).catch(() => {})
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(u)
  }, [])

  const startExam = async (exam) => {
    try {
      await api.post(`/exams/${exam.id}/start`)
      toast.success('考试已创建，请遵守监考规则')
      navigate(`/exam-room/${exam.id}`)
    } catch (e) { toast.error(e.detail || '无法开考') }
  }

  const gradedExams = items ? items.filter((i) => i.my_status === 'graded' && i.my_score != null) : []

  // 成绩趋势图
  const scoreTrendOption = useMemo(() => {
    const recent = gradedExams.slice(-6)
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', textStyle: { color: '#374151', fontSize: 12 } },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: recent.length ? recent.map((_, i) => `考试${i + 1}`) : ['暂无数据'], axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#6b7280', fontSize: 11 } },
      yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } }, axisLabel: { color: '#6b7280', fontSize: 11 } },
      series: [{
        type: 'line', smooth: true, data: recent.length ? recent.map(e => e.my_score) : [0],
        itemStyle: { color: '#8b5cf6' },
        areaStyle: { color: 'rgba(139,92,246,0.15)' },
        label: { show: true, position: 'top', fontSize: 11, color: '#6b7280' }
      }]
    }
  }, [gradedExams])

  // 能力雷达图
  const radarOption = useMemo(() => {
    const dims = stats?.radar || {}
    const indicators = Object.entries(dims).slice(0, 6).map(([k, v]) => ({ name: k, max: 100 }))
    const values = Object.values(dims).slice(0, 6)
    if (indicators.length === 0) {
      indicators.push({ name: '暂无数据', max: 100 })
      values.push(0)
    }
    return {
      tooltip: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', textStyle: { color: '#374151', fontSize: 12 } },
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 4,
        axisName: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e5e7eb' } },
        splitArea: { areaStyle: { color: ['rgba(59,130,246,0.02)', 'rgba(59,130,246,0.05)'] } },
        axisLine: { lineStyle: { color: '#e5e7eb' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: values,
          name: '能力维度',
          areaStyle: { color: 'rgba(139,92,246,0.2)' },
          lineStyle: { color: '#8b5cf6', width: 2 },
          itemStyle: { color: '#8b5cf6' }
        }]
      }]
    }
  }, [stats])

  if (!items) return <Loading text="加载考试数据..." />

  const gradedCount = items.filter((i) => i.my_status === 'graded').length
  const pendingCount = items.filter((i) => i.my_status === 'not_started' || i.my_status === 'in_progress').length
  const avgScore = gradedExams.length ? Math.round(gradedExams.reduce((a, e) => a + e.my_score, 0) / gradedExams.length) : 0

  const today = new Date()
  const greeting = today.getHours() < 12 ? '上午好' : today.getHours() < 18 ? '下午好' : '晚上好'
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`

  return (
    <div>
      {/* 欢迎横幅 */}
      <div style={{
        background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 30%, #8b5cf6 60%, #a78bfa 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 4px 20px rgba(139,92,246,0.25)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 4 }}>{dateStr} · 星期{'日一二三四五六'[today.getDay()]}</div>
          <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0 }}>{greeting}，{user?.name || '同学'} 👋</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '8px 0 0' }}>
            你有 <b style={{ color: '#fff' }}>{pendingCount}</b> 场考试待参加，
            已完成 <b style={{ color: '#fff' }}>{gradedCount}</b> 场，平均分 <b style={{ color: '#fff' }}>{avgScore}</b> 分
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, position: 'relative', zIndex: 1 }}>
          <button onClick={() => navigate('/portrait')} style={{
            background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500,
            backdropFilter: 'blur(10px)', transition: 'all 0.2s'
          }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.15)'}>
            🧭 能力画像
          </button>
          <button onClick={() => navigate('/wrong-book')} style={{
            background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500,
            backdropFilter: 'blur(10px)', transition: 'all 0.2s'
          }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.15)'}>
            📚 错题本
          </button>
        </div>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 60, bottom: -60, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* 数据统计卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{
          background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>📝 待参加考试</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>{pendingCount}</div>
            <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>{pendingCount ? '请按时参加' : '暂无待考'}</div>
          </div>
          <MiniBars data={[1, 2, 1, 3, 2, pendingCount]} color="#f59e0b" />
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>✅ 已完成</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>{gradedCount}</div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>{gradedCount ? `共 ${gradedCount} 场已出分` : '暂无完成记录'}</div>
          </div>
          <MiniRing value={items.length ? (gradedCount / items.length) * 100 : 0} color="#10b981" />
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>📊 平均分</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: avgScore >= 80 ? '#10b981' : avgScore >= 60 ? '#f59e0b' : '#ef4444' }}>{avgScore || '--'}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{gradedExams.length ? `基于 ${gradedExams.length} 场考试` : '暂无成绩'}</div>
          </div>
          <MiniLine data={gradedExams.length ? gradedExams.slice(-5).map(e => e.my_score) : [0, 0, 0, 0, 0]} color={avgScore >= 80 ? '#10b981' : '#f59e0b'} />
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>🧭 能力画像匹配度</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{stats ? (stats.match * 100).toFixed(1) + '%' : '--'}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{stats ? `等级 ${stats.level} · ${stats.dims} 维` : '完成考试后自动生成'}</div>
          </div>
          <MiniRing value={stats ? stats.match * 100 : 0} color="#8b5cf6" />
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-2 mb16">
        <div className="card">
          <div className="card-title"><span>📈 成绩趋势</span><Tag color="purple" dot>近期考试</Tag></div>
          <EChart option={scoreTrendOption} height={260} />
        </div>
        <div className="card">
          <div className="card-title"><span>🎯 能力雷达</span><Tag color="purple" dot>能力维度</Tag></div>
          <EChart option={radarOption} height={260} />
        </div>
      </div>

      {/* 考试列表 */}
      <div className="card">
        <div className="card-title"><span>考试列表</span>{items.length > 0 && <Tag color="gray" dot>{items.length} 场考试</Tag>}</div>
        {items.length === 0 ? (
          <Empty icon="📭" title="暂无考试安排" desc="新的考试发布后将在此显示" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>考试名称</th><th>课程</th><th>类型</th><th>时长</th><th>状态</th><th className="num">成绩</th><th>操作</th></tr></thead>
              <tbody>
                {items.map((e) => {
                  const [label, color] = STATUS[e.my_status] || [e.my_status, 'gray']
                  return (
                    <tr key={e.id}>
                      <td><b>{e.title}</b></td>
                      <td>{e.course}</td>
                      <td><Tag color="cyan">{EXAM_TYPE[e.exam_type] || e.exam_type}</Tag></td>
                      <td className="font-mono">{e.duration_minutes} 分钟</td>
                      <td><Tag color={color} dot>{label}</Tag></td>
                      <td className="num">{e.my_score != null ? <b>{e.my_score}</b> : '--'}</td>
                      <td>
                        {e.my_status === 'not_started' && <button className="btn primary sm" onClick={() => startExam(e)}>进入考试</button>}
                        {e.my_status === 'in_progress' && <button className="btn primary sm" onClick={() => navigate(`/exam-room/${e.id}`)}>继续考试</button>}
                        {e.my_status === 'graded' && (
                          <div className="flex">
                            <button className="btn sm" onClick={() => navigate(`/result/${e.id}`)}>查看成绩</button>
                            <button className="btn sm" onClick={() => navigate('/portrait')}>能力画像</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
