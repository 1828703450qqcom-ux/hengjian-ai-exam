import { useState } from 'react'
import { PageHeader, Tag, toast } from '../components/ui'

const LIVE_COURSES = [
  { id: 1, name: '大学英语四级冲刺班', teacher: '王老师', students: 256, status: 'live', start_time: '14:00', duration: '90分钟' },
  { id: 2, name: '高等数学专题讲解', teacher: '李教授', students: 189, status: 'live', start_time: '15:30', duration: '120分钟' },
  { id: 3, name: '计算机二级培训', teacher: '张老师', students: 342, status: 'upcoming', start_time: '明天 09:00', duration: '60分钟' },
  { id: 4, name: '英语口语练习课', teacher: '外教Smith', students: 78, status: 'upcoming', start_time: '明天 19:00', duration: '45分钟' },
]

const RECORDED_COURSES = [
  { id: 1, name: '大学英语 - 词汇辨析专题', teacher: '王老师', views: 1256, duration: '45:32', date: '2026-06-20' },
  { id: 2, name: '高等数学 - 积分计算技巧', teacher: '李教授', views: 980, duration: '62:15', date: '2026-06-18' },
  { id: 3, name: '计算机基础 - 数据结构入门', teacher: '张老师', views: 2340, duration: '55:20', date: '2026-06-15' },
]

export default function LiveClassroom() {
  const [activeTab, setActiveTab] = useState('live') // live / recorded / interactive
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [chatMessages, setChatMessages] = useState([
    { user: '张三', content: '老师，这个知识点能再讲一遍吗？', time: '14:25' },
    { user: '王老师', content: '好的，我再详细讲解一下...', time: '14:26', isTeacher: true },
    { user: '李四', content: '明白了，谢谢老师！', time: '14:28' },
  ])
  const [chatInput, setChatInput] = useState('')

  const sendMessage = () => {
    if (!chatInput.trim()) return
    setChatMessages([...chatMessages, { user: '我', content: chatInput, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }])
    setChatInput('')
    toast.success('消息已发送')
  }

  return (
    <div>
      <PageHeader
        title="🎥 直播课堂集成"
        subtitle="在线直播授课 · 课堂互动 · 课程录播回放"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['live', '🔴 直播中'], ['recorded', '📹 录播回放'], ['interactive', '💬 互动课堂']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#1e40af' : '#6b7280', fontWeight: activeTab === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 统计 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fecaca' }}>
          <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 6 }}>🔴 正在直播</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#991b1b' }}>2<span style={{ fontSize: 14, color: '#6b7280' }}>场</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>👥 在线学习人数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>445</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>📹 录播课程</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>128<span style={{ fontSize: 14, color: '#6b7280' }}>门</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>📊 累计观看</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>12.5<span style={{ fontSize: 14, color: '#6b7280' }}>万次</span></div>
        </div>
      </div>

      {/* 直播中 */}
      {activeTab === 'live' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div>
            {/* 直播播放器 */}
            <div className="card mb16" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#1a1a2e' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>🎥</div>
                  <div style={{ fontSize: 18, color: '#fff', marginBottom: 4 }}>大学英语四级冲刺班</div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>王老师 · 256人在线</div>
                </div>
                <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 6, background: '#ef4444', color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                  直播中
                </div>
                <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: 4, fontSize: 12 }}>
                  👁️ 256人观看
                </div>
              </div>
              {/* 控制栏 */}
              <div style={{ padding: 12, background: '#f8fafc', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn sm primary">▶️ 播放</button>
                <span style={{ fontSize: 12, color: '#6b7280' }}>00:45:32 / 01:30:00</span>
                <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '50%', height: '100%', background: '#3b82f6' }} />
                </div>
                <button className="btn sm">🔊 音量</button>
                <button className="btn sm">⛶ 全屏</button>
              </div>
            </div>

            {/* 直播列表 */}
            <div className="card">
              <div className="card-title"><span>📺 直播课程列表</span><button className="btn sm primary" onClick={() => toast.success('创建直播对话框已打开')}>+ 发起直播</button></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>课程名称</th><th>授课教师</th><th>在线人数</th><th>开始时间</th><th>时长</th><th>状态</th><th>操作</th></tr></thead>
                  <tbody>
                    {LIVE_COURSES.map(course => (
                      <tr key={course.id}>
                        <td><b>{course.name}</b></td>
                        <td>{course.teacher}</td>
                        <td className="num">{course.students}人</td>
                        <td className="small muted">{course.start_time}</td>
                        <td>{course.duration}</td>
                        <td><Tag color={course.status === 'live' ? 'red' : 'orange'}>{course.status === 'live' ? '🔴 直播中' : '⏳ 即将开始'}</Tag></td>
                        <td><button className="btn sm primary" onClick={() => setSelectedCourse(course)}>{course.status === 'live' ? '进入直播' : '预约提醒'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 互动聊天 */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 600 }}>
            <div className="card-title"><span>💬 课堂互动</span><Tag color="green">{chatMessages.length}条消息</Tag></div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ padding: '8px 10px', background: msg.isTeacher ? '#fef3c7' : '#f8fafc', borderRadius: 8, borderLeft: `3px solid ${msg.isTeacher ? '#f59e0b' : '#3b82f6'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: msg.isTeacher ? '#92400e' : '#1f2937' }}>{msg.user}{msg.isTeacher && ' 👨‍🏫'}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{msg.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>{msg.content}</div>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 12, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
              <input className="input sm" placeholder="输入消息..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} style={{ flex: 1 }} />
              <button className="btn sm primary" onClick={sendMessage}>发送</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn sm" style={{ flex: 1, fontSize: 11 }}>✋ 举手</button>
              <button className="btn sm" style={{ flex: 1, fontSize: 11 }}>👍 点赞</button>
              <button className="btn sm" style={{ flex: 1, fontSize: 11 }}>❓ 提问</button>
            </div>
          </div>
        </div>
      )}

      {/* 录播回放 */}
      {activeTab === 'recorded' && (
        <div className="card">
          <div className="card-title"><span>📹 录播课程回放</span></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {RECORDED_COURSES.map(course => (
              <div key={course.id} style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                <div style={{ position: 'relative', paddingBottom: '56.25%', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}>▶️</div>
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{course.duration}</div>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{course.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{course.teacher} · {course.date}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>👁️ {course.views}次观看</span>
                    <button className="btn sm primary">立即观看</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 互动课堂 */}
      {activeTab === 'interactive' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>✋ 课堂签到</span></div>
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>今日签到已完成</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>签到时间: 14:02:35 · 连续签到 28 天</div>
            </div>
          </div>
          <div className="card">
            <div className="card-title"><span>📊 课堂答题统计</span></div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>本次课堂答题</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#3b82f6' }}>正确率 78%</span>
              </div>
              {['第1题', '第2题', '第3题', '第4题', '第5题'].map((q, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{q}</span>
                    <span style={{ color: [85, 92, 68, 75, 70][i] >= 70 ? '#10b981' : '#f59e0b' }}>{[85, 92, 68, 75, 70][i]}%</span>
                  </div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${[85, 92, 68, 75, 70][i]}%`, height: '100%', background: [85, 92, 68, 75, 70][i] >= 70 ? '#10b981' : '#f59e0b', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
