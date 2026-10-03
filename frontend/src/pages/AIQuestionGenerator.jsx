import { useState, useEffect } from 'react'
import { PageHeader, Tag, Loading, toast } from '../components/ui'

// 知识点库
const KNOWLEDGE_POINTS = [
  { subject: '英语', points: ['词汇辨析', '语法结构', '阅读理解', '完形填空', '翻译能力', '写作表达', '听力理解', '口语表达'] },
  { subject: '数学', points: ['函数与极限', '导数应用', '积分计算', '级数收敛', '线性代数', '概率统计', '空间几何', '数学建模'] },
  { subject: '计算机', points: ['数据结构', '算法设计', '操作系统', '计算机网络', '数据库', '编程语言', '人工智能', '信息安全'] },
  { subject: '思政', points: ['马克思主义原理', '毛泽东思想', '中国特色社会主义', '思想道德修养', '法律基础', '形势与政策'] },
]

// 题型配置
const QUESTION_TYPES = [
  { key: 'single_choice', label: '单选题', default_count: 10 },
  { key: 'multiple_choice', label: '多选题', default_count: 5 },
  { key: 'judge', label: '判断题', default_count: 5 },
  { key: 'fill', label: '填空题', default_count: 5 },
  { key: 'subjective', label: '简答题', default_count: 3 },
  { key: 'essay', label: '作文题', default_count: 1 },
]

// 模拟AI生成题目
const generateAIQuestions = (config) => {
  const questions = []
  let id = 1
  const difficulties = ['简单', '中等', '困难']
  const difficultyWeights = config.difficulty === 'easy' ? [0.6, 0.3, 0.1] : config.difficulty === 'hard' ? [0.1, 0.3, 0.6] : [0.3, 0.5, 0.2]

  for (const [typeKey, count] of Object.entries(config.type_counts)) {
    if (count <= 0) continue
    const typeLabel = QUESTION_TYPES.find(t => t.key === typeKey)?.label || typeKey
    for (let i = 0; i < count; i++) {
      const kp = config.knowledge_points[Math.floor(Math.random() * config.knowledge_points.length)]
      const diffRand = Math.random()
      let cumWeight = 0
      let difficulty = '中等'
      for (let j = 0; j < difficulties.length; j++) {
        cumWeight += difficultyWeights[j]
        if (diffRand <= cumWeight) { difficulty = difficulties[j]; break }
      }

      const question = {
        id: id++,
        type: typeKey,
        type_label: typeLabel,
        knowledge_point: kp,
        difficulty: difficulty,
        score: typeKey === 'essay' ? 25 : typeKey === 'subjective' ? 10 : typeKey === 'fill' ? 4 : 2,
        content: '',
        options: [],
        answer: '',
        analysis: '',
        ai_generated: true,
        generate_time: new Date().toLocaleString('zh-CN'),
        status: 'pending', // pending / approved / rejected
      }

      // 根据题型生成内容
      if (typeKey === 'single_choice' || typeKey === 'multiple_choice') {
        question.content = `【${kp}】${difficulty}难度${typeLabel}：下列关于${kp}的说法，${typeKey === 'single_choice' ? '正确的是' : '正确的有（多选）'}？`
        question.options = [
          `A. ${kp}的第一个选项描述，涉及相关知识点的具体内容`,
          `B. ${kp}的第二个选项描述，可能是正确答案`,
          `C. ${kp}的第三个选项描述，存在一定的迷惑性`,
          `D. ${kp}的第四个选项描述，需要仔细辨析`,
        ]
        question.answer = typeKey === 'single_choice' ? 'B' : 'AB'
        question.analysis = `本题考察${kp}知识点。${difficulty}难度。选项B是正确答案，因为...选项A错误在于...选项C错误在于...选项D错误在于...`
      } else if (typeKey === 'judge') {
        question.content = `【${kp}】${difficulty}难度判断题：关于${kp}的描述是否正确？请判断对错。`
        question.answer = Math.random() > 0.5 ? '正确' : '错误'
        question.analysis = `本题考察${kp}知识点。答案是${question.answer}，因为...`
      } else if (typeKey === 'fill') {
        question.content = `【${kp}】${difficulty}难度填空题：在${kp}中，______是最重要的概念，其核心特征是______。`
        question.answer = '第一个空：概念A；第二个空：特征B'
        question.analysis = `本题考察${kp}的基本概念。第一个空填"概念A"，第二个空填"特征B"。`
      } else if (typeKey === 'subjective') {
        question.content = `【${kp}】${difficulty}难度简答题：请简述${kp}的基本原理、主要特征和应用场景。（不少于100字）`
        question.answer = `${kp}的基本原理是...主要特征包括...应用场景有...`
        question.analysis = `本题考察${kp}的综合理解。评分要点：1.基本原理（4分）2.主要特征（3分）3.应用场景（3分）`
      } else if (typeKey === 'essay') {
        question.content = `【${kp}】${difficulty}难度作文题：以"${kp}与未来发展"为题，写一篇不少于150字的议论文，要求观点明确、论据充分、结构清晰。`
        question.answer = '参考范文：（略，约200字）'
        question.analysis = `本题考察${kp}相关的写作能力。评分要点：1.内容切题（10分）2.结构完整（5分）3.语言表达（5分）4.词汇语法（5分）`
      }

      questions.push(question)
    }
  }
  return questions
}

export default function AIQuestionGenerator() {
  const [config, setConfig] = useState({
    subject: '英语',
    knowledge_points: [],
    difficulty: 'medium',
    type_counts: { single_choice: 10, multiple_choice: 5, judge: 5, fill: 5, subjective: 3, essay: 1 },
  })
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState([])
  const [selectedQuestions, setSelectedQuestions] = useState(new Set())
  const [activeTab, setActiveTab] = useState('generate') // generate / history

  const currentPoints = KNOWLEDGE_POINTS.find(k => k.subject === config.subject)?.points || []

  const toggleKnowledgePoint = (point) => {
    const selected = config.knowledge_points.includes(point)
      ? config.knowledge_points.filter(p => p !== point)
      : [...config.knowledge_points, point]
    setConfig({ ...config, knowledge_points: selected })
  }

  const selectAllPoints = () => {
    if (config.knowledge_points.length === currentPoints.length) {
      setConfig({ ...config, knowledge_points: [] })
    } else {
      setConfig({ ...config, knowledge_points: [...currentPoints] })
    }
  }

  const startGenerate = () => {
    if (config.knowledge_points.length === 0) { toast.warning('请至少选择1个知识点'); return }
    const totalCount = Object.values(config.type_counts).reduce((a, b) => a + b, 0)
    if (totalCount === 0) { toast.warning('请至少设置1种题型的数量'); return }

    setGenerating(true)
    setQuestions([])
    setSelectedQuestions(new Set())

    // 模拟AI生成过程
    setTimeout(() => {
      const generated = generateAIQuestions(config)
      setQuestions(generated)
      setSelectedQuestions(new Set(generated.map(q => q.id)))
      setGenerating(false)
      toast.success(`AI生成完成：共 ${generated.length} 道题目`)
    }, 2000)
  }

  const toggleSelectQuestion = (id) => {
    const newSelected = new Set(selectedQuestions)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedQuestions(newSelected)
  }

  const selectAllQuestions = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set())
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.id)))
    }
  }

  const approveSelected = () => {
    if (selectedQuestions.size === 0) { toast.warning('请至少选择1道题'); return }
    setQuestions(questions.map(q => selectedQuestions.has(q.id) ? { ...q, status: 'approved' } : q))
    toast.success(`已审核通过 ${selectedQuestions.size} 道题目，已加入题库`)
  }

  const totalScore = questions.filter(q => selectedQuestions.has(q.id)).reduce((a, q) => a + q.score, 0)

  return (
    <div>
      <PageHeader
        title="🤖 AI智能出题系统"
        subtitle="大模型自动生成题目 · 难度控制 · 知识点绑定 · 答案解析自动生成"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['generate', '📝 智能出题'], ['history', '📚 生成历史']].map(([key, label]) => (
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

      {activeTab === 'generate' && (
        <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 16 }}>
          {/* 左侧：出题配置 */}
          <div className="card">
            <div className="card-title"><span>⚙️ 出题配置</span></div>

            {/* 学科选择 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', display: 'block', marginBottom: 8 }}>选择学科</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {KNOWLEDGE_POINTS.map(k => (
                  <button key={k.subject} onClick={() => setConfig({ ...config, subject: k.subject, knowledge_points: [] })}
                    style={{
                      padding: '6px 14px', borderRadius: 16, cursor: 'pointer', fontSize: 12, border: 'none',
                      background: config.subject === k.subject ? '#3b82f6' : '#f1f5f9',
                      color: config.subject === k.subject ? '#fff' : '#6b7280',
                    }}>
                    {k.subject}
                  </button>
                ))}
              </div>
            </div>

            {/* 知识点选择 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>选择知识点（多选）</label>
                <button onClick={selectAllPoints} style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {config.knowledge_points.length === currentPoints.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 150, overflowY: 'auto', padding: 8, background: '#f8fafc', borderRadius: 8 }}>
                {currentPoints.map(p => (
                  <button key={p} onClick={() => toggleKnowledgePoint(p)}
                    style={{
                      padding: '4px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 11,
                      background: config.knowledge_points.includes(p) ? '#8b5cf6' : '#fff',
                      color: config.knowledge_points.includes(p) ? '#fff' : '#6b7280',
                      border: config.knowledge_points.includes(p) ? 'none' : '1px solid #e5e7eb',
                    }}>
                    {p}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>已选 {config.knowledge_points.length} 个知识点</div>
            </div>

            {/* 难度选择 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', display: 'block', marginBottom: 8 }}>难度分布</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['easy', '简单', '#10b981'], ['medium', '中等', '#3b82f6'], ['hard', '困难', '#ef4444']].map(([key, label, color]) => (
                  <button key={key} onClick={() => setConfig({ ...config, difficulty: key })}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 12, border: 'none',
                      background: config.difficulty === key ? color : '#f1f5f9',
                      color: config.difficulty === key ? '#fff' : '#6b7280',
                      fontWeight: config.difficulty === key ? 600 : 400,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 题型数量 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', display: 'block', marginBottom: 8 }}>题型数量配置</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {QUESTION_TYPES.map(t => (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>{t.label}</span>
                    <input type="number" min="0" max="50" value={config.type_counts[t.key]}
                      onChange={e => setConfig({ ...config, type_counts: { ...config.type_counts, [t.key]: Math.max(0, Number(e.target.value)) } })}
                      className="input" style={{ width: 60, textAlign: 'center' }} />
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>道</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 8, padding: '6px 10px', background: '#eff6ff', borderRadius: 6 }}>
                合计：{Object.values(config.type_counts).reduce((a, b) => a + b, 0)} 道题
              </div>
            </div>

            {/* 生成按钮 */}
            <button className="btn primary" style={{ width: '100%', padding: '12px' }} onClick={startGenerate} disabled={generating}>
              {generating ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  AI正在生成题目...
                </span>
              ) : '🚀 开始AI智能出题'}
            </button>
          </div>

          {/* 右侧：生成结果 */}
          <div>
            {generating && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ fontSize: 48, marginBottom: 16, animation: 'bounce 1s infinite' }}>🤖</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>AI大模型正在生成题目...</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>正在分析知识点、生成题目内容、编写答案解析</div>
                <div style={{ width: 200, height: 6, background: '#e5e7eb', borderRadius: 3, marginTop: 20, overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: 3, animation: 'progress 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            )}

            {!generating && questions.length === 0 && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                <div style={{ fontSize: 16, color: '#6b7280' }}>配置左侧参数，点击"开始AI智能出题"生成题目</div>
              </div>
            )}

            {!generating && questions.length > 0 && (
              <>
                {/* 操作栏 */}
                <div className="card mb16" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedQuestions.size === questions.length} onChange={selectAllQuestions} />
                        全选
                      </label>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>
                        已选 <b style={{ color: '#3b82f6' }}>{selectedQuestions.size}</b> / {questions.length} 题
                      </span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>
                        总分 <b style={{ color: '#10b981' }}>{totalScore}</b> 分
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => { setQuestions([]); setSelectedQuestions(new Set()) }}>清空</button>
                      <button className="btn primary" onClick={approveSelected}>✅ 审核通过并入库</button>
                    </div>
                  </div>
                </div>

                {/* 题目列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {questions.map(q => (
                    <div key={q.id} className="card" style={{
                      borderLeft: `4px solid ${q.status === 'approved' ? '#10b981' : q.difficulty === '简单' ? '#10b981' : q.difficulty === '困难' ? '#ef4444' : '#3b82f6'}`,
                      opacity: selectedQuestions.has(q.id) ? 1 : 0.6,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <input type="checkbox" checked={selectedQuestions.has(q.id)} onChange={() => toggleSelectQuestion(q.id)} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>第{q.id}题</span>
                          <Tag color="blue">{q.type_label}</Tag>
                          <Tag color={q.difficulty === '简单' ? 'green' : q.difficulty === '困难' ? 'red' : 'orange'}>{q.difficulty}</Tag>
                          <Tag color="purple">{q.knowledge_point}</Tag>
                          <Tag color="gray">{q.score}分</Tag>
                          {q.status === 'approved' && <Tag color="green">✓ 已入库</Tag>}
                          <Tag color="blue" style={{ fontSize: 10 }}>🤖 AI生成</Tag>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.7, marginBottom: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 6 }}>
                        {q.content}
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                          {q.options.map((opt, i) => (
                            <div key={i} style={{ fontSize: 13, color: '#4b5563', padding: '4px 10px', background: '#fff', borderRadius: 4, border: '1px solid #e5e7eb' }}>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 2 }}>✅ 参考答案</div>
                          <div style={{ fontSize: 12, color: '#166534' }}>{q.answer}</div>
                        </div>
                        <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 2 }}>💡 答案解析</div>
                          <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>{q.analysis}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-title"><span>📚 AI出题历史记录</span><Tag color="gray">共 0 次生成</Tag></div>
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div>暂无生成历史，去"智能出题"生成第一批题目吧！</div>
          </div>
        </div>
      )}
    </div>
  )
}
