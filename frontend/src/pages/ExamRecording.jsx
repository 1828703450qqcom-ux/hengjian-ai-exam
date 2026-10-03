import { useState, useEffect } from 'react'
import { PageHeader, Tag, toast } from '../components/ui'

const RECORDINGS = [
  { id: 1, exam: '大学英语期末考试', student: '张三', student_no: '202401001', start_time: '2026-06-20 09:00:00', duration: '1:58:32', status: 'normal', events: 0, size: '256MB' },
  { id: 2, exam: '大学英语期末考试', student: '李四', student_no: '202401002', start_time: '2026-06-20 09:01:15', duration: '1:45:20', status: 'warning', events: 3, size: '234MB' },
  { id: 3, exam: '大学英语期末考试', student: '王五', student_no: '202401003', start_time: '2026-06-20 09:02:30', duration: '2:00:00', status: 'danger', events: 8, size: '268MB' },
  { id: 4, exam: '高等数学期末考试', student: '赵六', student_no: '202401004', start_time: '2026-06-22 14:00:00', duration: '1:52:10', status: 'normal', events: 0, size: '245MB' },
  { id: 5, exam: '高等数学期末考试', student: '钱七', student_no: '202401005', start_time: '2026-06-22 14:01:45', duration: '1:38:45', status: 'warning', events: 2, size: '220MB' },
]

const ABNORMAL_EVENTS = [
  { time: '00:15:32', type: 'face_disappear', label: '人脸消失', severity: 'warning', description: '摄像头中未检测到人脸，持续5秒' },
  { time: '00:32:18', type: 'multiple_people', label: '多人出现', severity: 'danger', description: '检测到画面中有2个人' },
  { time: '00:45:50', type: 'screen_switch', label: '切屏', severity: 'warning', description: '检测到切屏操作，持续3秒' },
  { time: '01:02:15', type: 'abnormal_voice', label: '声音异常', severity: 'warning', description: '检测到异常声音（疑似说话）' },
  { time: '01:18:40', type: 'object_detected', label: '禁带物品', severity: 'danger', description: '检测到手机' },
  { time: '01:35:22', type: 'gaze_off', label: '视线偏离', severity: 'warning', description: '视线长时间偏离屏幕' },
  { time: '01:48:05', type: 'head_pose', label: '头部异常', severity: 'warning', description: '头部偏航角度过大' },
  { time: '01:55:30', type: 'mouth_talking', label: '疑似说话', severity: 'warning', description: '检测到嘴巴持续张开' },
]

export default function ExamRecording() {
  const [recordings, setRecordings] = useState(RECORDINGS)
  const [selectedRecording, setSelectedRecording] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState('list') // list / playback

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const parseDuration = (durationStr) => {
    const parts = durationStr.split(':')
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
  }

  const openPlayback = (recording) => {
    setSelectedRecording(recording)
    setCurrentTime(0)
    setIsPlaying(false)
    setActiveTab('playback')
  }

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const seekTo = (time) => {
    setCurrentTime(time)
  }

  const exportEvidence = () => {
    toast.success('证据包已导出，包含视频、日志、截图')
  }

  const currentEvents = selectedRecording ? ABNORMAL_EVENTS.slice(0, selectedRecording.events) : []

  return (
    <div>
      <PageHeader
        title="🎥 考试录制与回放系统"
        subtitle="全程录屏+摄像头录像+操作日志 · 异常事件自动标记 · 证据链可追溯"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['list', '📋 录制列表'], ['playback', '▶️ 回放中心']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#1e40af' : '#6b7280', fontWeight: activeTab === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 统计卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>📹 总录制数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{recordings.length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 正常录制</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{recordings.filter(r => r.status === 'normal').length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>⚠️ 异常事件</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{recordings.reduce((a, r) => a + r.events, 0)}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>💾 总存储量</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>1.2GB</div>
        </div>
      </div>

      {/* 录制列表 */}
      {activeTab === 'list' && (
        <div className="card">
          <div className="card-title"><span>📋 考试录制列表</span><Tag color="gray">{recordings.length}条记录</Tag></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>考试</th><th>学生</th><th>学号</th><th>开始时间</th><th>时长</th><th>状态</th><th>异常事件</th><th>大小</th><th>操作</th></tr></thead>
              <tbody>
                {recordings.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.exam}</b></td>
                    <td>{r.student}</td>
                    <td className="small muted">{r.student_no}</td>
                    <td className="small muted">{r.start_time}</td>
                    <td>{r.duration}</td>
                    <td><Tag color={r.status === 'normal' ? 'green' : r.status === 'warning' ? 'orange' : 'red'}>{r.status === 'normal' ? '正常' : r.status === 'warning' ? '异常' : '严重异常'}</Tag></td>
                    <td className="num" style={{ color: r.events > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{r.events}</td>
                    <td className="small muted">{r.size}</td>
                    <td>
                      <div className="flex">
                        <button className="btn sm primary" onClick={() => openPlayback(r)}>▶️ 回放</button>
                        <button className="btn sm" onClick={exportEvidence}>导出证据</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 回放中心 */}
      {activeTab === 'playback' && (
        <div>
          {!selectedRecording ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎥</div>
              <div style={{ fontSize: 16, color: '#6b7280' }}>从"录制列表"选择一条记录开始回放</div>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: '1fr 320px', gap: 16 }}>
              {/* 视频回放区域 */}
              <div className="card">
                <div className="card-title">
                  <span>▶️ 回放 - {selectedRecording.student} ({selectedRecording.student_no})</span>
                  <Tag color={selectedRecording.status === 'normal' ? 'green' : selectedRecording.status === 'warning' ? 'orange' : 'red'}>{selectedRecording.status === 'normal' ? '正常' : selectedRecording.status === 'warning' ? '异常' : '严重异常'}</Tag>
                </div>
                {/* 模拟视频画面 */}
                <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#1a1a2e', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: '#666' }}>
                      <div style={{ fontSize: 64, marginBottom: 12 }}>📹</div>
                      <div style={{ fontSize: 14 }}>考试录制回放</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{selectedRecording.exam}</div>
                    </div>
                  </div>
                  {/* 时间戳 */}
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>
                    {formatTime(currentTime)}
                  </div>
                  {/* 录制状态 */}
                  <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.8)', color: '#fff', padding: '4px 10px', borderRadius: 4, fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                    REC
                  </div>
                  {/* 异常事件标记 */}
                  {currentEvents.filter(e => Math.abs(parseDuration(e.time) - currentTime) < 5).map(e => (
                    <div key={e.time} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: e.severity === 'danger' ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.9)', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 16, fontWeight: 600, animation: 'bounce 0.5s' }}>
                      ⚠️ {e.label}
                    </div>
                  ))}
                </div>
                {/* 播放控制 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <button onClick={togglePlay} style={{ width: 48, height: 48, borderRadius: '50%', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <span style={{ fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>{formatTime(currentTime)}</span>
                  <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, position: 'relative', cursor: 'pointer' }} onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const percent = (e.clientX - rect.left) / rect.width
                    seekTo(Math.floor(percent * parseDuration(selectedRecording.duration)))
                  }}>
                    <div style={{ width: `${(currentTime / parseDuration(selectedRecording.duration)) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                    {/* 异常事件标记点 */}
                    {currentEvents.map(e => (
                      <div key={e.time} style={{ position: 'absolute', left: `${(parseDuration(e.time) / parseDuration(selectedRecording.duration)) * 100}%`, top: -3, width: 4, height: 12, background: e.severity === 'danger' ? '#ef4444' : '#f59e0b', borderRadius: 2, cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); seekTo(parseDuration(e.time)) }} title={`${e.time} - ${e.label}`} />
                    ))}
                  </div>
                  <span style={{ fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>{selectedRecording.duration}</span>
                  <button onClick={exportEvidence} className="btn sm" style={{ marginLeft: 'auto' }}>📦 导出证据包</button>
                </div>
                {/* 双画面说明 */}
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#3b82f6', borderRadius: 2 }} />屏幕录制</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#8b5cf6', borderRadius: 2 }} />摄像头录像</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 2 }} />麦克风录音</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 2 }} />操作日志</span>
                </div>
              </div>

              {/* 异常事件时间轴 */}
              <div className="card">
                <div className="card-title"><span>⚠️ 异常事件时间轴</span><Tag color={selectedRecording.events > 5 ? 'red' : 'orange'}>{selectedRecording.events}个事件</Tag></div>
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {currentEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#10b981' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <div style={{ fontSize: 13 }}>无异常事件</div>
                    </div>
                  ) : (
                    currentEvents.map((e, i) => (
                      <div key={i} onClick={() => seekTo(parseDuration(e.time))}
                        style={{ padding: '10px 12px', marginBottom: 8, background: currentTime === parseDuration(e.time) ? '#eff6ff' : '#f8fafc', borderRadius: 8, borderLeft: `3px solid ${e.severity === 'danger' ? '#ef4444' : '#f59e0b'}`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{e.label}</span>
                          <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{e.time}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{e.description}</div>
                        <Tag color={e.severity === 'danger' ? 'red' : 'orange'} style={{ fontSize: 10, marginTop: 4 }}>{e.severity === 'danger' ? '严重' : '警告'}</Tag>
                      </div>
                    ))
                  )}
                </div>
                {/* 操作日志摘要 */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>📋 操作日志摘要</div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.8 }}>
                    <div>• 键盘操作: 1,234次</div>
                    <div>• 鼠标点击: 3,567次</div>
                    <div>• 切屏次数: {selectedRecording.events > 0 ? 3 : 0}次</div>
                    <div>• 复制粘贴: 0次</div>
                    <div>• 窗口切换: {selectedRecording.events > 0 ? 2 : 0}次</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
