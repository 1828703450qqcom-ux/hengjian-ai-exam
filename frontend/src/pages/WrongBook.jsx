import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Tag, Empty, Loading, toast, confirmDialog } from '../components/ui'
import EChart from '../components/EChart'

// 艾宾浩斯遗忘曲线复习间隔（天）
const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15]
const EBBINGHAUS_LABELS = ['第1次', '第2次', '第3次', '第4次', '第5次']

// 同类题推荐库（基于知识点）
const SIMILAR_QUESTIONS = {
  '阅读理解·细节题': [
    { q: 'What does the author mainly discuss in paragraph 2?', type: '阅读理解', diff: '中等' },
    { q: 'According to the passage, which of the following is TRUE?', type: '阅读理解', diff: '简单' },
    { q: 'The word "ubiquitous" in line 15 is closest in meaning to?', type: '阅读理解·词汇题', diff: '困难' },
  ],
  '导数应用·最值问题': [
    { q: '求 f(x) = x² - 4x + 3 在 [0, 3] 上的最小值', type: '计算题', diff: '简单' },
    { q: '求 f(x) = sin(x) + cos(x) 在 [0, π] 上的最大值', type: '计算题', diff: '中等' },
    { q: '用导数证明：当 x > 0 时，e^x > 1 + x', type: '证明题', diff: '困难' },
  ],
  '计算机网络·TCP/IP协议栈': [
    { q: 'TCP协议属于OSI模型的哪一层？', type: '选择题', diff: '简单' },
    { q: '简述TCP三次握手的过程', type: '简答题', diff: '中等' },
    { q: 'HTTP和HTTPS的主要区别是什么？', type: '简答题', diff: '中等' },
  ],
  '词汇辨析·动词搭配': [
    { q: 'The company decided to _____ the project due to budget constraints.', type: '完形填空', diff: '中等' },
    { q: 'She _____ her success to hard work and determination.', type: '选择题', diff: '简单' },
    { q: 'The government has _____ new policies to address climate change.', type: '完形填空', diff: '困难' },
  ],
}

export default function WrongBook() {
  const [questions, setQuestions] = useState([])
  const [filter, setFilter] = useState('all') // all / mastered / unmastered / review
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const saved = localStorage.getItem('wrong_book')
    if (saved) {
      try {
        setQuestions(JSON.parse(saved))
      } catch (e) {
        setQuestions([])
      }
    } else {
      const demo = [
        {
          id: 1, exam: '大学英语（二）期末考试', subject: '英语', type: '阅读理解',
          question: 'According to the passage, what is the main reason for the decline in bee populations?',
          my_answer: 'B. Climate change', correct_answer: 'A. Pesticide use',
          analysis: '文章第三段明确指出："The primary cause of bee population decline is the widespread use of neonicotinoid pesticides in modern agriculture." 气候变化是次要因素。',
          wrong_count: 2, last_wrong: '2026-08-15', mastered: false,
          knowledge_point: '阅读理解·细节题', difficulty: '中等',
          review_schedule: { next_review: new Date().toISOString().slice(0, 10), review_stage: 0, reviewed: false },
        },
        {
          id: 2, exam: '高等数学期中考试', subject: '数学', type: '计算题',
          question: '求函数 f(x) = x³ - 3x² + 2x 在区间 [0, 2] 上的最大值。',
          my_answer: '最大值为 0（在 x=0 处）', correct_answer: '最大值为 4√3/9（在 x=(3-√3)/3 处）',
          analysis: 'f\'(x) = 3x² - 6x + 2 = 0，解得 x = (3±√3)/3。在 [0,2] 内临界点为 x₁≈0.423, x₂≈1.577。f(x₁)=4√3/9≈0.77, f(x₂)=-4√3/9, f(0)=0, f(2)=0。最大值为 4√3/9。',
          wrong_count: 1, last_wrong: '2026-08-20', mastered: false,
          knowledge_point: '导数应用·最值问题', difficulty: '困难',
          review_schedule: { next_review: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), review_stage: 0, reviewed: false },
        },
        {
          id: 3, exam: '计算机基础期末考试', subject: '计算机', type: '选择题',
          question: '在TCP/IP协议栈中，HTTP协议工作在哪一层？',
          my_answer: 'B. 传输层', correct_answer: 'C. 应用层',
          analysis: 'HTTP（超文本传输协议）是应用层协议，它基于传输层的TCP协议提供可靠的数据传输。应用层还包括FTP、SMTP、DNS等协议。',
          wrong_count: 1, last_wrong: '2026-08-10', mastered: true,
          knowledge_point: '计算机网络·TCP/IP协议栈', difficulty: '简单',
          review_schedule: { next_review: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), review_stage: 3, reviewed: true },
        },
        {
          id: 4, exam: '大学英语（二）期末考试', subject: '英语', type: '完形填空',
          question: 'The scientist\'s breakthrough discovery was _____ by the research community as a major advancement.',
          my_answer: 'B. received', correct_answer: 'A. hailed',
          analysis: '"hail as" 是固定搭配，意为"被称赞为/被拥戴为"。"receive" 后面通常不接 "as" 结构。"hailed by...as..." 是正式文体中常见的表达。',
          wrong_count: 3, last_wrong: '2026-08-25', mastered: false,
          knowledge_point: '词汇辨析·动词搭配', difficulty: '中等',
          review_schedule: { next_review: new Date().toISOString().slice(0, 10), review_stage: 1, reviewed: false },
        },
      ]
      setQuestions(demo)
      localStorage.setItem('wrong_book', JSON.stringify(demo))
    }
    setLoading(false)
  }, [])

  const subjects = useMemo(() => {
    const set = new Set(questions.map(q => q.subject))
    return ['all', ...Array.from(set)]
  }, [questions])

  // 今日待复习的题目
  const today = new Date().toISOString().slice(0, 10)
  const reviewToday = useMemo(() => {
    return questions.filter(q => {
      if (q.mastered) return false
      const next = q.review_schedule?.next_review
      return next && next <= today
    })
  }, [questions, today])

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (filter === 'mastered' && !q.mastered) return false
      if (filter === 'unmastered' && q.mastered) return false
      if (filter === 'review' && !reviewToday.find(r => r.id === q.id)) return false
      if (subjectFilter !== 'all' && q.subject !== subjectFilter) return false
      return true
    })
  }, [questions, filter, subjectFilter, reviewToday])

  const stats = useMemo(() => {
    const total = questions.length
    const mastered = questions.filter(q => q.mastered).length
    const unmastered = total - mastered
    const avgWrong = total ? (questions.reduce((a, q) => a + q.wrong_count, 0) / total).toFixed(1) : 0
    return { total, mastered, unmastered, avgWrong, reviewToday: reviewToday.length }
  }, [questions, reviewToday])

  const subjectDist = useMemo(() => {
    const dist = {}
    questions.forEach(q => { dist[q.subject] = (dist[q.subject] || 0) + 1 })
    return dist
  }, [questions])

  // 复习进度分布
  const reviewProgress = useMemo(() => {
    const stages = [0, 0, 0, 0, 0]
    questions.forEach(q => {
      const s = q.review_schedule?.review_stage || 0
      if (s >= 0 && s < 5) stages[s]++
    })
    return stages
  }, [questions])

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: Object.entries(subjectDist).map(([name, value]) => ({ name, value })),
      label: { fontSize: 11, color: '#6b7280' },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      color: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'],
    }]
  }), [subjectDist])

  const reviewBarOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: EBBINGHAUS_LABELS, axisLabel: { color: '#6b7280', fontSize: 10 } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      type: 'bar', data: reviewProgress,
      itemStyle: { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', fontSize: 11, color: '#6b7280' },
      barWidth: '50%',
    }]
  }), [reviewProgress])

  const saveQuestions = (updated) => {
    setQuestions(updated)
    localStorage.setItem('wrong_book', JSON.stringify(updated))
  }

  const toggleMaster = (id) => {
    const updated = questions.map(q => q.id === id ? { ...q, mastered: !q.mastered } : q)
    saveQuestions(updated)
    if (selected?.id === id) setSelected(updated.find(q => q.id === id))
    toast.success(updated.find(q => q.id === id).mastered ? '已标记为已掌握' : '已标记为未掌握')
  }

  // 标记已复习（按艾宾浩斯曲线更新下次复习时间）
  const markReviewed = (id) => {
    const updated = questions.map(q => {
      if (q.id !== id) return q
      const stage = Math.min((q.review_schedule?.review_stage || 0) + 1, EBBINGHAUS_INTERVALS.length - 1)
      const nextDays = EBBINGHAUS_INTERVALS[stage]
      return {
        ...q,
        review_schedule: {
          next_review: new Date(Date.now() + nextDays * 86400000).toISOString().slice(0, 10),
          review_stage: stage,
          reviewed: true,
        }
      }
    })
    saveQuestions(updated)
    if (selected?.id === id) setSelected(updated.find(q => q.id === id))
    const q = updated.find(q => q.id === id)
    toast.success(`已完成复习！下次复习时间：${q.review_schedule.next_review}（${EBBINGHAUS_INTERVALS[q.review_schedule.review_stage]}天后）`)
  }

  const removeQuestion = async (id) => {
    const ok = await confirmDialog({ title: '移出错题本', message: '确定要将这道题移出错题本吗？', confirmText: '移除' })
    if (!ok) return
    const updated = questions.filter(q => q.id !== id)
    saveQuestions(updated)
    setSelected(null)
    toast.success('已移出错题本')
  }

  const clearMastered = async () => {
    const ok = await confirmDialog({ title: '清除已掌握', message: `确定要清除 ${stats.mastered} 道已掌握的题目吗？`, confirmText: '清除' })
    if (!ok) return
    const updated = questions.filter(q => !q.mastered)
    saveQuestions(updated)
    toast.success('已清除已掌握题目')
  }

  // 导出为CSV
  const exportCSV = () => {
    const data = filtered.length ? filtered : questions
    if (data.length === 0) { toast.warning('没有可导出的错题'); return }
    const headers = ['序号', '科目', '题型', '难度', '题目', '我的答案', '正确答案', '解析', '知识点', '错误次数', '最近错误', '是否掌握']
    const rows = data.map((q, i) => [
      i + 1, q.subject, q.type, q.difficulty,
      `"${(q.question || '').replace(/"/g, '""')}"`,
      `"${(q.my_answer || '').replace(/"/g, '""')}"`,
      `"${(q.correct_answer || '').replace(/"/g, '""')}"`,
      `"${(q.analysis || '').replace(/"/g, '""')}"`,
      q.knowledge_point, q.wrong_count, q.last_wrong,
      q.mastered ? '已掌握' : '未掌握'
    ])
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `错题本_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已导出 ${data.length} 道错题（CSV格式）`)
  }

  // 导出为打印友好的HTML（可另存为PDF）
  const exportPrint = () => {
    const data = filtered.length ? filtered : questions
    if (data.length === 0) { toast.warning('没有可导出的错题'); return }
    const printWindow = window.open('', '_blank')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>错题本打印</title>
    <style>
      body { font-family: 'Microsoft YaHei', sans-serif; padding: 30px; color: #333; }
      h1 { text-align: center; color: #1e40af; margin-bottom: 5px; }
      .subtitle { text-align: center; color: #666; margin-bottom: 25px; font-size: 14px; }
      .question { margin-bottom: 25px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid; }
      .q-header { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: #666; }
      .q-title { font-size: 15px; font-weight: 600; margin-bottom: 10px; line-height: 1.6; }
      .q-answer { margin-bottom: 8px; font-size: 14px; line-height: 1.6; }
      .q-wrong { color: #dc2626; }
      .q-correct { color: #16a34a; }
      .q-analysis { background: #f0f9ff; padding: 10px; border-radius: 6px; font-size: 13px; line-height: 1.6; margin-top: 8px; }
      .q-meta { font-size: 12px; color: #999; margin-top: 8px; }
      .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 5px; }
      .tag-type { background: #eff6ff; color: #1e40af; }
      .tag-diff { background: #fef3c7; color: #92400e; }
      .tag-mastered { background: #dcfce7; color: #166534; }
      @media print { body { padding: 15px; } .question { border: none; border-bottom: 1px solid #ddd; } }
    </style></head><body>
    <h1>📚 智能错题本</h1>
    <div class="subtitle">导出时间：${new Date().toLocaleString('zh-CN')} · 共 ${data.length} 道错题</div>
    ${data.map((q, i) => `
      <div class="question">
        <div class="q-header">
          <span><b>第 ${i + 1} 题</b> <span class="tag tag-type">${q.type}</span> <span class="tag tag-diff">${q.difficulty}</span> ${q.mastered ? '<span class="tag tag-mastered">已掌握</span>' : ''}</span>
          <span>${q.subject} · 错${q.wrong_count}次</span>
        </div>
        <div class="q-title">${q.question}</div>
        <div class="q-answer q-wrong">❌ 我的答案：${q.my_answer}</div>
        <div class="q-answer q-correct">✅ 正确答案：${q.correct_answer}</div>
        <div class="q-analysis">💡 解析：${q.analysis}</div>
        <div class="q-meta">📖 知识点：${q.knowledge_point} · 来源：${q.exam} · 最近错误：${q.last_wrong}</div>
      </div>
    `).join('')}
    </body></html>`
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
    toast.success(`已生成打印文档（${data.length}道），可在打印对话框中选择"另存为PDF"`)
  }

  // 获取同类题推荐
  const getSimilarQuestions = (kp) => {
    return SIMILAR_QUESTIONS[kp] || [
      { q: `基于「${kp}」的同类练习题（接入题库后自动推荐）`, type: '推荐', diff: '中等' },
      { q: `「${kp}」知识点强化训练题`, type: '推荐', diff: '困难' },
    ]
  }

  if (loading) return <Loading text="加载错题本..." />

  const typeColor = { '选择题': 'blue', '填空题': 'green', '计算题': 'orange', '简答题': 'purple', '阅读理解': 'indigo', '完形填空': 'pink', '证明题': 'cyan' }
  const diffColor = { '简单': 'green', '中等': 'orange', '困难': 'red' }

  return (
    <div>
      <PageHeader
        title="📚 智能错题本"
        subtitle="自动收集错题 · 艾宾浩斯间隔复习 · 同类题推荐 · 查漏补缺"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={exportCSV}>📥 导出CSV</button>
            <button className="btn" onClick={exportPrint}>🖨️ 打印/PDF</button>
            <button className="btn" onClick={() => navigate('/portrait')}>🧭 能力画像</button>
            {stats.mastered > 0 && <button className="btn" onClick={clearMastered}>清除已掌握</button>}
          </div>
        }
      />

      {/* 复习提醒横幅 */}
      {stats.reviewToday > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '14px 20px',
          marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          border: '1px solid #fcd34d', boxShadow: '0 2px 8px rgba(245,158,11,0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>⏰</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#92400e' }}>今日有 {stats.reviewToday} 道题需要复习</div>
              <div style={{ fontSize: 12, color: '#b45309' }}>基于艾宾浩斯遗忘曲线，及时复习可提升记忆保留率达 90%+</div>
            </div>
          </div>
          <button className="btn primary" onClick={() => setFilter('review')}>
            开始复习 ({stats.reviewToday})
          </button>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 14, padding: '18px 20px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#92400e', marginBottom: 6 }}>📝 错题总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#78350f' }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: '#92400e', marginTop: 4 }}>累计收集</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 14, padding: '18px 20px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#166534', marginBottom: 6 }}>✅ 已掌握</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#14532d' }}>{stats.mastered}</div>
          <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>{stats.total ? Math.round(stats.mastered / stats.total * 100) : 0}% 掌握率</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fee2e2, #fecaca)', borderRadius: 14, padding: '18px 20px', border: '1px solid #fca5a5' }}>
          <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 6 }}>❌ 待攻克</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#7f1d1d' }}>{stats.unmastered}</div>
          <div style={{ fontSize: 12, color: '#991b1b', marginTop: 4 }}>需要重点复习</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 14, padding: '18px 20px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#5b21b6', marginBottom: 6 }}>⏰ 今日待复习</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#4c1d95' }}>{stats.reviewToday}</div>
          <div style={{ fontSize: 12, color: '#5b21b6', marginTop: 4 }}>艾宾浩斯提醒</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* 错题列表 */}
        <div className="card">
          <div className="card-title">
            <span>错题列表</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="select sm" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} style={{ width: 100 }}>
                {subjects.map(s => <option key={s} value={s}>{s === 'all' ? '全部科目' : s}</option>)}
              </select>
              <select className="select sm" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 110 }}>
                <option value="all">全部</option>
                <option value="review">待复习</option>
                <option value="unmastered">未掌握</option>
                <option value="mastered">已掌握</option>
              </select>
              <Tag color="gray">{filtered.length} 题</Tag>
            </div>
          </div>
          {filtered.length === 0 ? (
            <Empty icon="📚" title={filter === 'review' ? '今日没有待复习的题目' : '暂无错题'} desc={filter === 'review' ? '太棒了！所有复习任务已完成' : '完成考试后自动收集错题到这里'} />
          ) : (
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {filtered.map(q => {
                const needReview = q.review_schedule?.next_review && q.review_schedule.next_review <= today && !q.mastered
                return (
                  <div key={q.id}
                    onClick={() => setSelected(q)}
                    style={{
                      padding: '14px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                      background: selected?.id === q.id ? '#f0f9ff' : 'transparent',
                      borderLeft: selected?.id === q.id ? '3px solid #3b82f6' : needReview ? '3px solid #f59e0b' : '3px solid transparent',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { if (selected?.id !== q.id) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { if (selected?.id !== q.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Tag color={typeColor[q.type] || 'gray'}>{q.type}</Tag>
                        <Tag color={diffColor[q.difficulty] || 'gray'}>{q.difficulty}</Tag>
                        {q.mastered && <Tag color="green">已掌握</Tag>}
                        {needReview && <Tag color="orange">⏰ 待复习</Tag>}
                      </div>
                      <span className="small muted" style={{ flexShrink: 0 }}>错 {q.wrong_count} 次</span>
                    </div>
                    <div style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.6, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {q.question}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="small muted">📖 {q.knowledge_point} · {q.exam}</span>
                      <span className="small muted">
                        {q.review_schedule?.next_review && !q.mastered && `下次复习: ${q.review_schedule.next_review}`}
                        {q.last_wrong}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 右侧：复习进度 + 科目分布 + 详情 */}
        <div>
          {/* 艾宾浩斯复习进度 */}
          <div className="card mb16">
            <div className="card-title">
              <span>📈 艾宾浩斯复习进度</span>
              <Tag color="purple">5阶段</Tag>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, lineHeight: 1.6 }}>
              复习间隔：1天→2天→4天→7天→15天，科学对抗遗忘曲线
            </div>
            <EChart option={reviewBarOption} height={200} />
          </div>

          <div className="card mb16">
            <div className="card-title"><span>📊 科目分布</span></div>
            <EChart option={pieOption} height={240} />
          </div>

          {selected && (
            <div className="card">
              <div className="card-title">
                <span>📝 错题详情</span>
                <button className="btn sm" onClick={() => setSelected(null)}>关闭</button>
              </div>
              <div style={{ padding: '4px 0' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Tag color={typeColor[selected.type] || 'gray'}>{selected.type}</Tag>
                  <Tag color={diffColor[selected.difficulty] || 'gray'}>{selected.difficulty}</Tag>
                  <Tag color="purple">{selected.subject}</Tag>
                  {selected.mastered ? <Tag color="green">已掌握</Tag> : <Tag color="red">未掌握</Tag>}
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>题目</div>
                <div style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.7, marginBottom: 14, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  {selected.question}
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>我的答案</div>
                <div style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.6, marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, borderLeft: '3px solid #ef4444' }}>
                  ❌ {selected.my_answer}
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>正确答案</div>
                <div style={{ fontSize: 13, color: '#16a34a', lineHeight: 1.6, marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, borderLeft: '3px solid #22c55e' }}>
                  ✅ {selected.correct_answer}
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>解析</div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 14, padding: 12, background: '#eff6ff', borderRadius: 8, borderLeft: '3px solid #3b82f6' }}>
                  💡 {selected.analysis}
                </div>

                {/* 复习计划 */}
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>📅 复习计划（艾宾浩斯）</div>
                <div style={{ marginBottom: 14, padding: 12, background: '#faf5ff', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: '#6b7280' }}>当前阶段</span>
                    <span style={{ color: '#7c3aed', fontWeight: 600 }}>
                      {EBBINGHAUS_LABELS[selected.review_schedule?.review_stage || 0]} / 共{EBBINGHAUS_INTERVALS.length}阶段
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: '#6b7280' }}>下次复习</span>
                    <span style={{ color: selected.review_schedule?.next_review <= today ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {selected.review_schedule?.next_review || '未设置'}
                      {selected.review_schedule?.next_review <= today && !selected.mastered && '（已到期）'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {EBBINGHAUS_INTERVALS.map((days, i) => (
                      <div key={i} style={{
                        flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 4, fontSize: 10,
                        background: i <= (selected.review_schedule?.review_stage || 0) ? '#8b5cf6' : '#f3f4f6',
                        color: i <= (selected.review_schedule?.review_stage || 0) ? '#fff' : '#9ca3af',
                      }}>
                        {days}天
                      </div>
                    ))}
                  </div>
                </div>

                {/* 同类题推荐 */}
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>🎯 同类题推荐（基于知识点）</div>
                <div style={{ marginBottom: 14, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 11, color: '#166534', marginBottom: 8 }}>
                    知识点：{selected.knowledge_point}
                  </div>
                  {getSimilarQuestions(selected.knowledge_point).map((sq, i) => (
                    <div key={i} style={{ padding: '8px 10px', marginBottom: 6, background: '#fff', borderRadius: 6, border: '1px solid #dcfce7', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Tag color={typeColor[sq.type] || 'gray'} style={{ fontSize: 10 }}>{sq.type}</Tag>
                        <Tag color={diffColor[sq.diff] || 'gray'} style={{ fontSize: 10 }}>{sq.diff}</Tag>
                      </div>
                      {sq.q}
                    </div>
                  ))}
                  <button className="btn sm" style={{ width: '100%', marginTop: 4, background: '#10b981', color: '#fff', border: 'none' }}>
                    🔍 查看更多同类题
                  </button>
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  📖 知识点：{selected.knowledge_point}<br />
                  📝 来源：{selected.exam}<br />
                  🔄 错误次数：{selected.wrong_count} 次 · 最近错误：{selected.last_wrong}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!selected.mastered && (
                    <button className="btn primary sm" style={{ flex: 1 }} onClick={() => markReviewed(selected.id)}>
                      ✅ 完成复习
                    </button>
                  )}
                  <button className="btn sm" style={{ flex: 1 }} onClick={() => toggleMaster(selected.id)}>
                    {selected.mastered ? '↩️ 标记未掌握' : '⭐ 标记已掌握'}
                  </button>
                  <button className="btn sm" onClick={() => removeQuestion(selected.id)}>移除</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
