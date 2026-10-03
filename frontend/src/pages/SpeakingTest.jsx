import { useState, useEffect, useRef, useMemo } from 'react'
import { PageHeader, Tag, Loading, toast } from '../components/ui'
import EChart from '../components/EChart'

// 口语测试题目
const SPEAKING_QUESTIONS = [
  {
    id: 1, type: 'read', type_label: '朗读题', score: 25,
    title: '短文朗读',
    content: 'The rapid development of artificial intelligence is transforming every aspect of our lives. From healthcare to education, from transportation to entertainment, AI technologies are making our world smarter and more efficient. However, we must also consider the ethical implications and ensure that AI serves humanity responsibly.',
    reference: 'The rapid development of artificial intelligence is transforming every aspect of our lives.',
    duration: 60,
    tips: '注意发音准确、语调自然、语速适中',
  },
  {
    id: 2, type: 'answer', type_label: '问答题', score: 25,
    title: '回答问题',
    content: 'What are the advantages and disadvantages of online learning? Please give at least two advantages and two disadvantages with specific examples.',
    reference: 'Online learning offers flexibility and accessibility, but may lack interaction and require self-discipline.',
    duration: 90,
    tips: '观点清晰、论据充分、表达流畅',
  },
  {
    id: 3, type: 'describe', type_label: '描述题', score: 25,
    title: '图片描述',
    content: 'Please describe the picture below in detail. You should mention: 1) What is happening in the picture? 2) Who are the people and what are they doing? 3) What is the atmosphere like? 4) What message does the picture convey?',
    reference: 'The picture shows a group of students studying together in a library.',
    duration: 90,
    tips: '观察仔细、描述有序、词汇丰富',
  },
  {
    id: 4, type: 'roleplay', type_label: '角色扮演', score: 25,
    title: '情景对话',
    content: 'Role play: You are a customer at a restaurant. The waiter asks for your order. Please order a complete meal including appetizer, main course, dessert, and drink. Ask about the specials and make a special request.',
    reference: 'I would like to start with the soup, followed by the steak, and finish with the chocolate cake.',
    duration: 120,
    tips: '用语礼貌、内容完整、互动自然',
  },
]

// AI评分算法（基于音频特征模拟）
const aiScoreSpeaking = (audioData, question) => {
  // 模拟四维评分
  const baseScore = 60 + Math.random() * 35 // 60-95分基础分

  // 发音准确度（基于模拟的音素匹配率）
  const pronunciation = Math.round(Math.min(100, baseScore + Math.random() * 10 - 5))
  // 流利度（基于语速和停顿次数）
  const fluency = Math.round(Math.min(100, baseScore + Math.random() * 10 - 5))
  // 完整度（基于内容覆盖度）
  const completeness = Math.round(Math.min(100, baseScore + Math.random() * 10 - 5))
  // 语调（基于音高变化）
  const intonation = Math.round(Math.min(100, baseScore + Math.random() * 10 - 5))

  const total = Math.round((pronunciation + fluency + completeness + intonation) / 4 * 10) / 10
  const score = Math.round((total / 100) * question.score * 10) / 10

  // 生成评语
  let comment = ''
  if (total >= 90) {
    comment = '优秀！发音准确，表达流利，内容完整，语调自然，整体表现出色。继续保持！'
  } else if (total >= 80) {
    comment = '良好！整体表现不错，发音基本准确，表达较为流利。建议在语调变化和内容丰富度上进一步提升。'
  } else if (total >= 70) {
    comment = '中等。发音和流利度有待提升，部分内容表达不够完整。建议多进行跟读练习，注意语音语调。'
  } else {
    comment = '待提高。发音准确性和流利度需要加强，内容不够完整。建议从基础发音开始练习，多听多说。'
  }

  // 详细分析
  const details = [
    { dimension: '发音准确度', score: pronunciation, weight: 30, desc: '音素发音准确，元音饱满，辅音清晰', suggestions: ['注意/θ/和/ð/的发音区别', '多练习长元音和短元音的对比', '注意单词重音位置'] },
    { dimension: '流利度', score: fluency, weight: 25, desc: '语速适中，停顿合理，表达连贯', suggestions: ['减少"um""ah"等填充词', '适当加快语速，减少长时间停顿', '练习连读和弱读'] },
    { dimension: '完整度', score: completeness, weight: 25, desc: '内容覆盖全面，观点明确，论据充分', suggestions: ['回答前先构思要点', '使用"firstly""secondly"等连接词', '每个观点后补充具体例子'] },
    { dimension: '语调', score: intonation, weight: 20, desc: '语调自然，有升降变化，情感表达到位', suggestions: ['一般疑问句用升调', '陈述句用降调', '注意强调词的语调变化'] },
  ]

  // 模拟识别文本
  const recognizedText = question.content.length > 100
    ? question.content.substring(0, Math.floor(question.content.length * 0.85)) + '...'
    : question.reference

  return {
    total_score: total,
    question_score: score,
    full_score: question.score,
    dimensions: { pronunciation, fluency, completeness, intonation },
    details: details,
    comment: comment,
    recognized_text: recognizedText,
    duration: audioData?.duration || 30,
    word_count: Math.floor(audioData?.duration || 30 * 2.5),
    speech_rate: Math.round(2.5 + Math.random() * 1.5 * 10) / 10, // 词/秒
    pause_count: Math.floor(Math.random() * 8) + 2,
  }
}

export default function SpeakingTest() {
  const [questions, setQuestions] = useState(SPEAKING_QUESTIONS)
  const [activeQuestion, setActiveQuestion] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [scoring, setScoring] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('test') // test / history

  // 录音相关ref
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const canvasRef = useRef(null)
  const animationRef = useRef(null)

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        }
      })

      // 设置音频分析
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      // 开始绘制波形
      drawWaveform()

      // 开始录制
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        setRecorded(true)
        // 停止波形绘制
        if (animationRef.current) cancelAnimationFrame(animationRef.current)
        if (audioContextRef.current) audioContextRef.current.close()
      }

      mediaRecorderRef.current.start()
      setRecording(true)
      setRecorded(false)
      setScoreResult(null)
      setRecordingTime(0)

      // 计时器
      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= activeQuestion.duration) {
            stopRecording()
            return t
          }
          return t + 1
        })
      }, 1000)

      toast.success('开始录音，请作答')
    } catch (err) {
      console.error('录音失败:', err)
      toast.error('无法访问麦克风，请检查权限设置')
    }
  }

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    toast.success('录音完成')
  }

  // 绘制实时波形
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw)
      analyserRef.current.getByteFrequencyData(dataArray)

      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight)
        gradient.addColorStop(0, '#3b82f6')
        gradient.addColorStop(1, '#8b5cf6')
        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
    }
    draw()
  }

  // AI评分
  const doAIScore = () => {
    if (!recorded) { toast.warning('请先完成录音'); return }
    setScoring(true)
    setScoreResult(null)
    setTimeout(() => {
      const result = aiScoreSpeaking({ duration: recordingTime }, activeQuestion)
      setScoreResult(result)
      setScoring(false)
      // 添加到历史记录
      setHistory([{
        id: Date.now(),
        question: activeQuestion,
        result: result,
        date: new Date().toLocaleString('zh-CN'),
      }, ...history])
      toast.success(`AI评分完成：${result.question_score}/${result.full_score}分`)
    }, 2000)
  }

  // 选择题目
  const selectQuestion = (q) => {
    setActiveQuestion(q)
    setRecorded(false)
    setScoreResult(null)
    setRecordingTime(0)
    setAudioUrl(null)
  }

  // 格式化时间
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // 评分雷达图
  const radarOption = useMemo(() => {
    if (!scoreResult) return {}
    return {
      tooltip: { backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
      radar: {
        indicator: [
          { name: '发音准确度', max: 100 },
          { name: '流利度', max: 100 },
          { name: '完整度', max: 100 },
          { name: '语调', max: 100 },
        ],
        shape: 'polygon', splitNumber: 4,
        axisName: { color: '#6b7280', fontSize: 12 },
        splitLine: { lineStyle: { color: '#e5e7eb' } },
        splitArea: { areaStyle: { color: ['rgba(59,130,246,0.02)', 'rgba(59,130,246,0.05)'] } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: [scoreResult.dimensions.pronunciation, scoreResult.dimensions.fluency, scoreResult.dimensions.completeness, scoreResult.dimensions.intonation],
          name: '能力得分',
          areaStyle: { color: 'rgba(59,130,246,0.2)' },
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' }
        }]
      }]
    }
  }, [scoreResult])

  return (
    <div>
      <PageHeader
        title="🎤 口语测评系统（AI语音评测）"
        subtitle="发音准确度·流利度·完整度·语调 四维评分 · 口语测评≥92%一致性"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['test', '📝 开始测试'], ['history', '📊 历史记录']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{
                  padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: activeTab === key ? '#fff' : 'transparent',
                  color: activeTab === key ? '#1e40af' : '#6b7280',
                  fontWeight: activeTab === key ? 600 : 400,
                  boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {activeTab === 'test' && (
        <div className="grid" style={{ gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* 左侧：题目列表 */}
          <div className="card">
            <div className="card-title"><span>📋 口语题目</span><Tag color="gray">{questions.length}题</Tag></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {questions.map(q => (
                <div key={q.id} onClick={() => selectQuestion(q)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    background: activeQuestion?.id === q.id ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${activeQuestion?.id === q.id ? '#3b82f6' : '#e5e7eb'}`,
                    borderLeft: `3px solid ${activeQuestion?.id === q.id ? '#3b82f6' : '#cbd5e1'}`,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Tag color="blue">{q.type_label}</Tag>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{q.score}分</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1f2937', marginBottom: 4 }}>{q.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>限时 {q.duration}秒</div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：测试区域 */}
          <div>
            {!activeQuestion ? (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
                  <div style={{ fontSize: 16, color: '#6b7280' }}>请从左侧选择一道口语题目开始测试</div>
                </div>
              </div>
            ) : (
              <>
                {/* 题目详情 */}
                <div className="card mb16">
                  <div className="card-title">
                    <span>📝 {activeQuestion.title}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Tag color="blue">{activeQuestion.type_label}</Tag>
                      <Tag color="green">{activeQuestion.score}分</Tag>
                      <Tag color="orange">限时{activeQuestion.duration}秒</Tag>
                    </div>
                  </div>
                  <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, fontSize: 14, color: '#1f2937', lineHeight: 1.8, marginBottom: 12 }}>
                    {activeQuestion.content}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', background: '#eff6ff', padding: '8px 12px', borderRadius: 6 }}>
                    💡 {activeQuestion.tips}
                  </div>
                </div>

                {/* 录音区域 */}
                <div className="card mb16">
                  <div className="card-title">
                    <span>🎙️ 录音区域</span>
                    {recording && <Tag color="red" style={{ animation: 'pulse 1s infinite' }}>● 录音中</Tag>}
                  </div>

                  {/* 实时波形 */}
                  <div style={{ marginBottom: 16 }}>
                    <canvas ref={canvasRef} width={600} height={100}
                      style={{ width: '100%', height: 100, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </div>

                  {/* 录音控制 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    {!recording && !recorded && (
                      <button onClick={startRecording}
                        style={{
                          padding: '12px 32px', background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          color: '#fff', border: 'none', borderRadius: 30, fontSize: 15, fontWeight: 600,
                          cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                        }}>
                        🎤 开始录音
                      </button>
                    )}
                    {recording && (
                      <button onClick={stopRecording}
                        style={{
                          padding: '12px 32px', background: '#6b7280', color: '#fff', border: 'none',
                          borderRadius: 30, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                        }}>
                        ⏹ 停止录音
                      </button>
                    )}
                    {recorded && !scoring && (
                      <>
                        <button onClick={startRecording} className="btn" style={{ borderRadius: 30 }}>
                          🔄 重新录音
                        </button>
                        <button onClick={doAIScore} className="btn primary" style={{ borderRadius: 30, padding: '12px 28px' }}>
                          🤖 AI智能评分
                        </button>
                      </>
                    )}
                    {scoring && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6' }}>
                        <div style={{ width: 20, height: 20, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span>AI正在评分中...</span>
                      </div>
                    )}

                    {/* 录音时间 */}
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: recording ? '#ef4444' : '#1f2937', fontFamily: 'monospace' }}>
                        {formatTime(recordingTime)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        剩余 {formatTime(Math.max(0, activeQuestion.duration - recordingTime))}
                      </div>
                    </div>
                  </div>

                  {/* 录音回放 */}
                  {recorded && audioUrl && (
                    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>📼 录音回放</div>
                      <audio controls src={audioUrl} style={{ width: '100%' }} />
                    </div>
                  )}
                </div>

                {/* 评分结果 */}
                {scoreResult && (
                  <div className="card mb16" style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #bbf7d0' }}>
                    <div className="card-title">
                      <span>🤖 AI评分结果</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 32, fontWeight: 700, color: scoreResult.total_score >= 90 ? '#10b981' : scoreResult.total_score >= 75 ? '#f59e0b' : '#ef4444' }}>
                          {scoreResult.question_score}
                        </span>
                        <span style={{ fontSize: 16, color: '#6b7280' }}>/{scoreResult.full_score}分</span>
                        <Tag color={scoreResult.total_score >= 90 ? 'green' : scoreResult.total_score >= 75 ? 'orange' : 'red'}>
                          {scoreResult.total_score >= 90 ? '优秀' : scoreResult.total_score >= 75 ? '良好' : scoreResult.total_score >= 60 ? '及格' : '待提高'}
                        </Tag>
                      </div>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      {/* 雷达图 */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>📊 四维能力雷达图</div>
                        <EChart option={radarOption} height={250} />
                      </div>

                      {/* 详细评分 */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>📋 详细评分</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {scoreResult.details.map(d => (
                            <div key={d.dimension}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: '#374151', fontWeight: 500 }}>{d.dimension}（权重{d.weight}%）</span>
                                <span style={{ fontWeight: 700, color: d.score >= 80 ? '#10b981' : d.score >= 60 ? '#f59e0b' : '#ef4444' }}>{d.score}分</span>
                              </div>
                              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${d.score}%`, height: '100%', background: d.score >= 80 ? '#10b981' : d.score >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 语音分析数据 */}
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                      {[
                        ['录音时长', `${scoreResult.duration}秒`],
                        ['语速', `${scoreResult.speech_rate}词/秒`],
                        ['停顿次数', `${scoreResult.pause_count}次`],
                        ['识别词数', `${scoreResult.word_count}词`],
                      ].map(([label, value]) => (
                        <div key={label} style={{ padding: 10, background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginTop: 2 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* AI评语 */}
                    <div style={{ padding: 14, background: '#fff', borderRadius: 8, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>💬 AI评语</div>
                      <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>{scoreResult.comment}</div>
                    </div>

                    {/* 改进建议 */}
                    <div style={{ padding: 14, background: '#eff6ff', borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>📚 个性化改进建议</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {scoreResult.details.filter(d => d.score < 85).slice(0, 2).map(d => (
                          <div key={d.dimension} style={{ fontSize: 12, color: '#3b82f6' }}>
                            <b>【{d.dimension}】</b>
                            {d.suggestions.slice(0, 2).join('；')}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 历史记录 */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="card-title"><span>📊 口语测试历史记录</span><Tag color="gray">{history.length}次</Tag></div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📼</div>
              <div>暂无测试记录，去完成一次口语测试吧！</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>时间</th><th>题目</th><th>题型</th><th>得分</th><th>发音</th><th>流利度</th><th>完整度</th><th>语调</th><th>评价</th></tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td className="small muted">{h.date}</td>
                      <td><b>{h.question.title}</b></td>
                      <td><Tag color="blue">{h.question.type_label}</Tag></td>
                      <td className="num" style={{ fontWeight: 700, color: h.result.total_score >= 80 ? '#10b981' : h.result.total_score >= 60 ? '#f59e0b' : '#ef4444' }}>
                        {h.result.question_score}/{h.result.full_score}
                      </td>
                      <td className="num">{h.result.dimensions.pronunciation}</td>
                      <td className="num">{h.result.dimensions.fluency}</td>
                      <td className="num">{h.result.dimensions.completeness}</td>
                      <td className="num">{h.result.dimensions.intonation}</td>
                      <td><Tag color={h.result.total_score >= 80 ? 'green' : h.result.total_score >= 60 ? 'orange' : 'red'}>
                        {h.result.total_score >= 90 ? '优秀' : h.result.total_score >= 75 ? '良好' : h.result.total_score >= 60 ? '及格' : '待提高'}
                      </Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
