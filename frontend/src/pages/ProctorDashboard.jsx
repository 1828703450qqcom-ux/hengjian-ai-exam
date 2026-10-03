import { useState, useEffect, useCallback } from 'react'
import api from '../api'

export default function ProctorDashboard() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, sessionsRes] = await Promise.all([
        api.get('/proctor/admin/stats'),
        api.get('/proctor/admin/active-sessions')
      ])
      setStats(statsRes)
      setSessions(sessionsRes.sessions || [])
      setLastUpdate(new Date())
      setLoading(false)
    } catch (e) {
      console.error('获取监控数据失败:', e)
      setLoading(false)
    }
  }, [])

  const fetchSessionDetail = async (sid) => {
    try {
      const res = await api.get(`/proctor/admin/session/${sid}/detail`)
      setSelectedSession(res)
    } catch (e) {
      console.error('获取会话详情失败:', e)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(fetchData, 5000)
    return () => clearInterval(timer)
  }, [autoRefresh, fetchData])

  const getRiskColor = (level) => {
    if (level === 'critical') return '#dc2626'
    if (level === 'high') return '#ea580c'
    if (level === 'medium') return '#ca8a04'
    return '#16a34a'
  }

  const getSeverityBadge = (severity) => {
    const colors = { critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#6b7280' }
    return <span style={{ background: colors[severity] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{severity}</span>
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>加载监控数据中...</div>
  }

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1f2937', margin: 0 }}>实时监考中心</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>
            最后更新: {lastUpdate?.toLocaleTimeString()} 
            <span style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: autoRefresh ? '#16a34a' : '#9ca3af', animation: autoRefresh ? 'pulse 2s infinite' : 'none' }}></span>
              {autoRefresh ? '实时刷新中(5s)' : '已暂停'}
            </span>
          </p>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: autoRefresh ? '#fef3c7' : '#fff', cursor: 'pointer', fontSize: 14 }}
        >
          {autoRefresh ? '⏸ 暂停刷新' : '▶ 开始刷新'}
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', padding: 20, borderRadius: 12, color: '#fff' }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>考试总会话</div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{stats.total_sessions}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>今日新增 {stats.today_sessions}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: 20, borderRadius: 12, color: '#fff' }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>进行中考试</div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{stats.active_sessions}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>实时监控中</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: 20, borderRadius: 12, color: '#fff' }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>标记异常</div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{stats.flagged_sessions}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>标记率 {stats.flag_rate}%</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: 20, borderRadius: 12, color: '#fff' }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>高严重度事件</div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{stats.high_severity_events}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>总事件 {stats.total_events}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedSession ? '1fr 400px' : '1fr', gap: 20 }}>
        {/* 活跃会话列表 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>考生监控列表 ({sessions.length})</h2>
            <span style={{ fontSize: 12, color: '#6b7280' }}>点击查看详情</span>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {sessions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
                当前没有进行中的考试
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.session_id}
                  onClick={() => fetchSessionDetail(s.session_id)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: selectedSession?.session?.id === s.session_id ? '#eff6ff' : '#fff',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: '#1f2937' }}>{s.student_name}</span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{s.student_no}</span>
                        {s.is_flagged && (
                          <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
                            ⚠ 已标记
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        考试ID: {s.exam_id} | 开始: {s.start_time ? new Date(s.start_time).toLocaleTimeString() : '-'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: getRiskColor(s.risk_level) }}></span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: getRiskColor(s.risk_level) }}>
                          {s.risk_level || 'normal'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        违规 {s.violation_count} 次
                      </div>
                    </div>
                  </div>
                  {/* 最近事件 */}
                  {s.recent_events && s.recent_events.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.recent_events.slice(0, 3).map((e, i) => (
                        <span key={i} style={{ fontSize: 11, color: '#6b7280', background: '#f9fafb', padding: '2px 6px', borderRadius: 4 }}>
                          {e.type.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 会话详情面板 */}
        {selectedSession && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', position: 'sticky', top: 20, alignSelf: 'start' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>监控详情</h2>
              <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>×</button>
            </div>
            <div style={{ padding: 20, maxHeight: 560, overflowY: 'auto' }}>
              {/* 考生信息 */}
              {selectedSession.student && (
                <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedSession.student.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {selectedSession.student.student_no} | {selectedSession.student.college}
                  </div>
                </div>
              )}

              {/* 风险状态 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>风险状态</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: getRiskColor(selectedSession.session.risk_level), color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>
                    {selectedSession.session.risk_level || 'normal'}
                  </span>
                  {selectedSession.session.is_flagged && (
                    <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid #fecaca' }}>
                      已标记异常
                    </span>
                  )}
                  <span style={{ background: '#f3f4f6', color: '#374151', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>
                    置信度 {(selectedSession.session.cheat_confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* 事件统计 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
                  事件统计 (共{selectedSession.total_events}条，高严重度{selectedSession.high_severity_count}条)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Object.entries(selectedSession.event_stats || {}).slice(0, 8).map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f9fafb', borderRadius: 4, fontSize: 12 }}>
                      <span style={{ color: '#6b7280' }}>{type.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 600, color: '#374151' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 最近事件 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>最近事件</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(selectedSession.events || []).slice(-10).reverse().map((e) => (
                    <div key={e.id} style={{ padding: '8px 10px', background: '#f9fafb', borderRadius: 6, borderLeft: `3px solid ${e.severity === 'critical' ? '#dc2626' : e.severity === 'high' ? '#ea580c' : '#d1d5db'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{e.type.replace(/_/g, ' ')}</span>
                        {getSeverityBadge(e.severity)}
                      </div>
                      {e.detail?.desc && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{e.detail.desc}</div>}
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{e.time ? new Date(e.time).toLocaleTimeString() : '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

