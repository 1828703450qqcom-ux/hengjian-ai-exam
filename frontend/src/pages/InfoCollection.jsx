import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api'
import { toast, Tag, Progress } from '../components/ui'

const STEPS = [
  { id: 1, title: '身份信息', icon: '📝', desc: '核对考生基本信息' },
  { id: 2, title: '人脸采集', icon: '📷', desc: '采集考生人脸照片' },
  { id: 3, title: '设备检测', icon: '🔧', desc: '检测考试设备环境' },
  { id: 4, title: '须知确认', icon: '📋', desc: '阅读并确认考试规则' },
  { id: 5, title: '完成', icon: '✅', desc: '信息采集完成' },
]

export default function InfoCollection() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [exam, setExam] = useState(null)
  const [form, setForm] = useState({
    student_no: '', name: '', id_card: '', college: '', major: '', class_name: '', phone: '',
  })
  const [devices, setDevices] = useState({
    camera: false, mic: false, speaker: false, network: false,
  })
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [photoTaken, setPhotoTaken] = useState(false)
  const [photoData, setPhotoData] = useState(null)
  const streamRef = useRef(null)
  // 人脸识别相关状态
  const [faceDescriptor, setFaceDescriptor] = useState(null)
  const [faceDetectStatus, setFaceDetectStatus] = useState('idle') // idle/loading/detecting/no_face/multi_face/ok
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false)
  const faceDetectRef = useRef(null)
  const faceApiRef = useRef(null)

  useEffect(() => {
    api.get(`/exams/${examId}`).then(d => setExam(d)).catch(() => {})
    api.get('/auth/me').then(u => {
      setForm(f => ({
        ...f,
        student_no: u.student_no || u.username || '',
        name: u.name || '',
        college: u.college || '',
        major: u.major || '',
      }))
    }).catch(() => {})
  }, [examId])

  // 加载face-api模型
  const loadFaceModels = async () => {
    if (faceModelsLoaded) return true
    setFaceDetectStatus('loading')
    try {
      // 动态加载face-api脚本
      if (!window.faceapi) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = '/models/face-api.min.js'
          s.onload = resolve
          s.onerror = () => reject(new Error('face-api加载失败'))
          document.head.appendChild(s)
        })
      }
      const faceapi = window.faceapi
      faceApiRef.current = faceapi
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ])
      setFaceModelsLoaded(true)
      setFaceDetectStatus('detecting')
      return true
    } catch (e) {
      console.error('人脸模型加载失败:', e)
      setFaceDetectStatus('idle')
      toast.warning('人脸识别模型加载失败，将仅采集照片')
      return false
    }
  }

  // 实时人脸检测循环
  const startFaceDetectLoop = () => {
    const faceapi = faceApiRef.current
    if (!faceapi || !videoRef.current) return
    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        faceDetectRef.current = requestAnimationFrame(detect)
        return
      }
      try {
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 })
        ).withFaceLandmarks().withFaceDescriptors()
        if (detections.length === 0) {
          setFaceDetectStatus('no_face')
        } else if (detections.length > 1) {
          setFaceDetectStatus('multi_face')
        } else {
          setFaceDetectStatus('ok')
        }
      } catch (e) { /* 单帧检测失败忽略 */ }
      faceDetectRef.current = requestAnimationFrame(detect)
    }
    detect()
  }

  const startCamera = async () => {
    try {
            // 最高权限配置：1080P+30fps，前置摄像头
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 }, facingMode: 'user' }, audio: false })
      } catch (highErr) {
        console.warn('[采集] 1080P不可用，降级为720P:', highErr.message)
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setDevices(d => ({ ...d, camera: true }))
      toast.success('摄像头已开启')
      // 异步加载人脸模型并开始检测
      loadFaceModels().then(ok => {
        if (ok) startFaceDetectLoop()
      })
    } catch (e) {
      toast.error('摄像头开启失败：' + (e.message || '请检查权限'))
    }
  }

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = 640
    canvas.height = 480
    ctx.drawImage(videoRef.current, 0, 0, 640, 480)
    const data = canvas.toDataURL('image/jpeg', 0.95)
    setPhotoData(data)

    // 提取人脸特征向量
    let descriptor = null
    if (faceApiRef.current && faceModelsLoaded) {
      try {
        const faceapi = faceApiRef.current
        const detections = await faceapi
          .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
          .withFaceLandmarks()
          .withFaceDescriptor()
        if (detections && detections.descriptor) {
          descriptor = Array.from(detections.descriptor)
          setFaceDescriptor(descriptor)
          toast.success('人脸照片采集成功，特征提取完成')
        } else {
          toast.warning('未检测到清晰人脸，请调整位置后重试')
          return
        }
      } catch (e) {
        console.error('人脸特征提取失败:', e)
        toast.warning('人脸特征提取失败，仅保存照片')
      }
    } else {
      toast.success('人脸照片采集成功')
    }
    setPhotoTaken(true)
    // 停止人脸检测循环
    if (faceDetectRef.current) {
      cancelAnimationFrame(faceDetectRef.current)
      faceDetectRef.current = null
    }
  }

  const retakePhoto = () => {
    setPhotoTaken(false)
    setPhotoData(null)
    setFaceDescriptor(null)
    setFaceDetectStatus('detecting')
    // 重新开始人脸检测循环
    if (faceModelsLoaded && videoRef.current) {
      startFaceDetectLoop()
    }
  }

  const stopCamera = () => {
    if (faceDetectRef.current) {
      cancelAnimationFrame(faceDetectRef.current)
      faceDetectRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const testMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setDevices(d => ({ ...d, mic: true }))
      toast.success('麦克风检测通过')
    } catch (e) {
      toast.error('麦克风检测失败')
    }
  }

  const testNetwork = () => {
    const startTime = Date.now()
    api.get('/system/health').then(() => {
      const latency = Date.now() - startTime
      setDevices(d => ({ ...d, network: true }))
      toast.success(`网络检测通过，延迟 ${latency}ms`)
    }).catch(() => {
      setDevices(d => ({ ...d, network: false }))
      toast.error('网络检测失败')
    })
  }

  const testSpeaker = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 440
      gain.gain.value = 0.3
      osc.start()
      setTimeout(() => { osc.stop(); ctx.close() }, 500)
      setDevices(d => ({ ...d, speaker: true }))
      toast.success('扬声器测试音已播放')
    } catch (e) {
      toast.error('扬声器检测失败')
    }
  }

  const canNext = () => {
    if (step === 1) return form.student_no && form.name && form.id_card
    if (step === 2) return photoTaken
    if (step === 3) return devices.camera && devices.mic && devices.network
    if (step === 4) return agreed
    return true
  }

  const nextStep = () => {
    if (step === 2) stopCamera()
    setStep(s => Math.min(s + 1, 5))
  }

  const prevStep = () => {
    setStep(s => Math.max(s - 1, 1))
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      // 先将人脸特征上传到后端身份底库
      if (faceDescriptor) {
        try {
          await api.post('/auth/register-face', {
            descriptor: faceDescriptor,
            photo_url: photoData ? `data:image/jpeg;base64,${photoData.split(',')[1]}` : null,
          })
        } catch (e) {
          console.warn('人脸特征登记失败:', e)
        }
      }
      await api.post('/exams/checkin', {
        exam_id: Number(examId),
        ...form,
        face_photo: photoData,
        face_descriptor: faceDescriptor,
        device_check: devices,
      })
      toast.success('信息采集完成，即将进入考试')
      setTimeout(() => navigate(`/exam-room/${examId}`), 1500)
    } catch (e) {
      toast.error(e.detail || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const currentStep = STEPS.find(s => s.id === step)
  const progress = (step / STEPS.length) * 100

  return (
    <div className="checkin-page">
      {/* 顶部标题栏 */}
      <div className="checkin-header">
        <div>
          <h1 className="checkin-title">📝 考前信息采集</h1>
          <p className="checkin-subtitle">{exam?.title || '考试信息采集'} · 请按步骤完成采集后进入考试</p>
        </div>
        <div className="checkin-progress-card">
          <div className="checkin-progress-label">采集进度</div>
          <div className="checkin-progress-value">{step}/{STEPS.length}</div>
          <Progress value={progress} color="blue" height={6} />
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="checkin-steps">
        {STEPS.map((s, i) => (
          <div key={s.id} className={`checkin-step ${step === s.id ? 'active' : ''} ${step > s.id ? 'done' : ''}`}>
            <div className="checkin-step-icon">
              {step > s.id ? '✓' : s.icon}
            </div>
            <div className="checkin-step-info">
              <div className="checkin-step-title">{s.title}</div>
              <div className="checkin-step-desc">{s.desc}</div>
            </div>
            {i < STEPS.length - 1 && <div className="checkin-step-line" />}
          </div>
        ))}
      </div>

      {/* 步骤内容 */}
      <div className="checkin-content-card">
        <div className="checkin-content-header">
          <span className="checkin-content-icon">{currentStep?.icon}</span>
          <div>
            <h2 className="checkin-content-title">{currentStep?.title}</h2>
            <p className="checkin-content-desc">{currentStep?.desc}</p>
          </div>
        </div>

        {/* 步骤1：身份信息 */}
        {step === 1 && (
          <div className="checkin-form-grid">
            <div className="form-item">
              <label>学号 <span className="required">*</span></label>
              <input className="input" value={form.student_no} onChange={e => setForm({ ...form, student_no: e.target.value })} placeholder="请输入学号" />
            </div>
            <div className="form-item">
              <label>姓名 <span className="required">*</span></label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="请输入姓名" />
            </div>
            <div className="form-item">
              <label>身份证号 <span className="required">*</span></label>
              <input className="input" value={form.id_card} onChange={e => setForm({ ...form, id_card: e.target.value })} placeholder="请输入身份证号" maxLength={18} />
            </div>
            <div className="form-item">
              <label>手机号</label>
              <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="请输入手机号" maxLength={11} />
            </div>
            <div className="form-item">
              <label>院系</label>
              <input className="input" value={form.college} onChange={e => setForm({ ...form, college: e.target.value })} placeholder="请输入院系" />
            </div>
            <div className="form-item">
              <label>专业</label>
              <input className="input" value={form.major} onChange={e => setForm({ ...form, major: e.target.value })} placeholder="请输入专业" />
            </div>
            <div className="form-item" style={{ gridColumn: 'span 2' }}>
              <label>班级</label>
              <input className="input" value={form.class_name} onChange={e => setForm({ ...form, class_name: e.target.value })} placeholder="请输入班级" />
            </div>
          </div>
        )}

        {/* 步骤2：人脸采集 */}
        {step === 2 && (
          <div className="face-capture-section">
            <div className="face-capture-area">
              {!photoTaken ? (
                <div className="face-camera-box">
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                  {/* 人脸检测状态标签 */}
                  {devices.camera && (
                    <div className={`face-detect-status ${faceDetectStatus}`}>
                      {faceDetectStatus === 'loading' && <><span className="spin" style={{width:12,height:12,borderWidth:2,marginRight:6}} />人脸模型加载中...</>}
                      {faceDetectStatus === 'detecting' && '🔍 人脸检测中...'}
                      {faceDetectStatus === 'ok' && '✓ 检测到人脸（单人）'}
                      {faceDetectStatus === 'no_face' && '⚠ 未检测到人脸'}
                      {faceDetectStatus === 'multi_face' && '⚠ 检测到多张人脸'}
                      {faceDetectStatus === 'idle' && '⏳ 等待检测'}
                    </div>
                  )}
                  {!devices.camera && (
                    <div className="face-camera-placeholder">
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>点击下方按钮开启摄像头</div>
                      <button className="btn primary" onClick={startCamera}>开启摄像头</button>
                    </div>
                  )}
                  {devices.camera && (
                    <div className="face-camera-overlay">
                      <div className="face-frame-guide" />
                      <div className="face-camera-tip">请将面部置于框内，保持光线充足</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="face-photo-preview">
                  <img src={photoData} alt="人脸照片" style={{ width: '100%', borderRadius: 12 }} />
                  <div className="face-photo-badge">✓ 照片采集成功</div>
                  {faceDescriptor && (
                    <div className="face-feature-badge">🧬 人脸特征已提取（128维）</div>
                  )}
                </div>
              )}
            </div>
            <div className="face-capture-actions">
              {!photoTaken ? (
                <button className="btn primary large" onClick={takePhoto} disabled={!devices.camera || faceDetectStatus === 'no_face' || faceDetectStatus === 'multi_face'}>
                  📸 拍照采集
                  {faceDetectStatus === 'no_face' && '（需检测到人脸）'}
                </button>
              ) : (
                <button className="btn large" onClick={retakePhoto}>🔄 重新拍照</button>
              )}
            </div>
            <div className="face-capture-tips">
              <div className="tip-title">📌 采集要求</div>
              <ul className="tip-list">
                <li>确保面部完整出现在画面中，无遮挡</li>
                <li>保持光线充足，避免逆光或强光</li>
                <li>表情自然，正视摄像头</li>
                <li>系统将自动提取128维人脸特征向量，用于考前身份核验和考中实时人脸比对</li>
                <li>人脸特征仅存储于本地服务器，用于本次考试身份核验</li>
              </ul>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        )}

        {/* 步骤3：设备检测 */}
        {step === 3 && (
          <div className="device-check-section">
            <div className="device-check-grid">
              <div className={`device-card ${devices.camera ? 'ok' : ''}`}>
                <div className="device-icon">📷</div>
                <div className="device-name">摄像头</div>
                <div className="device-status">
                  {devices.camera ? <Tag color="green">✓ 已检测</Tag> : <Tag color="gray">未检测</Tag>}
                </div>
                <button className="btn sm" onClick={startCamera} disabled={devices.camera}>检测摄像头</button>
              </div>
              <div className={`device-card ${devices.mic ? 'ok' : ''}`}>
                <div className="device-icon">🎤</div>
                <div className="device-name">麦克风</div>
                <div className="device-status">
                  {devices.mic ? <Tag color="green">✓ 已检测</Tag> : <Tag color="gray">未检测</Tag>}
                </div>
                <button className="btn sm" onClick={testMic} disabled={devices.mic}>检测麦克风</button>
              </div>
              <div className={`device-card ${devices.speaker ? 'ok' : ''}`}>
                <div className="device-icon">🔊</div>
                <div className="device-name">扬声器</div>
                <div className="device-status">
                  {devices.speaker ? <Tag color="green">✓ 已检测</Tag> : <Tag color="gray">未检测</Tag>}
                </div>
                <button className="btn sm" onClick={testSpeaker} disabled={devices.speaker}>播放测试音</button>
              </div>
              <div className={`device-card ${devices.network ? 'ok' : ''}`}>
                <div className="device-icon">🌐</div>
                <div className="device-name">网络连接</div>
                <div className="device-status">
                  {devices.network ? <Tag color="green">✓ 已连接</Tag> : <Tag color="gray">未检测</Tag>}
                </div>
                <button className="btn sm" onClick={testNetwork} disabled={devices.network}>检测网络</button>
              </div>
            </div>
            <div className="device-check-summary">
              <div className="summary-title">设备检测汇总</div>
              <div className="summary-stats">
                <span className="summary-item ok">✓ 通过：{Object.values(devices).filter(Boolean).length}/4</span>
                <span className="summary-item">待检测：{4 - Object.values(devices).filter(Boolean).length}</span>
              </div>
              <div className="summary-warning">⚠ 建议所有设备检测通过后再进入考试，以确保考试顺利进行</div>
            </div>
          </div>
        )}

        {/* 步骤4：须知确认 */}
        {step === 4 && (
          <div className="agreement-section">
            <div className="agreement-box">
              <h3 className="agreement-title">📜 考试须知与考场规则</h3>
              <div className="agreement-content">
                <h4>一、考试纪律</h4>
                <ol>
                  <li>考生应在考试开始前30分钟进入考场，完成信息采集和设备检测。</li>
                  <li>考试过程中应保持摄像头全程开启，面部清晰可见，不得遮挡。</li>
                  <li>考试期间不得离开座位，不得与他人交谈或使用通讯设备。</li>
                  <li>不得切换考试页面、打开其他应用或浏览器标签页。</li>
                  <li>考试系统将全程进行多模态智能监考，包括人脸比对、行为识别、声音监测和活体核验。</li>
                </ol>
                <h4>二、违规处理</h4>
                <ol>
                  <li>系统检测到疑似违规行为时，将自动记录并生成可追溯证据链。</li>
                  <li>累计违规达到阈值时，系统将发出预警，严重违规将自动收卷。</li>
                  <li>考试结束后，所有违规记录将提交监考教师复核。</li>
                  <li>经核实的作弊行为将按学校相关规定严肃处理。</li>
                </ol>
                <h4>三、技术要求</h4>
                <ol>
                  <li>使用Chrome、Edge或Firefox最新版本浏览器。</li>
                  <li>确保摄像头、麦克风工作正常，网络连接稳定。</li>
                  <li>考试过程中如遇技术问题，请立即联系监考教师。</li>
                </ol>
              </div>
            </div>
            <label className="agreement-checkbox">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              <span>我已认真阅读并同意遵守以上考试须知和考场规则，承诺诚信考试。</span>
            </label>
          </div>
        )}

        {/* 步骤5：完成 */}
        {step === 5 && (
          <div className="complete-section">
            <div className="complete-icon">🎉</div>
            <h2 className="complete-title">信息采集完成！</h2>
            <p className="complete-desc">您的身份信息、人脸照片、设备检测和须知确认均已完成，点击下方按钮进入考试。</p>
            <div className="complete-summary">
              <div className="complete-item"><span className="complete-label">考生姓名</span><span className="complete-value">{form.name}</span></div>
              <div className="complete-item"><span className="complete-label">学号</span><span className="complete-value">{form.student_no}</span></div>
              <div className="complete-item"><span className="complete-label">人脸采集</span><span className="complete-value ok">✓ 已完成</span></div>
              <div className="complete-item"><span className="complete-label">设备检测</span><span className="complete-value ok">✓ {Object.values(devices).filter(Boolean).length}/4 通过</span></div>
              <div className="complete-item"><span className="complete-label">须知确认</span><span className="complete-value ok">✓ 已确认</span></div>
            </div>
            <button className="btn primary large" onClick={submit} disabled={submitting}>
              {submitting ? '提交中...' : '🚀 进入考试'}
            </button>
          </div>
        )}

        {/* 底部导航按钮 */}
        {step < 5 && (
          <div className="checkin-footer">
            {step > 1 ? (
              <button className="btn" onClick={prevStep}>← 上一步</button>
            ) : (
              <button className="btn" onClick={() => navigate('/')}>返回工作台</button>
            )}
            <button className="btn primary" onClick={nextStep} disabled={!canNext()}>
              {step === 4 ? '完成采集 →' : '下一步 →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

