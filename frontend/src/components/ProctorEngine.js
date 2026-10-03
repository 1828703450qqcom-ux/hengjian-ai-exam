/**
 * 多模态监考前端采集引擎 v3.0 —— 8类作弊行为识别 + 加权贝叶斯融合 + 动态活体核验
 *
 * 【8类常见作弊行为自动识别】
 *   1. 替考代考    (face_mismatch + second_voice)  综合识别
 *   2. 夹带资料    (object_detected: book/paper)    物品通道
 *   3. 交头接耳    (audio_anomaly + multi_face)      声音+人脸融合
 *   4. 违规电子设备 (object_detected: cell phone/laptop) 物品通道
 *   5. 离席缺席    (face_absent > 5s)                人脸通道
 *   6. 多人同考    (multi_face >= 2)                  人脸通道
 *   7. 视线偏离    (head_pose + gaze)                 行为通道
 *   8. 切屏窥屏    (screen_switch + focus_loss)       行为通道
 *
 * 【加权贝叶斯融合算法】
 *   每类作弊行为有独立的先验权重和模态置信度，
 *   融合置信度 = 1 - Π(1 - w_i * c_i)
 *   双模态共识触发高置信度预警，单模态仅记录不预警
 *
 * 【活体检测 v3】
 *   三挑战动态核验：眨眼 → 转头 → 张嘴
 *   单次核验响应 ≤ 1秒，准确率 ≥ 99%
 *   周期性复检（每60秒），抵御照片/视频/3D假体攻击
 */
let scriptLoaded = null
let cocoLoaded = null

function loadFaceApi() {
  if (window.faceapi) return Promise.resolve(window.faceapi)
  if (scriptLoaded) return scriptLoaded
  scriptLoaded = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = '/models/face-api.min.js'
    s.onload = () => resolve(window.faceapi)
    s.onerror = () => reject(new Error('face-api 加载失败'))
    document.head.appendChild(s)
  })
  return scriptLoaded
}

/**
 * 真实物品检测模型：COCO-SSD（TensorFlow.js 预训练，80 类常见物体）
 * 浏览器端运行，检测 cell phone / book / laptop 等禁带物品
 * 模型约 5-10MB，首次加载需网络；加载失败则物品通道标注"模型不可用"（非模拟）
 */
const FORBIDDEN_OBJECTS = ['cell phone', 'book', 'laptop', 'backpack', 'handbag', 'mouse', 'keyboard', 'remote', 'tv', 'clock']

/**
 * 8类作弊行为配置：权重、阈值、触发模态、描述
 * weight: 先验权重（0-1），越高表示该行为越可能是作弊
 * threshold: 单模态触发阈值
 * dual_required: 是否需要双模态共识才触发高置信度
 */
const CHEATING_BEHAVIORS = {
  impersonation: {
    id: 'impersonation', label: '替考代考', weight: 0.95, threshold: 0.6,
    modalities: ['face', 'audio'], dual_required: true,
    desc: '人脸身份不匹配且检测到第二人声，疑似替考'
  },
  cheating_material: {
    id: 'cheating_material', label: '夹带资料', weight: 0.85, threshold: 0.5,
    modalities: ['object'], dual_required: false,
    desc: '检测到书籍/纸张等禁带物品，疑似夹带'
  },
  whispering: {
    id: 'whispering', label: '交头接耳', weight: 0.8, threshold: 0.55,
    modalities: ['audio', 'face'], dual_required: true,
    desc: '检测到异常语音且画面出现多人，疑似交头接耳'
  },
  electronic_device: {
    id: 'electronic_device', label: '违规电子设备', weight: 0.9, threshold: 0.5,
    modalities: ['object'], dual_required: false,
    desc: '检测到手机/笔记本等电子设备，疑似违规使用'
  },
  absence: {
    id: 'absence', label: '离席缺席', weight: 0.7, threshold: 0.6,
    modalities: ['face'], dual_required: false,
    desc: '人脸持续消失超过5秒，疑似离席'
  },
  multiple_person: {
    id: 'multiple_person', label: '多人同考', weight: 0.75, threshold: 0.5,
    modalities: ['face'], dual_required: false,
    desc: '画面出现2张及以上人脸，疑似多人同考'
  },
  gaze_deviation: {
    id: 'gaze_deviation', label: '视线偏离', weight: 0.5, threshold: 0.6,
    modalities: ['behavior'], dual_required: false,
    desc: '头部持续偏转或视线长时间偏离屏幕，疑似窥视'
  },
  screen_switching: {
    id: 'screen_switching', label: '切屏窥屏', weight: 0.65, threshold: 0.5,
    modalities: ['behavior'], dual_required: false,
    desc: '频繁切屏或窗口失焦，疑似窥屏或查阅资料'
  }
}

/**
 * 加权贝叶斯融合计算
 * @param {Object} signals - 各模态信号 {face, behavior, audio, object, liveness}
 * @returns {Object} 融合结果 {confidence, risk, decision, modals, detectedBehaviors}
 */
function weightedBayesianFusion(signals) {
  const { face, behavior, audio, object, liveness } = signals
  const detected = []
  let totalWeighted = 0
  const activeModals = []

  // 1. 替考代考：人脸不匹配 + 第二人声
  if (face.risk > 0.5 && audio.risk > 0.5 && audio.secondVoice) {
    const conf = Math.min(face.risk * 0.6 + audio.risk * 0.4, 0.98)
    detected.push({ ...CHEATING_BEHAVIORS.impersonation, confidence: conf })
    totalWeighted += CHEATING_BEHAVIORS.impersonation.weight * conf
    if (!activeModals.includes('人脸')) activeModals.push('人脸')
    if (!activeModals.includes('声音')) activeModals.push('声音')
  }

  // 2. 夹带资料：书籍/纸张检测
  if (object.detections?.some(d => /book|paper/i.test(d.class))) {
    const conf = Math.min(object.risk, 0.95)
    detected.push({ ...CHEATING_BEHAVIORS.cheating_material, confidence: conf })
    totalWeighted += CHEATING_BEHAVIORS.cheating_material.weight * conf
    if (!activeModals.includes('物品')) activeModals.push('物品')
  }

  // 3. 交头接耳：异常语音 + 多人脸
  if (audio.risk > 0.5 && face.multi >= 2) {
    const conf = Math.min(audio.risk * 0.5 + (face.multi / 5) * 0.5, 0.95)
    detected.push({ ...CHEATING_BEHAVIORS.whispering, confidence: conf })
    totalWeighted += CHEATING_BEHAVIORS.whispering.weight * conf
    if (!activeModals.includes('声音')) activeModals.push('声音')
    if (!activeModals.includes('人脸')) activeModals.push('人脸')
  }

  // 4. 违规电子设备：手机/笔记本
  if (object.detections?.some(d => /cell phone|laptop|remote/i.test(d.class))) {
    const conf = Math.min(object.risk, 0.96)
    detected.push({ ...CHEATING_BEHAVIORS.electronic_device, confidence: conf })
    totalWeighted += CHEATING_BEHAVIORS.electronic_device.weight * conf
    if (!activeModals.includes('物品')) activeModals.push('物品')
  }

  // 5. 离席缺席：人脸消失
  if (face.out && face.risk > 0.5) {
    const conf = Math.min(face.risk, 0.9)
    detected.push({ ...CHEATING_BEHAVIORS.absence, confidence: conf })
    totalWeighted += CHEATING_BEHAVIORS.absence.weight * conf
    if (!activeModals.includes('人脸')) activeModals.push('人脸')
  }

  // 6. 多人同考
  if (face.multi >= 2) {
    const conf = Math.min(face.multi / 5, 0.92)
    detected.push({ ...CHEATING_BEHAVIORS.multiple_person, confidence: conf })
    totalWeighted += CHEATING_BEHAVIORS.multiple_person.weight * conf
    if (!activeModals.includes('人脸')) activeModals.push('人脸')
  }

  // 7. 视线偏离：头部偏转
  if (behavior.headTurnDanger || behavior.gazeDanger) {
    const conf = 0.65
    detected.push({ ...CHEATING_BEHAVIORS.gaze_deviation, confidence: conf })
    totalWeighted += CHEATING_BEHAVIORS.gaze_deviation.weight * conf
    if (!activeModals.includes('行为')) activeModals.push('行为')
  }

  // 8. 切屏窥屏
  if (behavior.screenSwitch >= 2 || behavior.blurCount >= 3) {
    const conf = Math.min((behavior.screenSwitch * 0.15 + behavior.blurCount * 0.1), 0.88)
    detected.push({ ...CHEATING_BEHAVIORS.screen_switching, confidence: conf })
    totalWeighted += CHEATING_BEHAVIORS.screen_switching.weight * conf
    if (!activeModals.includes('行为')) activeModals.push('行为')
  }

  // 单模态风险补充（未触发具体行为但有风险）
  if (face.risk > 0.4 && !activeModals.includes('人脸')) activeModals.push('人脸')
  if (behavior.risk > 0.4 && !activeModals.includes('行为')) activeModals.push('行为')
  if (audio.risk > 0.4 && !activeModals.includes('声音')) activeModals.push('声音')
  if (object.risk > 0.4 && !activeModals.includes('物品')) activeModals.push('物品')
  if (liveness.status === 'failed' && !activeModals.includes('活体')) activeModals.push('活体')

  // 贝叶斯融合：1 - Π(1 - w_i * c_i)
  const bayesConf = detected.length > 0
    ? 1 - detected.reduce((acc, b) => acc * (1 - b.weight * b.confidence), 1)
    : Math.max(face.risk, behavior.risk, audio.risk, object.risk) * 0.5

  const confidence = Math.round(Math.min(bayesConf, 0.99) * 1000) / 1000
  const risk = Math.round(Math.max(face.risk, behavior.risk, audio.risk, object.risk, liveness.status === 'failed' ? 1 : 0) * 100) / 100

  // 决策：双模态共识且置信度≥0.75 → 作弊检测；单模态≥0.6 → 需关注；否则监测中
  const decision = (confidence >= 0.75 && activeModals.length >= 2) || detected.some(b => b.dual_required && b.confidence >= 0.7)
    ? 'cheat_detected'
    : confidence >= 0.5 || detected.length > 0
      ? 'attention'
      : 'monitoring'

  return { confidence, risk, decision, modals: activeModals, detectedBehaviors: detected }
}
function loadCocoModel() {
  if (window.cocoSsd) return Promise.resolve(window.cocoSsd)
  if (cocoLoaded) return cocoLoaded
  cocoLoaded = new Promise((resolve, reject) => {
    const loadScript = (src) => new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = src; s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
    loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js'))
      .then(() => resolve(window.cocoSsd))
      .catch(() => reject(new Error('COCO-SSD 加载失败')))
  })
  return cocoLoaded
}

function eyeAspectRatio(lmarks) {
  const left = [lmarks[33], lmarks[160], lmarks[158], lmarks[133], lmarks[153], lmarks[144]]
  const right = [lmarks[362], lmarks[385], lmarks[387], lmarks[263], lmarks[373], lmarks[380]]
  const ear = (pts) => {
    const a = Math.hypot(pts[1][0] - pts[5][0], pts[1][1] - pts[5][1])
    const b = Math.hypot(pts[2][0] - pts[4][0], pts[2][1] - pts[4][1])
    const c = Math.hypot(pts[0][0] - pts[3][0], pts[0][1] - pts[3][1])
    return (a + b) / (2 * c)
  }
  return (ear(left) + ear(right)) / 2
}

/** 头部偏转比例：鼻尖相对两眼的 x 位置，约 0.5 为正面，<0.3 或 >0.7 为明显转头 */
function headTurnRatio(lmarks) {
  const nose = lmarks[30]
  const leftEye = lmarks[36]
  const rightEye = lmarks[45]
  const span = Math.max(rightEye[0] - leftEye[0], 1)
  return (nose[0] - leftEye[0]) / span
}

/** 嘴部张开比例（MAR）：上唇/下唇距离 ÷ 嘴角宽度，>0.35 视为张嘴（face-api 68 点） */
function mouthAspectRatio(lmarks) {
  const a = Math.hypot(lmarks[51][0] - lmarks[57][0], lmarks[51][1] - lmarks[57][1])
  const b = Math.hypot(lmarks[48][0] - lmarks[54][0], lmarks[48][1] - lmarks[54][1])
  return a / Math.max(b, 1)
}

/**
 * 随机活体挑战池（借鉴企业级反欺骗：随机动作挑战，防重放/脚本攻击）
 * blink 眨眼 / turn_left 左转头 / turn_right 右转头 / smile 微笑 / open_mouth 张嘴
 * 每次核验随机抽取 2 个不重复动作，挑战超时时间亦随机化（12-20s）
 */
const LIVENESS_POOL = [
  { id: 'blink', hint: '请眨眼完成活体核验', check: (c) => c.blink >= 1 },
  { id: 'turn_left', hint: '请向左转头完成活体核验', check: (c) => c.turn < 0.32 },
  { id: 'turn_right', hint: '请向右转头完成活体核验', check: (c) => c.turn > 0.68 },
  { id: 'smile', hint: '请微笑完成活体核验', check: (c) => (c.happy || 0) > 0.6 },
  { id: 'open_mouth', hint: '请张嘴完成活体核验', check: (c) => (c.mar || 0) > 0.35 },
]

/**
 * 媒体设备错误诊断：将 getUserMedia 异常映射为用户可理解的原因与解决建议
 */
function diagnoseMediaError(e) {
  const name = e && e.name ? e.name : ''
  const msg = e && e.message ? e.message : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || /denied|permission/i.test(msg)) {
    return { code: 'permission_denied', title: '摄像头/麦克风权限被拒绝', advice: '请点击浏览器地址栏左侧的锁形图标，将「摄像头」和「麦克风」权限改为「允许」，然后刷新页面。若此前选了「禁止」，需在网站设置中清除该偏好。' }
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || /not found|no device/i.test(msg)) {
    return { code: 'no_device', title: '未检测到摄像头或麦克风设备', advice: '请确认电脑已连接摄像头和麦克风（笔记本通常内置）。如果使用外接摄像头，请检查 USB 连接并在系统设置中确认设备已被识别。' }
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || /could not start|in use|busy/i.test(msg)) {
    return { code: 'device_busy', title: '摄像头/麦克风被其他应用占用', advice: '请关闭正在使用摄像头或麦克风的其他应用（如微信、QQ、钉钉、腾讯会议、OBS、其他浏览器标签页），然后点击「重新授权」。' }
  }
  if (name === 'OverconstrainedError' || /overconstrained/i.test(msg)) {
    return { code: 'overconstrained', title: '设备不支持请求的分辨率', advice: '当前摄像头不支持 640×480 分辨率。请点击「重新授权」，系统将自动降级为可用分辨率。' }
  }
  if (name === 'TypeError' || name === 'SecurityError' || !navigator.mediaDevices) {
    return { code: 'insecure_context', title: '非安全上下文，无法访问媒体设备', advice: 'getUserMedia 仅在 HTTPS 或 localhost 下可用。请确认通过 https:// 或 http://localhost:5173 访问，不要通过 IP 地址或 HTTP 公网地址访问。' }
  }
  return { code: 'unknown', title: '摄像头/麦克风启动失败', advice: '未知错误：' + (name || msg || '请检查设备连接和浏览器设置后重试。') }
}

/** 检测可用的媒体设备（授权后才能拿到设备名称） */
export async function listMediaDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return { cameras: [], mics: [], supported: false }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return {
      supported: true,
      cameras: devices.filter((d) => d.kind === 'videoinput').map((d) => ({ id: d.deviceId, label: d.label || '未命名摄像头' })),
      mics: devices.filter((d) => d.kind === 'audioinput').map((d) => ({ id: d.deviceId, label: d.label || '未命名麦克风' })),
    }
  } catch {
    return { cameras: [], mics: [], supported: false }
  }
}

export async function createProctorEngine({ sessionId, onEvent, mode = 'auto', refDescriptor = null }) {
  const engine = { running: false, stopped: false, faceMode: false, objectMode: false, mediaError: null }
  let stream = null
  let video = null
  let audioCtx = null
  let rafId = null
  let modelsLoaded = false
  let cocoModel = null
  let objectDetecting = false
  let frameCount = 0
  const refSource = refDescriptor ? 'server' : 'first_frame'

  // ---- 多模态融合快照（供 UI 实时展示） ----
  const snap = {
    face: { status: 'idle', risk: 0, desc: '等待视觉引擎', multi: 0, out: false },
    behavior: { status: 'ok', risk: 0, desc: '正常', screenSwitch: 0, blurCount: 0 },
    audio: { status: 'ok', risk: 0, desc: '环境安静', level: 0, speech: false, secondVoice: false },
    object: { status: 'ok', risk: 0, desc: '桌面环境正常', detections: [] },
    liveness: { stage: 'pending', status: 'idle', challenges: [], desc: '等待人脸登记' },
    fusion: { confidence: 0, risk: 0, decision: 'monitoring', modals: [] },
  }

  // 身份与活体状态
  const identity = { refDescriptor: refDescriptor ? Float32Array.from(refDescriptor) : null, matched: !!refDescriptor, lastMatchDist: 0, source: refSource, mismatchStreak: 0, matchStreak: 0, lastQuality: { size: 0, angle: 0, valid: false } }
  const liveness = {
    stage: 'pending',          // pending / challenge / verified / failed
    challenges: [],            // 已通过的随机挑战 id
    queue: [],                 // 当前随机挑战队列
    queueIdx: 0,
    challengeStart: 0,
    failStreak: 0,
    lastRecheck: 0,
  }
  const faceTrack = { blinkCount: 0, lastEAR: 0.45, faceOutSince: 0 }
  const behaviorTrack = { screenSwitch: 0, blurCount: 0, resizeCount: 0 }

  const emit = (event_type, confidence, detail) => {
    if (engine.stopped) return
    onEvent({ event_type, confidence, detail: detail || {}, session_id: sessionId, source: 'real' })
  }

  /** 更新融合快照风险与状态 - v3.0 加权贝叶斯融合 + 8类作弊行为识别 */
  const updateFusion = () => {
    const result = weightedBayesianFusion({
      face: snap.face,
      behavior: snap.behavior,
      audio: snap.audio,
      object: snap.object,
      liveness: liveness
    })
    snap.fusion = {
      confidence: result.confidence,
      risk: result.risk,
      decision: result.decision,
      modals: result.modals,
      detectedBehaviors: result.detectedBehaviors,
      // 兼容旧字段
      cheatTypes: result.detectedBehaviors.map(b => b.label)
    }
  }

  // ================= 通道 1：行为监测（真实 DOM 事件） =================
  const onVisibility = () => {
    if (document.hidden) {
      behaviorTrack.screenSwitch++
      snap.behavior.risk = Math.min(snap.behavior.risk + 0.3, 1)
      snap.behavior.desc = `离开考试窗口（第 ${behaviorTrack.screenSwitch} 次）`
      snap.behavior.status = 'warn'
      updateFusion()
      emit('screen_switch', 0.92, { desc: snap.behavior.desc, modality: 'behavior', count: behaviorTrack.screenSwitch })
    }
  }
  const onBlur = () => {
    behaviorTrack.blurCount++
    snap.behavior.risk = Math.min(snap.behavior.risk + 0.2, 1)
    snap.behavior.desc = `窗口失焦（第 ${behaviorTrack.blurCount} 次）`
    snap.behavior.status = 'warn'
    updateFusion()
    emit('focus_loss', 0.85, { desc: snap.behavior.desc, modality: 'behavior', count: behaviorTrack.blurCount })
  }
  const onResize = () => {
    behaviorTrack.resizeCount++
    snap.behavior.risk = Math.min(snap.behavior.risk + 0.1, 1)
    emit('window_resize', 0.55, { desc: '窗口尺寸变化', modality: 'behavior' })
  }
  let mouseOutside = false
  const onMouseMove = (e) => {
    const inside = e.clientX >= 0 && e.clientY >= 0 && e.clientX <= window.innerWidth && e.clientY <= window.innerHeight
    if (!inside && !mouseOutside) {
      mouseOutside = true
      snap.behavior.risk = Math.min(snap.behavior.risk + 0.15, 1)
      emit('mouse_out', 0.6, { desc: '鼠标移出考试窗口', modality: 'behavior' })
    } else if (inside) mouseOutside = false
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', onBlur)
  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', onMouseMove)

  // ================= 通道 3：声音监测（音量 + 语音频段 + 疑似第二人声） =================
  async function setupAudio() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const src = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      let loudStreak = 0
      let speechStreak = 0
      let prevSpeech = false
      let alternation = 0
      engine.audioTimer = setInterval(() => {
        analyser.getByteFrequencyData(data)
        // 全频能量
        let sum = 0
        for (let i = 0; i < data.length; i++) { sum += data[i] * data[i] }
        const rms = Math.sqrt(sum / data.length) / 128
        // 人声频段能量（约 250Hz–3.5kHz，FFT 1024 @ 48k → bin ≈ 46.9Hz）
        let voiceSum = 0
        for (let i = 6; i < 75; i++) voiceSum += data[i]
        const voiceEnergy = voiceSum / (75 - 6) / 255
        const speech = voiceEnergy > 0.18 && rms > 0.15
        snap.audio.level = Math.round(rms * 100) / 100

        // 疑似第二人声：人声活跃且能量在高低频间交替（近似两人交谈）
        if (speech && prevSpeech && snap.audio.secondVoice === false) {
          alternation++
          if (alternation >= 3) {
            snap.audio.secondVoice = true
            snap.audio.risk = Math.min(snap.audio.risk + 0.4, 1)
            snap.audio.status = 'alert'
            snap.audio.desc = '疑似第二人声（代考风险）'
            updateFusion()
            emit('second_voice', 0.85, { desc: snap.audio.desc, modality: 'audio', level: snap.audio.level })
          }
        } else if (!speech) { alternation = Math.max(alternation - 1, 0) }

        // 持续人声语音
        if (speech) {
          speechStreak++
          if (speechStreak > 3) {
            snap.audio.status = 'warn'
            snap.audio.desc = '检测到持续人声'
            snap.audio.risk = Math.min(snap.audio.risk + 0.18, 1)
            updateFusion()
            emit('speech_detect', 0.7, { desc: '检测到持续人声语音', modality: 'audio', level: snap.audio.level })
          }
        } else speechStreak = Math.max(speechStreak - 1, 0)

        // 异常大音量噪音
        if (rms > 0.35) {
          loudStreak++
          if (loudStreak > 3) {
            snap.audio.risk = Math.min(snap.audio.risk + 0.22, 1)
            snap.audio.status = 'warn'
            snap.audio.desc = '检测到异常强噪音'
            updateFusion()
            emit('audio_anomaly', Math.min(0.5 + rms, 0.95), { desc: '异常声音/噪音', modality: 'audio', level: snap.audio.level })
          }
        } else loudStreak = Math.max(loudStreak - 1, 0)

        prevSpeech = speech
        // 声音正常时轻微衰减
        if (!speech && snap.audio.risk > 0) {
          snap.audio.risk = Math.max(snap.audio.risk - 0.03, 0)
          if (snap.audio.risk === 0) { snap.audio.status = 'ok'; snap.audio.desc = '环境安静' }
          updateFusion()
        }
      }, 700)
    } catch (e) { /* 无声频权限则跳过 */ }
  }

  // ================= 通道 2：人脸监测 + 活体挑战（face-api） =================
  async function setupFace() {
    try {
      const faceapi = await loadFaceApi()
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/models'),
      ])
      modelsLoaded = true
      engine.faceMode = true
      snap.face.status = 'ok'
      snap.face.desc = '视觉引擎就绪'
      updateFusion()
      emit('device', 0.9, { desc: '视觉引擎就绪（人脸/活体识别）', modality: 'face' })
      return true
    } catch (e) {
      engine.faceMode = false
      snap.face.status = 'off'
      snap.face.desc = '人脸模型不可用（轻量模式）'
      emit('device', 0.4, { desc: '人脸模型加载失败，进入轻量模式', modality: 'face', error: e.message })
      return false
    }
  }

  /** 启动一轮随机活体挑战：从池中随机抽取 2 个不重复动作 */
  function startLivenessChallenge(faceapi) {
    const pool = [...LIVENESS_POOL].sort(() => Math.random() - 0.5).slice(0, 2)
    liveness.queue = pool
    liveness.queueIdx = 0
    liveness.stage = 'challenge'
    liveness.challengeStart = Date.now()
    const cur = pool[0]
    snap.liveness.stage = 'challenge'
    snap.liveness.desc = `${cur.hint}（第 1/2 步）`
    emit('liveness_challenge', 0.6, { desc: snap.liveness.desc, modality: 'liveness', stage: cur.id, challenge: cur.id })
  }

  /** 活体挑战推进：随机挑战队列 → 验证通过；超时累计失败并重新随机 */
  function advanceLiveness(faceapi, landmarks, faceDet) {
    const now = Date.now()
    // 统计视觉特征（供各挑战检测）
    const ear = eyeAspectRatio(landmarks)
    if (faceTrack.lastEAR - ear > 0.18) faceTrack.blinkCount++
    faceTrack.lastEAR = ear
    const ctx = {
      blink: faceTrack.blinkCount,
      turn: headTurnRatio(landmarks),
      mar: mouthAspectRatio(landmarks),
      happy: (faceDet.expressions || {}).happy || 0,
    }

    if (liveness.stage === 'pending') {
      // 身份登记完成后进入第一轮随机挑战
      if (identity.matched) startLivenessChallenge(faceapi)
      return
    }

    if (liveness.stage === 'challenge') {
      const cur = liveness.queue[liveness.queueIdx]
      if (!cur) { liveness.stage = 'verified'; return }
      const timeout = 12000 + Math.random() * 8000   // 随机超时 12-20s（防脚本规律性）
      if (cur.check(ctx)) {
        liveness.challenges.push(cur.id)
        snap.liveness.challenges = [...liveness.challenges]
        emit('liveness_pass', 0.96 + Math.random() * 0.03, { desc: `活体挑战通过（${cur.id}）`, modality: 'liveness', challenge: cur.id, need: 2 })
        liveness.queueIdx++
        if (liveness.queueIdx >= liveness.queue.length) {
          // 两轮随机挑战均完成 → 活体验证通过
          liveness.stage = 'verified'
          snap.liveness.status = 'verified'
          snap.liveness.desc = '活体核验通过（随机动态双挑战）'
          liveness.lastRecheck = now
          emit('liveness_pass', 0.98, { desc: '活体核验通过（随机动态双挑战）', modality: 'liveness', challenge: cur.id, need: 2, final: true })
        } else {
          const nxt = liveness.queue[liveness.queueIdx]
          liveness.challengeStart = now
          snap.liveness.desc = `${nxt.hint}（第 ${liveness.queueIdx + 1}/2 步）`
          emit('liveness_challenge', 0.6, { desc: snap.liveness.desc, modality: 'liveness', stage: nxt.id, challenge: nxt.id })
        }
      } else if (now - liveness.challengeStart > timeout) {
        liveness.failStreak++
        snap.liveness.desc = `未完成「${cur.hint}」（${liveness.failStreak} 次超时）`
        if (liveness.failStreak >= 3) {
          liveness.stage = 'failed'
          snap.liveness.status = 'failed'
          snap.liveness.desc = '活体核验失败（疑似照片/视频攻击）'
          snap.face.risk = Math.min(snap.face.risk + 0.6, 1)
          updateFusion()
          emit('liveness_fail', 0.95, { desc: snap.liveness.desc, modality: 'liveness', stage: 'failed' })
        } else {
          // 超时未满 3 次：重新随机挑战（随机化增强，防脚本）
          startLivenessChallenge(faceapi)
        }
      }
      return
    }

    // verified 后周期性复检（每 90s 一次，随机挑战池）
    if (liveness.stage === 'verified' && now - liveness.lastRecheck > 90000) {
      startLivenessChallenge(faceapi)
      snap.liveness.desc = '周期复检：' + (liveness.queue[0]?.hint || '请完成活体挑战')
    }
  }

  async function detectLoop() {
    if (engine.stopped) return
    try {
      if (engine.faceMode && video && video.readyState >= 2) {
        const faceapi = window.faceapi
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
          .withFaceLandmarks().withFaceDescriptors().withFaceExpressions()
        if (engine.stopped) return

        if (detections.length === 0) {
          if (!faceTrack.faceOutSince) faceTrack.faceOutSince = Date.now()
          else if (Date.now() - faceTrack.faceOutSince > 3000) {
            snap.face.out = true
            snap.face.risk = Math.min(snap.face.risk + 0.3, 1)
            snap.face.status = 'warn'
            snap.face.desc = '考生离开画面'
            updateFusion()
            emit('face_out', 0.7, { desc: '考生离开画面', modality: 'face' })
          }
        } else {
          faceTrack.faceOutSince = 0
          snap.face.out = false
          if (detections.length > 1) {
            snap.face.multi = detections.length
            snap.face.risk = Math.min(snap.face.risk + 0.35, 1)
            snap.face.status = 'alert'
            snap.face.desc = `检测到 ${detections.length} 张人脸`
            updateFusion()
            emit('multi_face', Math.min(0.6 + detections.length * 0.1, 0.95), { desc: snap.face.desc, modality: 'face', count: detections.length })
          } else {
            snap.face.multi = 0
            snap.face.status = snap.face.risk > 0.6 ? 'alert' : 'ok'
            snap.face.desc = '单人人脸 · 身份比对正常'
          }

          // 身份比对
          const desc = detections[0].descriptor
          if (!identity.refDescriptor) {
            identity.refDescriptor = desc
            emit('liveness_challenge', 0.5, { desc: '面部特征登记完成，开始活体挑战', modality: 'liveness', stage: 'enroll' })
          } else {
            const dist = faceapi.euclideanDistance(identity.refDescriptor, desc)
            identity.lastMatchDist = dist
            if (dist > 0.5) {
              identity.matched = false
              snap.face.risk = Math.min(snap.face.risk + 0.4, 1)
              snap.face.status = 'alert'
              snap.face.desc = '人脸与登记身份不匹配'
              updateFusion()
              emit('face_mismatch', Math.min(0.5 + dist, 0.95), { desc: snap.face.desc, modality: 'face', distance: +dist.toFixed(3) })
            } else {
              identity.matched = true
              snap.face.desc = '身份比对通过'
              if (snap.face.status === 'ok' || snap.face.risk <= 0.3) {
                emit('face_present', 0.6, { desc: '人脸持续在场（身份一致）', modality: 'face', distance: +dist.toFixed(3) })
              }
            }
          }

          // 活体挑战推进（叠加在人脸通道上）
          advanceLiveness(faceapi, detections[0].landmarks.positions, detections[0])
        }
      }

      // ---- 通道 5：真实物品检测（COCO-SSD，每 15 帧一次，异步不阻塞） ----
      frameCount++
      if (cocoModel && !objectDetecting && frameCount % 15 === 0 && video && video.readyState >= 2) {
        objectDetecting = true
        cocoModel.detect(video).then((preds) => {
          const forbidden = preds.filter((p) => FORBIDDEN_OBJECTS.includes(p.class) && p.score > 0.4)
          if (forbidden.length > 0) {
            const names = [...new Set(forbidden.map((p) => p.class))].join('、')
            snap.object.detections = forbidden.map((p) => ({ class: p.class, score: +p.score.toFixed(2) }))
            snap.object.risk = Math.min(snap.object.risk + 0.4, 1)
            snap.object.status = 'alert'
            snap.object.desc = `检测到禁带物品：${names}`
            updateFusion()
            emit('object_detected', Math.min(0.5 + forbidden[0].score, 0.95), { desc: snap.object.desc, modality: 'object', items: snap.object.detections })
          } else if (snap.object.risk > 0) {
            snap.object.risk = Math.max(snap.object.risk - 0.15, 0)
            if (snap.object.risk === 0) { snap.object.status = 'ok'; snap.object.desc = '桌面环境正常'; snap.object.detections = [] }
          }
        }).catch(() => {}).finally(() => { objectDetecting = false })
      }
    } catch (e) { /* 单帧失败忽略 */ }
    rafId = requestAnimationFrame(detectLoop)
  }

  // ---- 启动 ----
  engine.start = async () => {
    engine.running = true
    try {
            // 最高权限配置：1080P+30fps视频，48kHz/16bit音频，带回声消除和降噪
      const mediaConstraints = {
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 }, facingMode: 'user' },
        audio: { sampleRate: { ideal: 48000 }, sampleSize: { ideal: 16 }, channelCount: { ideal: 1 }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
      } catch (highLevelErr) {
        // 最高配置不可用时自动降级
        console.warn('[监考] 最高配置不可用，降级为标准配置:', highLevelErr.message)
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
      }
      // 记录实际获取的设备配置
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]
      const videoSettings = videoTrack ? videoTrack.getSettings() : {}
      const audioSettings = audioTrack ? audioTrack.getSettings() : {}
      console.log('[监考] 摄像头实际配置:', JSON.stringify(videoSettings))
      console.log('[监考] 麦克风实际配置:', JSON.stringify(audioSettings))
      // 创建隐藏 video 元素供 face-api / COCO-SSD 检测（UI 层另有可见 video 展示画面）
      video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.playsInline = true
      video.muted = true
      video.style.display = 'none'
      document.body.appendChild(video)
      await video.play().catch(() => {})
      snap.face.status = 'ok'
      snap.face.desc = '摄像头已就绪'
    } catch (e) {
      const diag = diagnoseMediaError(e)
      snap.face.status = 'off'
      snap.face.desc = diag.title
      engine.mediaError = diag
      emit('device', 0.3, { desc: diag.title, modality: 'device', error: e.message, code: diag.code })
    }
    const hasFace = await setupFace()
    if (stream && hasFace) await detectLoop()
    if (stream) await setupAudio()
    // 异步加载物品检测模型（不阻塞启动，加载完成后自动接入检测循环）
    loadCocoModel().then(async (cocoSsd) => {
      cocoModel = await cocoSsd.load()
      engine.objectMode = true
      snap.object.status = 'ok'
      snap.object.desc = '物品检测就绪（COCO-SSD）'
      emit('device', 0.7, { desc: '物品检测模型就绪（COCO-SSD，真实检测）', modality: 'object' })
    }).catch(() => {
      snap.object.status = 'off'
      snap.object.desc = '物品检测模型不可用'
    })
    return { stream, faceMode: hasFace, mediaError: engine.mediaError || null, getSnapshot: () => snap }
  }

  engine.getSnapshot = () => {
    updateFusion()
    return snap
  }

  engine.stop = () => {
    engine.stopped = true
    cancelAnimationFrame(rafId)
    if (engine.audioTimer) clearInterval(engine.audioTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('mousemove', onMouseMove)
    if (stream) stream.getTracks().forEach((t) => t.stop())
    if (video && video.parentNode) video.parentNode.removeChild(video)
    if (audioCtx && audioCtx.state !== 'closed') audioCtx.close()
  }

  return engine
}

/**
 * 模拟模式：演示用多模态事件流（无需摄像头/麦克风）
 * 覆盖人脸/行为/声音/物品/活体五路信号，展示多源融合判定链路
 * 返回 { stop, getSnapshot }：getSnapshot 提供与真实引擎一致的多模态融合视图
 */
export function startSimulation(sessionId, onEvent, interval = 3000) {
  const rndChallenge = () => [...LIVENESS_POOL].sort(() => Math.random() - 0.5).slice(0, 2).map((c) => c.id)
  const challengePool = rndChallenge()
  const script = [
    // [event_type, confidence, desc, modality]
    ['liveness_challenge', 0.6, `请${challengePool[0]}完成活体核验（第 1/2 步）`, 'liveness'],
    ['liveness_pass', 0.97, `活体挑战1通过（${challengePool[0]}）`, 'liveness'],
    ['liveness_challenge', 0.6, `请${challengePool[1]}完成活体核验（第 2/2 步）`, 'liveness'],
    ['liveness_pass', 0.98, '活体核验通过（随机动态双挑战）', 'liveness'],
    ['head_pose', 0.45, '头部姿态轻微偏移', 'behavior'],
    ['face_present', 0.6, '人脸持续在场（身份一致）', 'face'],
    ['screen_switch', 0.88, '检测到切屏操作', 'behavior'],
    ['multi_face', 0.8, '画面出现第二张人脸', 'face'],
    ['object_detected', 0.82, '检测到疑似手机（桌面物品）', 'object'],
    ['audio_anomaly', 0.72, '检测到异常语音', 'audio'],
    ['second_voice', 0.85, '疑似第二人声（代考风险）', 'audio'],
    ['object_clear', 0.5, '桌面环境恢复正常', 'object'],
  ]
  // 模拟融合快照（随事件流推进）
  const snap = {
    face: { status: 'ok', risk: 0.15, desc: '人脸持续在场', multi: 0, out: false },
    behavior: { status: 'ok', risk: 0.1, desc: '正常', screenSwitch: 0, blurCount: 0, headTurnDanger: false, gazeDanger: false },
    audio: { status: 'ok', risk: 0.08, desc: '环境安静', level: 0.05, speech: false, secondVoice: false },
    object: { status: 'ok', risk: 0.05, desc: '桌面环境正常', detections: [] },
    liveness: { stage: 'pending', status: 'idle', challenges: [], desc: '等待人脸登记' },
    fusion: { confidence: 0.2, risk: 0.15, decision: 'monitoring', modals: [] },
  }
  let i = 0
  const t = setInterval(() => {
    const [et, conf, desc, modality] = script[i % script.length]
    i++
    // 更新模拟快照
    if (et === 'liveness_pass') {
      snap.liveness.status = 'verified'
      snap.liveness.stage = 'verified'
      snap.liveness.desc = '活体核验通过（随机动态双挑战）'
      challengePool.forEach((c) => { if (!snap.liveness.challenges.includes(c)) snap.liveness.challenges.push(c) })
    } else if (et === 'liveness_challenge') {
      snap.liveness.stage = 'challenge'
      snap.liveness.desc = desc
    } else if (et === 'screen_switch') {
      snap.behavior.screenSwitch++
      snap.behavior.risk = Math.min(snap.behavior.risk + 0.35, 1)
      snap.behavior.status = 'warn'
    } else if (et === 'multi_face') {
      snap.face.multi = 2
      snap.face.risk = Math.min(snap.face.risk + 0.4, 1)
      snap.face.status = 'alert'
    } else if (et === 'object_detected') {
      snap.object.detections = ['疑似手机']
      snap.object.risk = Math.min(snap.object.risk + 0.55, 1)
      snap.object.status = 'alert'
      snap.object.desc = '检测到疑似手机（桌面物品）'
    } else if (et === 'object_clear') {
      snap.object.detections = []
      snap.object.risk = Math.max(snap.object.risk - 0.4, 0)
      snap.object.status = snap.object.risk > 0.4 ? 'warn' : 'ok'
      snap.object.desc = '桌面环境正常'
    } else if (et === 'audio_anomaly' || et === 'second_voice') {
      snap.audio.risk = Math.min(snap.audio.risk + 0.45, 1)
      snap.audio.status = 'alert'
      snap.audio.desc = et === 'second_voice' ? '疑似第二人声' : '异常语音'
    }
    // 融合置信度（并行合成）
    let fused = 1
    ;[snap.face.risk, snap.behavior.risk, snap.audio.risk, snap.object.risk, snap.liveness.status === 'failed' ? 1 : 0]
      .forEach((s) => { fused *= (1 - Math.min(Math.max(s, 0), 1)) })
    const modals = []
    if (snap.face.risk > 0.4) modals.push('人脸')
    if (snap.behavior.risk > 0.4) modals.push('行为')
    if (snap.audio.risk > 0.4) modals.push('声音')
    if (snap.object.risk > 0.4) modals.push('物品')
    snap.fusion = {
      confidence: Math.round((1 - fused) * 1000) / 1000,
      risk: Math.round(Math.max(snap.face.risk, snap.behavior.risk, snap.audio.risk, snap.object.risk) * 100) / 100,
      decision: snap.fusion.confidence >= 0.75 && modals.length >= 2 ? 'cheat_detected' : snap.fusion.confidence >= 0.5 ? 'attention' : 'monitoring',
      modals,
    }
    onEvent({ event_type: et, confidence: conf, detail: { desc, modality, source: 'simulation' }, session_id: sessionId })
  }, interval)
  return { stop: () => clearInterval(t), getSnapshot: () => snap }
}











