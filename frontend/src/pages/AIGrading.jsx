import { useState, useEffect, useMemo } from 'react'
import { PageHeader, Tag, Loading, toast, Modal } from '../components/ui'

// 演示数据
const DEMO_EXAMS = [
  { id: 1, title: '大学英语（二）期末考试', course: '大学英语', date: '2026-06-20', total_subjective: 3, pending: 45 },
  { id: 2, title: '思想政治理论期末考试', course: '思政', date: '2026-06-22', total_subjective: 4, pending: 45 },
  { id: 3, title: '高等数学期末考试', course: '高等数学', date: '2026-06-25', total_subjective: 3, pending: 45 },
]

const DEMO_QUESTIONS = [
  {
    id: 1, exam_id: 1, type: 'translation', type_label: '翻译题', score: 15,
    content: '将下列句子翻译成英文：随着人工智能技术的快速发展，越来越多的传统行业正在经历深刻的变革，这既带来了机遇，也带来了挑战。',
    reference_answer: 'With the rapid development of artificial intelligence technology, more and more traditional industries are undergoing profound transformations, which bring both opportunities and challenges.',
    keywords: ['artificial intelligence', 'rapid development', 'traditional industries', 'profound transformation', 'opportunities', 'challenges'],
    scoring_criteria: [
      { point: '人工智能翻译准确', weight: 20, keywords: ['artificial intelligence', 'AI'] },
      { point: '快速发展翻译准确', weight: 15, keywords: ['rapid development', 'fast development'] },
      { point: '传统行业翻译准确', weight: 20, keywords: ['traditional industries', 'traditional sectors'] },
      { point: '深刻变革翻译准确', weight: 20, keywords: ['profound transformation', 'profound change', 'deep reform'] },
      { point: '机遇和挑战翻译准确', weight: 15, keywords: ['opportunities', 'challenges'] },
      { point: '语法正确、语句通顺', weight: 10, keywords: [] },
    ],
  },
  {
    id: 2, exam_id: 1, type: 'essay', type_label: '作文题', score: 25,
    content: 'Directions: Write an essay on the topic "The Importance of Lifelong Learning" in about 150 words. Your essay should include: 1) the importance of lifelong learning; 2) ways to keep learning; 3) your conclusion.',
    reference_answer: 'Lifelong learning is essential in today\'s rapidly changing world. It helps individuals adapt to new challenges, advance their careers, and maintain mental agility. To keep learning, one can read books, take online courses, attend workshops, and learn from others. In conclusion, lifelong learning is the key to personal growth and success.',
    keywords: ['lifelong learning', 'important', 'essential', 'adapt', 'career', 'online courses', 'read books', 'conclusion'],
    scoring_criteria: [
      { point: '内容切题、论点明确', weight: 30, keywords: ['lifelong learning', 'important', 'essential'] },
      { point: '结构完整（开头/主体/结尾）', weight: 20, keywords: ['in conclusion', 'to sum up', 'firstly', 'secondly'] },
      { point: '词汇丰富、用词准确', weight: 20, keywords: ['essential', 'adapt', 'agility', 'advance'] },
      { point: '语法正确、句式多样', weight: 15, keywords: [] },
      { point: '字数达标（120-180词）', weight: 15, keywords: [] },
    ],
  },
  {
    id: 3, exam_id: 2, type: 'subjective', type_label: '简答题', score: 10,
    content: '请简述中国特色社会主义进入新时代的历史意义。',
    reference_answer: '中国特色社会主义进入新时代，意味着近代以来久经磨难的中华民族迎来了从站起来、富起来到强起来的伟大飞跃，迎来了实现中华民族伟大复兴的光明前景；意味着科学社会主义在二十一世纪的中国焕发出强大生机活力，在世界上高高举起了中国特色社会主义伟大旗帜；意味着中国特色社会主义道路、理论、制度、文化不断发展，拓展了发展中国家走向现代化的途径，给世界上那些既希望加快发展又希望保持自身独立性的国家和民族提供了全新选择，为解决人类问题贡献了中国智慧和中国方案。',
    keywords: ['站起来', '富起来', '强起来', '伟大飞跃', '中华民族伟大复兴', '科学社会主义', '生机活力', '中国特色社会主义', '现代化', '中国智慧', '中国方案'],
    scoring_criteria: [
      { point: '三个意味着表述完整', weight: 40, keywords: ['意味着', '三个意味着'] },
      { point: '中华民族伟大飞跃表述准确', weight: 20, keywords: ['站起来', '富起来', '强起来', '伟大飞跃'] },
      { point: '科学社会主义意义表述准确', weight: 20, keywords: ['科学社会主义', '生机活力', '伟大旗帜'] },
      { point: '中国智慧和中国方案表述准确', weight: 20, keywords: ['中国智慧', '中国方案', '现代化'] },
    ],
  },
]

const DEMO_STUDENTS = [
  { id: 1, name: '张三', student_no: '202401001', status: 'pending' },
  { id: 2, name: '李四', student_no: '202401002', status: 'pending' },
  { id: 3, name: '王五', student_no: '202401003', status: 'pending' },
  { id: 4, name: '赵六', student_no: '202401004', status: 'pending' },
  { id: 5, name: '钱七', student_no: '202401005', status: 'pending' },
]

// 模拟学生答案生成
const generateStudentAnswer = (question, studentId) => {
  const quality = (studentId % 5 + 3) / 8 // 0.375 - 1.0
  const base = question.reference_answer
  if (question.type === 'translation') {
    // 翻译题：根据质量保留部分关键词，可能有语法错误
    const words = base.split(' ')
    const keepCount = Math.floor(words.length * quality)
    const shuffled = [...words].sort(() => Math.random() - 0.5)
    const kept = shuffled.slice(0, keepCount).sort((a, b) => words.indexOf(a) - words.indexOf(b))
    let answer = kept.join(' ')
    if (quality < 0.6) answer += ' and more things.'
    if (quality < 0.4) answer = answer.replace(/\./g, ' ,')
    return answer
  } else if (question.type === 'essay') {
    // 作文题：根据质量生成不同长度和质量的作文
    const templates = [
      'Lifelong learning is very important. We should learn every day. Reading books is good. Online courses help us learn. In conclusion, we should keep learning.',
      'Lifelong learning is essential in today\'s world. It helps us adapt to changes and advance our careers. We can read books, take online courses, and attend workshops. Learning keeps our minds active. In conclusion, lifelong learning is the key to success.',
      'Lifelong learning is essential in today\'s rapidly changing world. It helps individuals adapt to new challenges, advance their careers, and maintain mental agility. To keep learning, one can read books, take online courses, attend workshops, and learn from others. The benefits of lifelong learning are numerous: it enhances employability, fosters personal growth, and enriches life. In conclusion, lifelong learning is the key to personal growth and success in the modern era.',
    ]
    const idx = Math.min(2, Math.floor(quality * 3))
    return templates[idx]
  } else {
    // 简答题：根据质量保留部分关键词
    const sentences = base.split('。')
    const keepCount = Math.max(1, Math.floor(sentences.length * quality))
    return sentences.slice(0, keepCount).join('。') + '。'
  }
}

// AI评分算法（基于关键词匹配和评分标准）
const aiGrade = (question, studentAnswer) => {
  const answer = studentAnswer.toLowerCase()
  let totalScore = 0
  const details = []

  for (const criterion of question.scoring_criteria) {
    let criterionScore = 0
    let matchedKeywords = []

    if (criterion.keywords.length === 0) {
      // 语法/字数等无关键词标准，根据整体质量给分
      const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length
      if (criterion.point.includes('字数')) {
        criterionScore = wordCount >= 120 && wordCount <= 180 ? criterion.weight : criterion.weight * 0.5
      } else {
        // 语法/语句通顺：根据句子完整性和标点
        const sentences = answer.split(/[.!?。！？]/).filter(s => s.trim().length > 5)
        criterionScore = sentences.length >= 2 ? criterion.weight : criterion.weight * 0.6
      }
    } else {
      // 关键词匹配
      for (const kw of criterion.keywords) {
        if (answer.includes(kw.toLowerCase())) {
          matchedKeywords.push(kw)
        }
      }
      const matchRate = matchedKeywords.length / criterion.keywords.length
      criterionScore = matchRate * criterion.weight
    }

    totalScore += criterionScore
    details.push({
      point: criterion.point,
      weight: criterion.weight,
      score: Math.round(criterionScore * 10) / 10,
      matched: matchedKeywords,
      match_rate: criterion.keywords.length > 0 ? Math.round((matchedKeywords.length / criterion.keywords.length) * 100) : null,
    })
  }

  // 转换为题目分数
  const finalScore = Math.round((totalScore / 100) * question.score * 10) / 10

  // 生成评语
  let comment = ''
  const percentage = totalScore / 100
  if (percentage >= 0.9) {
    comment = '优秀！答案完整准确，关键词覆盖全面，表达流畅。继续保持！'
  } else if (percentage >= 0.75) {
    comment = '良好！答案基本完整，大部分关键词已覆盖，表达较为流畅。建议加强薄弱环节。'
  } else if (percentage >= 0.6) {
    comment = '及格。答案部分完整，关键词覆盖不足，表达有待提升。建议对照参考答案加强练习。'
  } else {
    comment = '待提高。答案不完整，关键词覆盖较少，表达不够准确。建议认真学习相关知识点，加强练习。'
  }

  // 找出薄弱点
  const weakPoints = details.filter(d => d.score < d.weight * 0.6).map(d => d.point)

  return {
    score: finalScore,
    full_score: question.score,
    percentage: Math.round(totalScore * 10) / 10,
    details: details,
    comment: comment,
    weak_points: weakPoints,
    suggestions: weakPoints.length > 0 ? `建议重点加强：${weakPoints.join('、')}` : '各方面表现均衡，继续保持！',
  }
}

export default function AIGrading() {
  const [exams, setExams] = useState(DEMO_EXAMS)
  const [activeExam, setActiveExam] = useState(1)
  const [questions, setQuestions] = useState(DEMO_QUESTIONS.filter(q => q.exam_id === 1))
  const [activeQuestion, setActiveQuestion] = useState(null)
  const [students, setStudents] = useState(DEMO_STUDENTS)
  const [activeStudent, setActiveStudent] = useState(null)
  const [studentAnswer, setStudentAnswer] = useState('')
  const [grading, setGrading] = useState(false)
  const [gradeResult, setGradeResult] = useState(null)
  const [teacherScore, setTeacherScore] = useState('')
  const [teacherComment, setTeacherComment] = useState('')
  const [batchGrading, setBatchGrading] = useState(false)
  const [batchResults, setBatchResults] = useState(null)

  const currentExam = exams.find(e => e.id === activeExam)

  const selectQuestion = (q) => {
    setActiveQuestion(q)
    setActiveStudent(null)
    setStudentAnswer('')
    setGradeResult(null)
    setTeacherScore('')
    setTeacherComment('')
  }

  const selectStudent = (s) => {
    setActiveStudent(s)
    const answer = generateStudentAnswer(activeQuestion, s.id)
    setStudentAnswer(answer)
    setGradeResult(null)
    setTeacherScore('')
    setTeacherComment('')
  }

  const doAIGrade = () => {
    if (!activeQuestion || !studentAnswer) { toast.warning('请先选择题目和学生'); return }
    setGrading(true)
    setGradeResult(null)
    setTimeout(() => {
      const result = aiGrade(activeQuestion, studentAnswer)
      setGradeResult(result)
      setGrading(false)
      toast.success(`AI评阅完成：${result.score}/${result.full_score}分`)
    }, 1200)
  }

  const doBatchGrade = () => {
    if (!activeQuestion) { toast.warning('请先选择题目'); return }
    setBatchGrading(true)
    setBatchResults(null)
    setTimeout(() => {
      const results = students.map(s => {
        const answer = generateStudentAnswer(activeQuestion, s.id)
        const result = aiGrade(activeQuestion, answer)
        return { student: s, answer: answer, result: result }
      })
      setBatchResults(results)
      setBatchGrading(false)
      toast.success(`批量评阅完成：${results.length}份试卷`)
    }, 2000)
  }

  const confirmGrade = () => {
    if (!gradeResult) return
    const finalScore = teacherScore || gradeResult.score
    toast.success(`已确认评分：${activeStudent?.name} - ${finalScore}分`)
    // 更新学生状态
    setStudents(students.map(s => s.id === activeStudent?.id ? { ...s, status: 'graded' } : s))
  }

  return (
    <div>
      <PageHeader
        title="🤖 主观题AI评阅"
        subtitle="英语作文/翻译 · 思政主观题 · 简答题AI自动评分 · 生成评语和分析报告"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" value={activeExam} onChange={e => {
              setActiveExam(Number(e.target.value))
              setQuestions(DEMO_QUESTIONS.filter(q => q.exam_id === Number(e.target.value)))
              setActiveQuestion(null)
            }} style={{ width: 250 }}>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
        }
      />

      {/* 统计卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>📝 主观题数量</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{currentExam?.total_subjective}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>⏳ 待评阅</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{students.filter(s => s.status === 'pending').length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 已评阅</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{students.filter(s => s.status === 'graded').length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>🎯 AI评分一致性</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>≥90%</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* 左侧：题目列表 */}
        <div className="card">
          <div className="card-title"><span>📋 主观题列表</span><Tag color="gray">{questions.length}道</Tag></div>
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
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {q.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：评阅区域 */}
        <div>
          {!activeQuestion ? (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
              <Empty text="请从左侧选择一道主观题开始评阅" />
            </div>
          ) : (
            <>
              {/* 题目详情 */}
              <div className="card mb16">
                <div className="card-title">
                  <span>📝 题目详情</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Tag color="blue">{activeQuestion.type_label}</Tag>
                    <Tag color="green">{activeQuestion.score}分</Tag>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.8, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  {activeQuestion.content}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                  <b style={{ color: '#3b82f6' }}>参考答案：</b>{activeQuestion.reference_answer}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  <b>关键词：</b>{activeQuestion.keywords.join('、')}
                </div>
              </div>

              {/* 学生选择和答案 */}
              <div className="card mb16">
                <div className="card-title">
                  <span>👤 选择学生</span>
                  <button className="btn sm primary" onClick={doBatchGrade} disabled={batchGrading}>
                    {batchGrading ? '⏳ 批量评阅中...' : '🚀 批量AI评阅'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {students.map(s => (
                    <button key={s.id} onClick={() => selectStudent(s)}
                      style={{
                        padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
                        background: activeStudent?.id === s.id ? '#3b82f6' : s.status === 'graded' ? '#dcfce7' : '#f3f4f6',
                        color: activeStudent?.id === s.id ? '#fff' : s.status === 'graded' ? '#16a34a' : '#6b7280',
                        border: 'none',
                      }}>
                      {s.name} {s.status === 'graded' && '✓'}
                    </button>
                  ))}
                </div>

                {activeStudent && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>
                      学生答案（{activeStudent.name} - {activeStudent.student_no}）：
                    </div>
                    <div style={{ padding: 14, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 14, color: '#1f2937', lineHeight: 1.8, minHeight: 80 }}>
                      {studentAnswer}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button className="btn primary" onClick={doAIGrade} disabled={grading}>
                        {grading ? '⏳ AI评阅中...' : '🤖 开始AI评阅'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* AI评阅结果 */}
              {gradeResult && (
                <div className="card mb16" style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #bbf7d0' }}>
                  <div className="card-title">
                    <span>🤖 AI评阅结果</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: gradeResult.score >= gradeResult.full_score * 0.9 ? '#10b981' : gradeResult.score >= gradeResult.full_score * 0.6 ? '#f59e0b' : '#ef4444' }}>
                        {gradeResult.score}
                      </span>
                      <span style={{ fontSize: 16, color: '#6b7280' }}>/{gradeResult.full_score}分</span>
                      <Tag color={gradeResult.score >= gradeResult.full_score * 0.9 ? 'green' : gradeResult.score >= gradeResult.full_score * 0.6 ? 'orange' : 'red'}>
                        {gradeResult.score >= gradeResult.full_score * 0.9 ? '优秀' : gradeResult.score >= gradeResult.full_score * 0.6 ? '良好' : '待提高'}
                      </Tag>
                    </div>
                  </div>

                  {/* 评分细则 */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>📊 评分细则</div>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>评分点</th><th>权重</th><th>得分</th><th>关键词匹配</th></tr></thead>
                        <tbody>
                          {gradeResult.details.map((d, i) => (
                            <tr key={i}>
                              <td style={{ fontSize: 12 }}>{d.point}</td>
                              <td className="num" style={{ fontSize: 12 }}>{d.weight}%</td>
                              <td className="num" style={{ fontSize: 12, fontWeight: 600, color: d.score >= d.weight * 0.6 ? '#10b981' : '#ef4444' }}>{d.score}%</td>
                              <td style={{ fontSize: 11, color: '#6b7280' }}>
                                {d.match_rate !== null ? `${d.match_rate}%` : '综合评估'}
                                {d.matched.length > 0 && <div style={{ color: '#10b981' }}>✓ {d.matched.join(', ')}</div>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* AI评语 */}
                  <div style={{ padding: 12, background: '#fff', borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>💬 AI评语</div>
                    <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>{gradeResult.comment}</div>
                  </div>

                  {/* 学习建议 */}
                  <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>📚 学习建议</div>
                    <div style={{ fontSize: 13, color: '#3b82f6', lineHeight: 1.7 }}>{gradeResult.suggestions}</div>
                  </div>

                  {/* 教师复核 */}
                  <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>👨‍🏫 教师复核（可选）</div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>教师评分（不填则采用AI评分）</label>
                        <input type="number" min="0" max={activeQuestion.score} value={teacherScore}
                          onChange={e => setTeacherScore(e.target.value)}
                          placeholder={String(gradeResult.score)}
                          className="input" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>教师评语（可选）</label>
                      <textarea value={teacherComment} onChange={e => setTeacherComment(e.target.value)}
                        placeholder="输入教师评语..." rows={2}
                        className="input" style={{ width: '100%', resize: 'vertical' }} />
                    </div>
                    <button className="btn primary" onClick={confirmGrade}>✅ 确认评分并保存</button>
                  </div>
                </div>
              )}

              {/* 批量评阅结果 */}
              {batchResults && (
                <div className="card">
                  <div className="card-title">
                    <span>📊 批量评阅结果</span>
                    <Tag color="green">{batchResults.length}份</Tag>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>学生</th><th>学号</th><th>AI评分</th><th>等级</th><th>评语摘要</th><th>操作</th></tr></thead>
                      <tbody>
                        {batchResults.map((r, i) => (
                          <tr key={i}>
                            <td><b>{r.student.name}</b></td>
                            <td className="small muted">{r.student.student_no}</td>
                            <td className="num" style={{ fontWeight: 700, color: r.result.score >= r.result.full_score * 0.9 ? '#10b981' : r.result.score >= r.result.full_score * 0.6 ? '#f59e0b' : '#ef4444' }}>
                              {r.result.score}/{r.result.full_score}
                            </td>
                            <td><Tag color={r.result.score >= r.result.full_score * 0.9 ? 'green' : r.result.score >= r.result.full_score * 0.6 ? 'orange' : 'red'}>
                              {r.result.score >= r.result.full_score * 0.9 ? '优秀' : r.result.score >= r.result.full_score * 0.6 ? '良好' : '待提高'}
                            </Tag></td>
                            <td style={{ fontSize: 12, color: '#6b7280', maxWidth: 200 }}>{r.result.comment.substring(0, 40)}...</td>
                            <td><button className="btn sm" onClick={() => { selectStudent(r.student); setStudentAnswer(r.answer); setGradeResult(r.result) }}>查看详情</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, color: '#166534' }}>
                      📈 班级平均分：<b>{(batchResults.reduce((a, r) => a + r.result.score, 0) / batchResults.length).toFixed(1)}</b>分 ·
                      优秀率：<b>{Math.round(batchResults.filter(r => r.result.score >= r.result.full_score * 0.9).length / batchResults.length * 100)}</b>% ·
                      及格率：<b>{Math.round(batchResults.filter(r => r.result.score >= r.result.full_score * 0.6).length / batchResults.length * 100)}</b>%
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
