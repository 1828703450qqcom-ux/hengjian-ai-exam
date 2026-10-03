import { useState, useEffect, useRef, useMemo } from 'react'
import { PageHeader, Tag, Loading, toast, Modal } from '../components/ui'
import EChart from '../components/EChart'

// 模拟考试列表
const EXAMS = [
  { id: 1, title: '大学英语（二）期末考试', course: '大学英语', date: '2026-06-20', total_students: 45, objective_count: 50, subjective_count: 3 },
  { id: 2, title: '高等数学期末考试', course: '高等数学', date: '2026-06-22', total_students: 45, objective_count: 20, subjective_count: 6 },
  { id: 3, title: '计算机基础期末考试', course: '计算机基础', date: '2026-06-25', total_students: 45, objective_count: 40, subjective_count: 2 },
]

// 模拟学生答题卡数据
const generateStudentSheets = (examId, count) => {
  const sheets = []
  const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '王十二',
    '冯十三', '陈十四', '褚十五', '卫十六', '蒋十七', '沈十八', '韩十九', '杨二十', '朱二一', '秦二二',
    '尤二三', '许二四', '何二五', '吕二六', '施二七', '张二八', '孔二九', '曹三十', '严三一', '华三二',
    '金三三', '魏三四', '陶三五', '姜三六', '戚三七', '谢三八', '邹三九', '喻四十', '柏四一', '水四二',
    '窦四三', '章四四', '云四五']
  for (let i = 0; i < count; i++) {
    const objectiveCorrect = Math.floor(Math.random() * 35) + 15 // 15-50题正确
    const objectiveTotal = examId === 1 ? 50 : examId === 2 ? 20 : 40
    const objectiveScore = Math.round((objectiveCorrect / objectiveTotal) * (objectiveTotal * 1.5) * 10) / 10
    sheets.push({
      id: i + 1,
      student_no: `202401${String(i + 1).padStart(3, '0')}`,
      name: names[i % names.length],
      status: 'pending', // pending / scanning / recognized / reviewed
      objective_correct: objectiveCorrect,
      objective_total: objectiveTotal,
      objective_score: objectiveScore,
      subjective_scores: [],
      total_score: objectiveScore,
      scan_time: null,
      recognize_time: null,
      omr_confidence: 0,
      ambiguous_questions: [],
    })
  }
  return sheets
}

// 主观题列表
const SUBJECTIVE_QUESTIONS = [
  { id: 1, no: 51, type: '翻译', score: 15, content: '将下列句子翻译成英文：随着人工智能技术的快速发展...', reference_answer: 'With the rapid development of artificial intelligence technology...' },
  { id: 2, no: 52, type: '作文', score: 20, content: 'Directions: Write an essay on the topic "The Importance of Lifelong Learning"...', reference_answer: 'Lifelong learning is essential in today\'s rapidly changing world...' },
  { id: 3, no: 53, type: '简答', score: 15, content: '请简述中国特色社会主义进入新时代的历史意义。', reference_answer: '中国特色社会主义进入新时代，意味着...' },
]

export default function ScanGrading() {
  const [exams, setExams] = useState(EXAMS)
  const [activeExam, setActiveExam] = useState(1)
  const [sheets, setSheets] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [activeTab, setActiveTab] = useState('upload') // upload / objective / subjective / stats
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [subjectiveGrading, setSubjectiveGrading] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(SUBJECTIVE_QUESTIONS[0])
  const [teacherScore, setTeacherScore] = useState('')
  const [teacherComment, setTeacherComment] = useState('')
  const fileInputRef = useRef(null)

  const currentExam = exams.find(e => e.id === activeExam)

  // 切换考试时重置数据
  useEffect(() => {
    setSheets(generateStudentSheets(activeExam, currentExam?.total_students || 45))
    setScanProgress(0)
    setSelectedSheet(null)
  }, [activeExam])

  // 批量扫描识别
  const startBatchScan = () => {
    setScanning(true)
    setScanProgress(0)
    let current = 0
    const total = sheets.length
    const interval = setInterval(() => {
      if (current >= total) {
        clearInterval(interval)
        setScanning(false)
        toast.success(`批量扫描完成：共识别 ${total} 份答题卡`)
        return
      }
      // 更新当前答题卡状态
      setSheets(prev => prev.map((s, i) => {
        if (i === current) {
          const confidence = 0.85 + Math.random() * 0.14
          const ambiguous = Math.random() > 0.7 ? [Math.floor(Math.random() * 20) + 1] : []
          return {
            ...s,
            status: 'recognized',
            scan_time: new Date().toLocaleTimeString('zh-CN'),
            recognize_time: new Date().toLocaleTimeString('zh-CN'),
            omr_confidence: Math.round(confidence * 100) / 100,
            ambiguous_questions: ambiguous,
          }
        }
        return s
      }))
      current++
      setScanProgress(Math.round((current / total) * 100))
    }, 150)
  }

  // 上传答题卡
  const handleFileUpload = (e) => {
    const files = e.target.files
    if (files.length === 0) return
    toast.success(`已选择 ${files.length} 份答题卡，开始扫描识别...`)
    setTimeout(() => startBatchScan(), 500)
  }

  // 统计数据
  const stats = useMemo(() => {
    const recognized = sheets.filter(s => s.status === 'recognized').length
    const reviewed = sheets.filter(s => s.status === 'reviewed').length
    const avgObjective = recognized > 0
      ? sheets.filter(s => s.status === 'recognized').reduce((a, s) => a + s.objective_score, 0) / recognized
      : 0
    const lowConfidence = sheets.filter(s => s.omr_confidence > 0 && s.omr_confidence < 0.9).length
    return { recognized, reviewed, avgObjective, lowConfidence, total: sheets.length }
  }, [sheets])

  // 客观题正确率分布
  const objectiveDistOption = useMemo(() => {
    const recognized = sheets.filter(s => s.status === 'recognized')
    if (recognized.length === 0) return {}
    const bins = [0, 0, 0, 0, 0] // 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
    recognized.forEach(s => {
      const rate = s.objective_correct / s.objective_total
      const bin = Math.min(4, Math.floor(rate * 5))
      bins[bin]++
    })
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
      grid: { left: 50, right: 20, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'], axisLabel: { color: '#6b7280', fontSize: 11 } },
      yAxis: { type: 'value', name: '人数', axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [{
        type: 'bar', data: bins.map((v, i) => ({
          value: v,
          itemStyle: { color: ['#ef4444', '#f59e0b', '#eab308', '#3b82f6', '#10b981'][i], borderRadius: [6, 6, 0, 0] }
        })),
        label: { show: true, position: 'top', fontSize: 11, color: '#6b7280' },
        barWidth: '50%',
      }]
    }
  }, [sheets])

  // 选择学生进行主观题评阅
  const selectSheetForGrading = (sheet) => {
    setSelectedSheet(sheet)
    setCurrentQuestion(SUBJECTIVE_QUESTIONS[0])
    setTeacherScore('')
    setTeacherComment('')
  }

  // 提交主观题评分
  const submitSubjectiveScore = () => {
    if (!selectedSheet || !teacherScore) { toast.warning('请输入评分'); return }
    const score = Number(teacherScore)
    if (score < 0 || score > currentQuestion.score) { toast.warning(`评分应在0-${currentQuestion.score}之间`); return }

    // 更新学生主观题得分
    const newSubjectiveScores = [...(selectedSheet.subjective_scores || [])]
    const existingIdx = newSubjectiveScores.findIndex(s => s.question_id === currentQuestion.id)
    const scoreItem = {
      question_id: currentQuestion.id,
      question_no: currentQuestion.no,
      type: currentQuestion.type,
      score: score,
      full_score: currentQuestion.score,
      comment: teacherComment,
      grader: '教师',
      grade_time: new Date().toLocaleString('zh-CN'),
    }
    if (existingIdx >= 0) {
      newSubjectiveScores[existingIdx] = scoreItem
    } else {
      newSubjectiveScores.push(scoreItem)
    }

    const newTotal = selectedSheet.objective_score + newSubjectiveScores.reduce((a, s) => a + s.score, 0)
    const allGraded = newSubjectiveScores.length === SUBJECTIVE_QUESTIONS.length

    setSheets(prev => prev.map(s => s.id === selectedSheet.id
      ? { ...s, subjective_scores: newSubjectiveScores, total_score: newTotal, status: allGraded ? 'reviewed' : 'recognized' }
      : s))
    setSelectedSheet(prev => ({ ...prev, subjective_scores: newSubjectiveScores, total_score: newTotal, status: allGraded ? 'reviewed' : 'recognized' }))

    toast.success(`第${currentQuestion.no}题评分完成：${score}/${currentQuestion.score}分`)

    // 自动跳到下一题
    const nextIdx = SUBJECTIVE_QUESTIONS.findIndex(q => q.id === currentQuestion.id) + 1
    if (nextIdx < SUBJECTIVE_QUESTIONS.length) {
      setCurrentQuestion(SUBJECTIVE_QUESTIONS[nextIdx])
    } else {
      toast.success('所有主观题已评阅完成！')
    }
    setTeacherScore('')
    setTeacherComment('')
  }

  return (
    <div>
      <PageHeader
        title="📄 纸笔考试扫描阅卷"
        subtitle="答题卡扫描上传 · OMR光学标记识别 · 客观题自动批改 · 主观题切割在线评阅"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" value={activeExam} onChange={e => setActiveExam(Number(e.target.value))} style={{ width: 250 }}>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
        }
      />

      {/* 统计卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>📋 答题卡总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{stats.total}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 已识别</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{stats.recognized}<span style={{ fontSize: 14, color: '#6b7280' }}>/{stats.total}</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>📝 已评阅</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>{stats.reviewed}<span style={{ fontSize: 14, color: '#6b7280' }}>/{stats.total}</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>⚠️ 低置信度</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{stats.lowConfidence}<span style={{ fontSize: 14, color: '#6b7280' }}>份需复核</span></div>
        </div>
      </div>

      {/* Tab切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
        {[['upload', '📤 扫描上传'], ['objective', '✅ 客观题结果'], ['subjective', '📝 主观题评阅'], ['stats', '📊 阅卷统计']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? '#3b82f6' : '#6b7280',
              borderBottom: activeTab === key ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* 扫描上传Tab */}
      {activeTab === 'upload' && (
        <div className="card">
          <div className="card-title"><span>📤 答题卡扫描上传</span><Tag color="blue">支持批量上传</Tag></div>

          {/* 上传区域 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFileUpload(e) }}
            style={{
              padding: 40, border: '2px dashed #cbd5e1', borderRadius: 12, textAlign: 'center',
              cursor: 'pointer', background: '#f8fafc', marginBottom: 20,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>点击或拖拽上传答题卡图片</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>支持 JPG/PNG/PDF 格式，可批量上传，系统将自动进行OMR识别</div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>

          {/* 扫描进度 */}
          {scanning && (
            <div style={{ marginBottom: 20, padding: 16, background: '#eff6ff', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1e40af' }}>🔍 正在扫描识别...</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>{scanProgress}%</span>
              </div>
              <div style={{ height: 10, background: '#dbeafe', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${scanProgress}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: 5, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                已识别 {Math.round(stats.total * scanProgress / 100)} / {stats.total} 份答题卡
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button className="btn primary" onClick={startBatchScan} disabled={scanning}>
              {scanning ? '扫描中...' : '🚀 开始批量扫描识别'}
            </button>
            <button className="btn" onClick={() => { setSheets(generateStudentSheets(activeExam, stats.total)); setScanProgress(0); toast.success('已重置') }}>
              🔄 重置
            </button>
          </div>

          {/* 答题卡列表 */}
          <div className="table-wrap">
            <table>
              <thead><tr><th>学号</th><th>姓名</th><th>状态</th><th>客观题正确</th><th>客观题得分</th><th>OMR置信度</th><th>需复核题</th><th>扫描时间</th></tr></thead>
              <tbody>
                {sheets.slice(0, 20).map(s => (
                  <tr key={s.id}>
                    <td className="small muted">{s.student_no}</td>
                    <td><b>{s.name}</b></td>
                    <td>
                      <Tag color={s.status === 'recognized' ? 'green' : s.status === 'reviewed' ? 'blue' : 'gray'}>
                        {s.status === 'recognized' ? '已识别' : s.status === 'reviewed' ? '已评阅' : '待扫描'}
                      </Tag>
                    </td>
                    <td className="num">{s.status !== 'pending' ? `${s.objective_correct}/${s.objective_total}` : '-'}</td>
                    <td className="num" style={{ fontWeight: 600, color: s.status !== 'pending' ? '#3b82f6' : '#9ca3af' }}>{s.status !== 'pending' ? s.objective_score : '-'}</td>
                    <td className="num">
                      {s.omr_confidence > 0 ? (
                        <span style={{ color: s.omr_confidence >= 0.95 ? '#10b981' : s.omr_confidence >= 0.9 ? '#3b82f6' : '#f59e0b', fontWeight: 600 }}>
                          {(s.omr_confidence * 100).toFixed(1)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td>{s.ambiguous_questions.length > 0 ? <Tag color="orange">第{s.ambiguous_questions.join(',')}题</Tag> : '-'}</td>
                    <td className="small muted">{s.scan_time || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sheets.length > 20 && (
            <div style={{ textAlign: 'center', padding: 12, color: '#9ca3af', fontSize: 13 }}>
              仅显示前20条，共 {sheets.length} 条记录
            </div>
          )}
        </div>
      )}

      {/* 客观题结果Tab */}
      {activeTab === 'objective' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>📊 客观题正确率分布</span></div>
            <EChart option={objectiveDistOption} height={300} />
          </div>
          <div className="card">
            <div className="card-title"><span>📈 客观题得分统计</span></div>
            <div style={{ padding: 20 }}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#16a34a' }}>客观题平均分</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#166534', marginTop: 4 }}>{stats.avgObjective.toFixed(1)}</div>
                </div>
                <div style={{ padding: 16, background: '#eff6ff', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#3b82f6' }}>最高分</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>
                    {sheets.filter(s => s.status !== 'pending').length > 0 ? Math.max(...sheets.filter(s => s.status !== 'pending').map(s => s.objective_score)).toFixed(1) : '-'}
                  </div>
                </div>
                <div style={{ padding: 16, background: '#fef3c7', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#d97706' }}>最低分</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e', marginTop: 4 }}>
                    {sheets.filter(s => s.status !== 'pending').length > 0 ? Math.min(...sheets.filter(s => s.status !== 'pending').map(s => s.objective_score)).toFixed(1) : '-'}
                  </div>
                </div>
                <div style={{ padding: 16, background: '#ede9fe', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#7c3aed' }}>平均正确率</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6', marginTop: 4 }}>
                    {sheets.filter(s => s.status !== 'pending').length > 0
                      ? (sheets.filter(s => s.status !== 'pending').reduce((a, s) => a + s.objective_correct / s.objective_total, 0) / sheets.filter(s => s.status !== 'pending').length * 100).toFixed(1)
                      : '-'}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主观题评阅Tab */}
      {activeTab === 'subjective' && (
        <div className="grid" style={{ gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* 学生列表 */}
          <div className="card">
            <div className="card-title"><span>👥 学生列表</span><Tag color="gray">{sheets.filter(s => s.status !== 'pending').length}人</Tag></div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {sheets.filter(s => s.status !== 'pending').map(s => (
                <div key={s.id} onClick={() => selectSheetForGrading(s)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                    background: selectedSheet?.id === s.id ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${selectedSheet?.id === s.id ? '#3b82f6' : '#e5e7eb'}`,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.student_no}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>{s.total_score.toFixed(1)}</div>
                      <div style={{ fontSize: 10, color: s.status === 'reviewed' ? '#10b981' : '#f59e0b' }}>
                        {s.status === 'reviewed' ? '✓ 已评完' : `${(s.subjective_scores || []).length}/${SUBJECTIVE_QUESTIONS.length}题`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 评阅区域 */}
          <div>
            {!selectedSheet ? (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
                  <div>请从左侧选择学生开始主观题评阅</div>
                </div>
              </div>
            ) : (
              <>
                {/* 学生信息 */}
                <div className="card mb16">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>{selectedSheet.name}</span>
                      <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 12 }}>{selectedSheet.student_no}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>客观题</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{selectedSheet.objective_score}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>主观题</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{(selectedSheet.subjective_scores || []).reduce((a, s) => a + s.score, 0).toFixed(1)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>总分</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{selectedSheet.total_score.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 题目切换 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {SUBJECTIVE_QUESTIONS.map(q => {
                    const graded = (selectedSheet.subjective_scores || []).find(s => s.question_id === q.id)
                    return (
                      <button key={q.id} onClick={() => { setCurrentQuestion(q); setTeacherScore(graded?.score || ''); setTeacherComment(graded?.comment || '') }}
                        style={{
                          padding: '10px 16px', borderRadius: 8, cursor: 'pointer', border: 'none',
                          background: currentQuestion.id === q.id ? '#3b82f6' : graded ? '#dcfce7' : '#f1f5f9',
                          color: currentQuestion.id === q.id ? '#fff' : graded ? '#16a34a' : '#6b7280',
                          fontWeight: currentQuestion.id === q.id ? 600 : 400,
                        }}>
                        第{q.no}题（{q.type}）{graded && ' ✓'}
                      </button>
                    )
                  })}
                </div>

                {/* 题目内容 */}
                <div className="card mb16">
                  <div className="card-title">
                    <span>📝 第{currentQuestion.no}题（{currentQuestion.type}）</span>
                    <Tag color="purple">{currentQuestion.score}分</Tag>
                  </div>
                  <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, fontSize: 14, color: '#1f2937', lineHeight: 1.8, marginBottom: 12 }}>
                    {currentQuestion.content}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', background: '#eff6ff', padding: '8px 12px', borderRadius: 6 }}>
                    <b>参考答案：</b>{currentQuestion.reference_answer}
                  </div>
                </div>

                {/* 学生答案（模拟扫描切割） */}
                <div className="card mb16">
                  <div className="card-title">
                    <span>📋 学生答题（扫描切割）</span>
                    <Tag color="blue">图像已识别</Tag>
                  </div>
                  <div style={{ padding: 14, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', minHeight: 100, fontSize: 14, color: '#1f2937', lineHeight: 1.8 }}>
                    {currentQuestion.type === '翻译'
                      ? 'With the fast development of AI technology, more and more traditional industries are changing. It brings chances and also challenges.'
                      : currentQuestion.type === '作文'
                        ? 'Lifelong learning is very important. We should learn new things every day. It helps us get better jobs and live better lives. We can read books, take online courses, and learn from other people. In conclusion, we should keep learning all our lives.'
                        : '中国特色社会主义进入新时代意味着中华民族迎来了从站起来、富起来到强起来的伟大飞跃。科学社会主义在中国焕发生机。中国特色社会主义道路不断发展，为其他国家提供了新选择。'}
                  </div>
                </div>

                {/* 评分区域 */}
                <div className="card" style={{ background: 'linear-gradient(135deg, #faf5ff, #f5f3ff)', border: '1px solid #ddd6fe' }}>
                  <div className="card-title"><span>✍️ 教师评分</span></div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', display: 'block', marginBottom: 8 }}>
                      评分（0 - {currentQuestion.score}分）
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="number" min="0" max={currentQuestion.score} step="0.5" value={teacherScore}
                        onChange={e => setTeacherScore(e.target.value)}
                        className="input" style={{ width: 120, fontSize: 18, fontWeight: 700, textAlign: 'center' }}
                        placeholder="评分" />
                      <span style={{ fontSize: 16, color: '#6b7280' }}>/ {currentQuestion.score}分</span>
                      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${teacherScore ? (Number(teacherScore) / currentQuestion.score * 100) : 0}%`, height: '100%', background: teacherScore ? (Number(teacherScore) >= currentQuestion.score * 0.8 ? '#10b981' : Number(teacherScore) >= currentQuestion.score * 0.6 ? '#f59e0b' : '#ef4444') : '#e5e7eb', borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', display: 'block', marginBottom: 8 }}>评语（可选）</label>
                    <textarea value={teacherComment} onChange={e => setTeacherComment(e.target.value)}
                      rows={3} placeholder="输入评语，如：翻译基本准确，但部分词汇使用不够地道..."
                      className="input" style={{ width: '100%', resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn primary" onClick={submitSubjectiveScore} style={{ padding: '10px 28px' }}>
                      ✅ 提交评分
                    </button>
                    <button className="btn" onClick={() => { setTeacherScore(''); setTeacherComment('') }}>
                      清空
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 阅卷统计Tab */}
      {activeTab === 'stats' && (
        <div className="card">
          <div className="card-title"><span>📊 阅卷进度统计</span></div>
          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>总体阅卷进度</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>{stats.reviewed}/{stats.total}（{Math.round(stats.reviewed / stats.total * 100)}%）</span>
              </div>
              <div style={{ height: 16, background: '#e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ width: `${stats.reviewed / stats.total * 100}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: 8, transition: 'width 0.5s' }} />
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 4 }}>已完成评阅</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#166534' }}>{stats.reviewed}人</div>
              </div>
              <div style={{ padding: 16, background: '#fef3c7', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#d97706', marginBottom: 4 }}>评阅中</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#92400e' }}>{stats.recognized - stats.reviewed}人</div>
              </div>
              <div style={{ padding: 16, background: '#f1f5f9', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>待扫描</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#475569' }}>{stats.total - stats.recognized}人</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
