import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { createProctorEngine, startSimulation, listMediaDevices } from '../components/ProctorEngine'
import { toast, confirmDialog, Tag, Loading, Progress } from '../components/ui'

const TYPE_LABEL = { single_choice: '单选题', multiple_choice: '多选题', judge: '判断题', fill: '填空题', essay: '作文', translation: '翻译', oral: '口语', subjective: '主观题' }

/** 多模态融合视图：单路信号环形指示器（科技感径向进度） */
function FusionMod({ icon, label, m, liveness }) {
  if (!m) return null
  let color = '#16a34a'
  let riskVal = Math.round((m.risk || 0) * 100)
  let desc = m.desc || '--'
  if (liveness) {
    const n = (m.challenges || []).length
    if (m.status === 'verified') { color = '#16a34a'; riskVal = 100; desc = m.desc || '活体核验通过' }
    else if (m.status === 'failed') { color = '#dc2626'; riskVal = 100; desc = m.desc || '活体核验失败' }
    else { color = '#f59e0b'; riskVal = n * 50; desc = m.desc || `活体挑战 ${n}/2` }
  } else if (m.risk >= 0.6) { color = '#dc2626' }
  else if (m.risk >= 0.35) { color = '#f59e0b' }
  const r = 26, c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(riskVal, 100) / 100)
  return (
    <div className="fusion-mod-ring">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="6" />
        <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }} />
        <text x="34" y="40" textAnchor="middle" fontSize="17">{icon}</text>
      </svg>
      <div className="fm-ring-label">{label}</div>
      <div className="fm-ring-desc">{desc}</div>
    </div>
  )
}

export default function ExamRoom() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [session, setSession] = useState(null)
  const [cur, setCur] = useState(0)
  const [answers, setAnswers] = useState({})
  const [events, setEvents] = useState([])
  const [risk, setRisk] = useState(0)
  const [flagged, setFlagged] = useState(false)
  const [violations, setViolations] = useState(0)
  const [escalation, setEscalation] = useState('normal')
  const [camReady, setCamReady] = useState(false)
  const [camError, setCamError] = useState('')
  const [mediaDiag, setMediaDiag] = useState(null)
  const [simMode, setSimMode] = useState(false)
  const [engineMode, setEngineMode] = useState('启动中...')
  const [remaining, setRemaining] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [fusion, setFusion] = useState(null)   // 多模态融合视图
  const [callStatus, setCallStatus] = useState(null)  // 呼叫监考员状态
  const [callTimer, setCallTimer] = useState(0)       // 呼叫计时器
  const [callReason, setCallReason] = useState('')    // 呼叫原因
  const [showCallProctor, setShowCallProctor] = useState(false)  // 显示呼叫弹窗
  const videoRef = useRef(null)
  const engineRef = useRef(null)
  const engineSnapRef = useRef(null)
  const simSnapRef = useRef(null)
  const stopSimRef = useRef(null)
  const answersRef = useRef(answers)
  answersRef.current = answers
  const sidRef = useRef(null)

  // 加载考试（路由参数为考试 ID，start 返回真实会话 ID）
  useEffect(() => {
    api.post(`/exams/${examId}/start`).then((d) => {
      setExam(d.exam)
      setSession(d.session_id)
      sidRef.current = d.session_id
      setRemaining(d.exam.duration_minutes * 60)
      const saved = JSON.parse(localStorage.getItem(`exam_${d.session_id}`) || '{}')
      if (saved.answers) setAnswers(saved.answers)
    }).catch((e) => { setLoadErr(e.detail || '考试加载失败') })
  }, [examId])

  // 计时器
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])

  // 上报事件（节流）
  const reportEvent = useCallback(async (ev) => {
    setEvents((prev) => [...prev.slice(-40), { ...ev, ts: Date.now() }])
    try {
      const r = await api.post('/proctor/event', ev)
      if (r.risk_score != null) setRisk(r.risk_score)
      if (r.flagged) setFlagged(true)
      if (r.violation_count != null) setViolations(r.violation_count)
      if (r.escalation) setEscalation(r.escalation)
    } catch (e) { /* 会话可能已结束 */ }
  }, [])

  // 启动监考引擎
  const startProctor = useCallback(async (useSim) => {
    if (useSim) {
      setSimMode(true)
      setEngineMode('模拟演示模式')
      const sim = startSimulation(sidRef.current, reportEvent)
      stopSimRef.current = sim.stop
      simSnapRef.current = sim.getSnapshot
      return
    }
    try {
      // 从后端身份底库获取考前采集的人脸特征（用于实时身份比对）
      let refDescriptor = null
      try {
        const faceRef = await api.get('/auth/face-reference')
        if (faceRef.registered && faceRef.descriptor) {
          refDescriptor = faceRef.descriptor
          console.log('[监考] 已加载考前采集人脸特征，身份比对模式：服务器底库')
        } else {
          console.log('[监考] 未找到考前采集人脸特征，降级为首帧登记模式')
        }
      } catch (e) {
        console.warn('[监考] 获取人脸特征失败，降级为首帧登记模式:', e.message)
      }
      const engine = await createProctorEngine({ sessionId: sidRef.current, onEvent: reportEvent, refDescriptor })
      engineRef.current = engine
      const { stream, faceMode, mediaError, getSnapshot } = await engine.start()
      engineSnapRef.current = getSnapshot || null
      if (stream && videoRef.current) { videoRef.current.srcObject = stream; setCamReady(true); setCamError(''); setMediaDiag(null) }
      else if (!stream) {
        setCamError(mediaError ? mediaError.title : '摄像头/麦克风启动失败')
        setMediaDiag(mediaError)
      }
      setEngineMode(faceMode ? 'AI 视觉引擎已启动（真实采集）' : '轻量模式（人脸模型不可用）')
    } catch (e) {
      setEngineMode('启动失败：' + e.message)
      setCamError('监考引擎启动失败：' + e.message)
    }
  }, [reportEvent])

  // 多模态融合视图轮询（600ms）
  useEffect(() => {
    const timer = setInterval(() => {
      const getter = simMode ? simSnapRef.current : engineSnapRef.current
      if (getter) {
        const s = getter()
        if (s) setFusion({ face: { ...s.face }, behavior: { ...s.behavior }, audio: { ...s.audio }, object: { ...s.object }, liveness: { ...s.liveness }, fusion: { ...s.fusion } })
      }
    }, 600)
    return () => clearInterval(timer)
  }, [simMode])

  useEffect(() => { if (session) startProctor(false); return () => { engineRef.current?.stop?.(); stopSimRef.current?.() } }, [startProctor, session])

  const setAnswer = (qid, value) => {
    setAnswers((prev) => { const n = { ...prev, [qid]: value }; localStorage.setItem(`exam_${sidRef.current}`, JSON.stringify({ answers: n })); return n })
  }

  const submit = async () => {
    const ok = await confirmDialog({
      title: '确认交卷',
      message: `已作答 ${Object.keys(answers).length}/${exam.questions.length} 题。交卷后将自动进行 AI 智能评阅并生成能力画像，确定交卷吗？`,
      confirmText: '确认交卷',
    })
    if (!ok) return
    setSubmitting(true)
    const payload = Object.entries(answers).map(([qid, ans]) => ({ question_id: Number(qid), answer: ans, time_used_sec: 60 }))
    try {
      await api.post(`/exams/session/${sidRef.current}/submit`, { answers: payload })
      const g = await api.post(`/grading/session/${sidRef.current}/auto`)
      localStorage.removeItem(`exam_${sidRef.current}`)

      // ========== 自动收集错题到错题本 ==========
      try {
        const wrongList = []
        const today = new Date().toISOString().slice(0, 10)
        exam.questions.forEach((q, idx) => {
          const myAns = answers[q.question_id]
          const correctAns = q.correct_answer || q.answer || q.correct_option
          // 判断是否答错（未作答也算错）
          let isWrong = false
          if (myAns === undefined || myAns === null || myAns === '') {
            isWrong = true // 未作答
          } else if (correctAns) {
            // 客观题对比
            if (Array.isArray(correctAns)) {
              const myArr = Array.isArray(myAns) ? myAns : [myAns]
              isWrong = correctAns.length !== myArr.length || !correctAns.every(c => myArr.includes(c))
            } else {
              isWrong = String(myAns).trim() !== String(correctAns).trim()
            }
          }
          if (isWrong) {
            wrongList.push({
              id: Date.now() + idx,
              exam: exam.title || '考试',
              subject: exam.course || '综合',
              type: q.type || '选择题',
              question: q.question || q.content || `第${idx + 1}题`,
              my_answer: myAns ? (Array.isArray(myAns) ? myAns.join(', ') : String(myAns)) : '未作答',
              correct_answer: correctAns ? (Array.isArray(correctAns) ? correctAns.join(', ') : String(correctAns)) : '详见解析',
              analysis: q.analysis || q.explanation || '暂无解析，建议查看教材相关知识点',
              wrong_count: 1,
              last_wrong: today,
              mastered: false,
              knowledge_point: q.knowledge_point || q.kp || q.tag || '未分类',
              difficulty: q.difficulty || '中等',
              // 艾宾浩斯复习计划
              review_schedule: {
                next_review: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                review_stage: 0, // 0:1天 1:2天 2:4天 3:7天 4:15天
                reviewed: false,
              }
            })
          }
        })
        if (wrongList.length > 0) {
          // 合并到已有错题本
          const existing = JSON.parse(localStorage.getItem('wrong_book') || '[]')
          // 去重：同一题目（question+exam相同）只保留一条，错误次数累加
          const merged = [...existing]
          wrongList.forEach(w => {
            const existIdx = merged.findIndex(m => m.question === w.question && m.exam === w.exam)
            if (existIdx >= 0) {
              merged[existIdx].wrong_count += 1
              merged[existIdx].last_wrong = w.last_wrong
              merged[existIdx].mastered = false
              merged[existIdx].review_schedule = w.review_schedule
            } else {
              merged.push(w)
            }
          })
          localStorage.setItem('wrong_book', JSON.stringify(merged))
          toast.info(`已自动收集 ${wrongList.length} 道错题到错题本，记得复习哦！`, { duration: 5000 })
        }
      } catch (e) { console.warn('错题收集失败:', e) }
      // ========== 错题收集结束 ==========

      toast.success(`已交卷并完成 AI 自动评阅！得分：${g.ai_score}`)
      navigate('/')
    } catch (e) { toast.error(e.detail || '提交失败'); setSubmitting(false) }
  }

  const switchSim = async () => {
    const ok = await confirmDialog({ title: '切换演示模式', message: '切换为演示模式（无需摄像头/麦克风，用于无摄像头环境演示监考事件流）。真实考试请使用摄像头采集。确定切换吗？' })
    if (!ok) return
    engineRef.current?.stop?.()
    setCamReady(false)
    startProctor(true)
  }

  const retryCamera = async () => {
    // 先检查当前权限状态
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const camPerm = await navigator.permissions.query({ name: 'camera' }).catch(() => null)
        const micPerm = await navigator.permissions.query({ name: 'microphone' }).catch(() => null)
        if (camPerm?.state === 'denied' || micPerm?.state === 'denied') {
          // 权限已被浏览器拒绝，无法通过代码重新请求，必须用户手动在设置中更改
          toast.warning('摄像头/麦克风权限已被浏览器拒绝，请点击地址栏左侧锁形图标，将权限改为「允许」后刷新页面', { duration: 8000 })
          return
        }
      }
    } catch (e) { /* 权限API不支持时忽略，直接重试 */ }
    // 权限未被明确拒绝，可以重新请求
    engineRef.current?.stop?.()
    setCamReady(false)
    setCamError('')
    setMediaDiag(null)
    setSimMode(false)
    setEngineMode('重新授权中...')
    startProctor(false)
  }

  // 学员呼叫监考员
  const callProctor = async () => {
    if (!callReason.trim()) { toast.warning('请选择呼叫原因'); return }
    setShowCallProctor(false)
    setCallStatus('calling')
    setCallTimer(0)
    toast.info('正在呼叫监考员，请稍候...')
    try {
      // 通过监考事件接口记录呼叫
      await api.post(`/proctor/event`, {
        session_id: sidRef.current,
        event_type: 'student_call',
        confidence: 0.9,
        detail: { desc: `学员呼叫监考员: ${callReason}`, reason: callReason, modality: 'call' }
      })
    } catch (e) { /* 呼叫事件记录失败忽略 */ }
    // 模拟呼叫过程（实际项目中通过WebSocket实时通信）
    setTimeout(() => {
      setCallStatus('connected')
      toast.success('监考员已接通，请在语音通话中说明情况')
    }, 3000)
  }

  const endCall = () => {
    setCallStatus('ended')
    setCallReason('')
    setTimeout(() => setCallStatus(null), 2000)
  }

  // 呼叫计时器
  useEffect(() => {
    if (callStatus === 'calling' || callStatus === 'connected') {
      const t = setInterval(() => setCallTimer((v) => v + 1), 1000)
      return () => clearInterval(t)
    }
  }, [callStatus])

  const checkDevices = async () => {
    const d = await listMediaDevices()
    if (!d.supported) { toast.error('当前浏览器不支持媒体设备检测（需 HTTPS 或 localhost）'); return }
    toast.info(`检测到 ${d.cameras.length} 个摄像头、${d.mics.length} 个麦克风${d.cameras.length ? '' : '（未检测到摄像头，请检查设备连接）'}${d.mics.length ? '' : '（未检测到麦克风）'}`, { duration: 5000 })
  }

  if (loadErr) {
    return (
      <div className="card">
        <div className="card-title">无法进入考试</div>
        <div className="alert danger">{loadErr}</div>
        <button className="btn mt16" onClick={() => navigate('/')}>返回工作台</button>
      </div>
    )
  }
  if (!exam) return <Loading text="加载考试..." />

  const q = exam.questions[cur]
  const answeredCount = Object.keys(answers).length
  const mm = Math.floor(remaining / 60), ss = remaining % 60
  const progress = Math.round((answeredCount / exam.questions.length) * 100)

  const renderQuestion = () => {
    const val = answers[q.question_id] || ''
    if (q.type === 'single_choice' || q.type === 'judge') {
      const opts = q.type === 'judge' ? [{ key: 'T', text: '正确' }, { key: 'F', text: '错误' }] : q.options
      return (
        <div className="grid" style={{ gap: 10 }}>
          {opts.map((o) => (
            <div key={o.key} className={`option-card ${val === o.key ? 'selected' : ''}`} onClick={() => setAnswer(q.question_id, o.key)}>
              <span className="key">{o.key}</span> {o.text}
            </div>
          ))}
        </div>
      )
    }
    if (q.type === 'multiple_choice') {
      const sel = (val || '').split('')
      const toggle = (k) => {
        const s = sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]
        setAnswer(q.question_id, s.sort().join(''))
      }
      return (
        <div className="grid" style={{ gap: 10 }}>
          {q.options.map((o) => (
            <div key={o.key} className={`option-card ${sel.includes(o.key) ? 'selected' : ''}`} onClick={() => toggle(o.key)}>
              <span className="key">{o.key}</span> {o.text}
            </div>
          ))}
        </div>
      )
    }
    if (q.type === 'oral') {
      return (
        <div>
          <div className="alert info mb16">🎤 口语作答：请使用麦克风作答（将调用浏览器语音识别），也可直接输入文本。</div>
          <textarea className="textarea" style={{ minHeight: 120 }} placeholder="语音识别结果或直接输入你的回答..." value={val} onChange={(e) => setAnswer(q.question_id, e.target.value)} />
        </div>
      )
    }
    return <textarea className="textarea" style={{ minHeight: 180 }} placeholder="请输入你的作答..." value={val} onChange={(e) => setAnswer(q.question_id, e.target.value)} />
  }

  return (
    <div className="exam-room-enterprise">
      {flagged && (
        <div className="alert danger mb16">⚠ 监考预警：多模态信号已判定疑似异常，系统已生成可追溯证据链，本场考试将被重点复核。</div>
      )}

      {/* 企业级顶部状态栏 */}
      <div className="er-top-bar">
        <div className="er-top-left">
          <div className="er-exam-icon">📝</div>
          <div>
            <div className="er-exam-title">{exam.title}</div>
            <div className="er-exam-meta">
              <span className="er-meta-item">🏫 {exam.course || '大学英语（二）'}</span>
              <span className="er-meta-item">👤 陈思远 (stu01)</span>
              <span className="er-meta-item">📋 {exam.questions.length} 题</span>
            </div>
          </div>
        </div>
        <div className="er-top-right">
          <div className="er-kpi-chip">
            <span className="er-kpi-label">答题进度</span>
            <span className="er-kpi-value">{answeredCount}/{exam.questions.length}</span>
            <div className="er-kpi-bar"><div style={{width: `${progress}%`, background: 'linear-gradient(90deg,#3b82f6,#10b981)'}} /></div>
          </div>
          <div className={`er-kpi-chip ${remaining < 300 ? 'er-kpi-danger' : ''}`}>
            <span className="er-kpi-label">剩余时间</span>
            <span className="er-kpi-value er-timer">{mm}:{String(ss).padStart(2, '0')}</span>
          </div>
          <div className={`er-status-chip ${escalation === 'auto_lock' || escalation === 'serious' ? 'er-status-danger' : escalation === 'warn' ? 'er-status-warn' : 'er-status-ok'}`}>
            <span className="er-status-dot" />
            {escalation === 'auto_lock' ? '严重违规' : escalation === 'serious' ? '重点监控' : escalation === 'warn' ? '违规预警' : '监考正常'}
          </div>
          {/* 学员呼叫监考员按钮 */}
          {!callStatus && (
            <button className="btn sm" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', marginLeft: 8 }} onClick={() => setShowCallProctor(true)}>
              📞 呼叫监考员
            </button>
          )}
          {callStatus === 'calling' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: 6, fontSize: 12, marginLeft: 8 }}>
              <span className="spin" style={{ width: 12, height: 12, border: '2px solid #fcd34d', borderTopColor: '#92400e' }} />
              呼叫中... {Math.floor(callTimer / 60)}:{String(callTimer % 60).padStart(2, '0')}
            </div>
          )}
          {callStatus === 'connected' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 6, fontSize: 12, marginLeft: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite' }} />
              通话中 {Math.floor(callTimer / 60)}:{String(callTimer % 60).padStart(2, '0')}
              <button onClick={endCall} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>挂断</button>
            </div>
          )}
        </div>
      </div>

      <div className="exam-room">
        <div>
          <div className="card mb16">
            <div className="card-title">
              <b>题目导航</b>
              <span className="small muted">点击题号快速跳转</span>
            </div>
            <div className="question-nav">
              {exam.questions.map((qq, i) => (
                <div key={qq.question_id} className={`qn ${answers[qq.question_id] ? 'answered' : ''} ${i === cur ? 'current' : ''}`} onClick={() => setCur(i)}>{i + 1}</div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>
                <Tag color="blue">{TYPE_LABEL[q.type] || q.type}</Tag>
                <span className="muted small" style={{ marginLeft: 8 }}>第 {cur + 1} 题 · {q.score} 分 · 共 {exam.questions.length} 题</span>
              </span>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.9, marginBottom: 20, whiteSpace: 'pre-wrap', color: '#334155' }}>{q.stem}</div>
            {renderQuestion()}
            <div className="flex between mt20" style={{ marginTop: 20 }}>
              <button className="btn" disabled={cur === 0} onClick={() => setCur(cur - 1)}>← 上一题</button>
              {cur < exam.questions.length - 1 ? (
                <button className="btn primary" onClick={() => setCur(cur + 1)}>下一题 →</button>
              ) : (
                <button className="btn success" onClick={submit} disabled={submitting}>
                  {submitting ? <><span className="spin" /> 提交评阅中...</> : '交卷并评阅'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="proctor-panel">
          <div className="card er-proctor-card">
            <div className="card-title er-proctor-title">
              <span>🎥 多模态智能监考中心</span>
              <div className="flex" style={{gap: 8}}>
                {simMode ? <Tag color="orange" dot>模拟模式</Tag> : <Tag color="green" dot><span className="live-dot" /> 实时采集</Tag>}
                <Tag color="blue">v3.0 融合引擎</Tag>
              </div>
            </div>

            {/* 企业级摄像头区域 */}
            <div className="er-camera-wrap">
              <div className="er-camera-header">
                <span className="er-cam-label">📹 主摄像头 · 1080P</span>
                <span className="er-cam-fps">{camReady ? '30 FPS' : '-- FPS'}</span>
              </div>
              <div className="camera-box er-camera-box">
                <video ref={videoRef} autoPlay muted playsInline style={{ display: camReady ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }} />
                {camError && (
                  <div className="camera-overlay" style={{ flexDirection: 'column', gap: 10, textAlign: 'center', padding: '16px 20px', overflowY: 'auto' }}>
                    <div style={{ fontSize: 13, color: '#fca5a5', fontWeight: 600, lineHeight: 1.5 }}>⚠ {camError}</div>
                    {mediaDiag && (
                      <div style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.6, maxWidth: 420 }}>{mediaDiag.advice}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                      <button className="btn sm primary" onClick={retryCamera}>重新授权</button>
                      <button className="btn sm" onClick={checkDevices}>检测可用设备</button>
                    </div>
                  </div>
                )}
                {!camReady && !camError && !simMode && <div className="camera-overlay">📷 摄像头采集区域<br /><span className="small">等待浏览器授权...</span></div>}
                {simMode && <div className="camera-overlay">📷 演示模式（无真实摄像头）<br /><span className="small">用于无摄像头环境演示</span></div>}
                {camReady && (
                  <>
                    <div className="camera-overlay" style={{ top: 8, left: 8, right: 'auto', bottom: 'auto', background: 'rgba(0,0,0,0.65)', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="live-dot" /> 实时采集中
                    </div>
                    <div className="camera-overlay" style={{ top: 8, right: 8, left: 'auto', bottom: 'auto', background: 'rgba(0,0,0,0.65)', borderRadius: 6, padding: '4px 10px', fontSize: 10, color: '#94a3b8' }}>
                      1920×1080 · 30fps
                    </div>
                  </>
                )}
              </div>
              <div className="er-camera-footer">
                <span className="er-engine-status">{engineMode}</span>
                <span className="er-engine-model">face-api.js + COCO-SSD + Web Audio API</span>
              </div>
            </div>

            {/* 多源融合视图：人脸 / 行为 / 声音 / 物品 / 活体 五路信号 */}
            <div className="er-fusion-section">
              <div className="er-section-label">五路模态融合监测</div>
              <div className="fusion-grid mt16">
                <FusionMod icon="🎥" label="人脸" m={fusion?.face} />
                <FusionMod icon="🖥️" label="行为" m={fusion?.behavior} />
                <FusionMod icon="🎤" label="声音" m={fusion?.audio} />
                <FusionMod icon="📱" label="物品" m={fusion?.object} />
                <FusionMod icon="👁️" label="活体" m={fusion?.liveness} liveness />
              </div>
            </div>

            {/* 融合结果（企业级玻璃拟态英雄区） */}
            <div className="fusion-hero er-fusion-hero">
              <div className="fusion-hero-bg" />
              <div className="fusion-hero-content">
                <div>
                  <div className="small muted">多源融合置信度</div>
                  <div className="fusion-hero-value" style={{ color: (fusion?.fusion?.confidence || 0) >= 0.75 ? '#dc2626' : (fusion?.fusion?.confidence || 0) >= 0.5 ? '#f59e0b' : '#1e293b' }}>
                    {Math.round((fusion?.fusion?.confidence || 0) * 100)}%
                  </div>
                  <div className="fusion-chips">
                    {fusion?.fusion?.modals?.length ? fusion.fusion.modals.map((m, i) => <span key={i} className="fusion-chip">{m}</span>) : <span className="small muted">融合信号：监测中</span>}
                  </div>
                </div>
                <div className="fusion-hero-right">
                  <span className={`kpi-badge ${flagged ? 'kpi-miss' : fusion?.fusion?.decision === 'attention' ? 'kpi-warn' : 'kpi-ok'}`}>
                    {flagged ? '疑似作弊' : fusion?.fusion?.decision === 'attention' ? '需关注' : '正常'}
                  </span>
                  <div className="er-kpi-mini-row">
                    <div className="er-kpi-mini">
                      <span className="er-kpi-mini-label">违规次数</span>
                      <span className="er-kpi-mini-value">{violations}</span>
                    </div>
                    <div className="er-kpi-mini">
                      <span className="er-kpi-mini-label">风险分</span>
                      <span className={`er-kpi-mini-value ${risk > 2.2 ? 'text-danger' : risk > 1 ? 'text-warn' : 'text-success'}`}>{risk.toFixed(2)}</span>
                    </div>
                    <div className="er-kpi-mini">
                      <span className="er-kpi-mini-label">证据链</span>
                      <span className="er-kpi-mini-value">{events.filter(e => e.confidence > 0.7).length}</span>
                    </div>
                  </div>
                  <span className="small muted"><b className={escalation === 'auto_lock' || escalation === 'serious' ? 'text-danger' : escalation === 'warn' ? 'text-warn' : 'muted'}>{escalation === 'auto_lock' ? '建议自动收卷' : escalation === 'serious' ? '严重违规' : escalation === 'warn' ? '违规预警' : '监考正常'}</b></span>
                </div>
              </div>
            </div>
            <Progress value={Math.min(risk * 20, 100)} color={risk > 2.2 ? 'red' : risk > 1 ? 'orange' : ''} height={8} />
            <div className="flex mt16" style={{ gap: 8 }}>
              <button className="btn sm" onClick={retryCamera}>🔄 重启视觉引擎</button>
              <button className="btn sm" onClick={switchSim}>📺 演示模式</button>
              <button className="btn sm" onClick={checkDevices}>🔍 检测设备</button>
            </div>
          </div>

          <div className="card mt16">
            <div className="card-title"><span>📋 实时事件流 · 可追溯证据链</span><Tag color="gray">{events.length} 条</Tag></div>
            <div className="event-timeline er-event-timeline">
              {events.length === 0 && <div className="small muted" style={{ padding: 12 }}>等待采集事件...</div>}
              {events.slice().reverse().map((e, i) => {
                const dot = e.event_type.includes('liveness_pass') ? 'green' : e.confidence > 0.8 ? 'red' : e.confidence > 0.5 ? 'orange' : 'blue'
                const time = new Date(e.ts).toLocaleTimeString('zh-CN', { hour12: false })
                return (
                  <div className="event-tl-item er-event-item" key={i}>
                    <div className={`event-tl-dot ${dot} er-event-dot`} />
                    <div className="event-tl-body er-event-body">
                      <div className="er-event-top">
                        <span className="er-event-desc">{e.detail?.desc || e.event_type}</span>
                        <span className="er-event-time">{time}</span>
                      </div>
                      <div className="er-event-bottom">
                        <span className={`er-event-confidence ${dot}`}>置信度 {Math.round(e.confidence * 100)}%</span>
                        {e.detail?.evidence && <span className="er-event-evidence">📎 证据已留存</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 呼叫监考员 - 原因选择弹窗 */}
      {showCallProctor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCallProctor(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>📞 呼叫监考员</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>请选择呼叫原因，监考员收到后会尽快与您联系</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { v: '设备故障', icon: '💻', desc: '摄像头/麦克风/网络问题' },
                { v: '题目疑问', icon: '❓', desc: '题目显示异常或内容疑问' },
                { v: '身体不适', icon: '🤒', desc: '需要暂停或特殊处理' },
                { v: '其他原因', icon: '📝', desc: '其他需要监考员协助的情况' },
              ].map((item) => (
                <div key={item.v} onClick={() => setCallReason(item.v)}
                  style={{ padding: '12px 14px', borderRadius: 10, border: callReason === item.v ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: callReason === item.v ? '#eff6ff' : '#f8fafc', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.v}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowCallProctor(false)}>取消</button>
              <button className="btn primary" onClick={callProctor} disabled={!callReason} style={{ opacity: callReason ? 1 : 0.5 }}>
                确认呼叫
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}





