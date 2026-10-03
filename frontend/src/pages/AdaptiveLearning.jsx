import { useState, useEffect, useMemo } from 'react'
import { PageHeader, Tag, toast } from '../components/ui'
import EChart from '../components/EChart'

const KNOWLEDGE_MAP = [
  { id: 1, name: '词汇辨析', subject: '英语', mastery: 45, difficulty: 0.6, questions_done: 20, correct_rate: 0.45 },
  { id: 2, name: '语法结构', subject: '英语', mastery: 58, difficulty: 0.5, questions_done: 25, correct_rate: 0.58 },
  { id: 3, name: '阅读理解', subject: '英语', mastery: 52, difficulty: 0.7, questions_done: 30, correct_rate: 0.52 },
  { id: 4, name: '完形填空', subject: '英语', mastery: 48, difficulty: 0.65, questions_done: 18, correct_rate: 0.48 },
  { id: 5, name: '翻译能力', subject: '英语', mastery: 62, difficulty: 0.55, questions_done: 15, correct_rate: 0.62 },
  { id: 6, name: '写作表达', subject: '英语', mastery: 68, difficulty: 0.6, questions_done: 12, correct_rate: 0.68 },
  { id: 7, name: '函数与极限', subject: '数学', mastery: 72, difficulty: 0.5, questions_done: 35, correct_rate: 0.72 },
  { id: 8, name: '导数应用', subject: '数学', mastery: 65, difficulty: 0.6, questions_done: 28, correct_rate: 0.65 },
  { id: 9, name: '积分计算', subject: '数学', mastery: 55, difficulty: 0.7, questions_done: 22, correct_rate: 0.55 },
  { id: 10, name: '数据结构', subject: '计算机', mastery: 78, difficulty: 0.55, questions_done: 40, correct_rate: 0.78 },
  { id: 11, name: '算法设计', subject: '计算机', mastery: 60, difficulty: 0.75, questions_done: 25, correct_rate: 0.60 },
  { id: 12, name: '操作系统', subject: '计算机', mastery: 70, difficulty: 0.6, questions_done: 30, correct_rate: 0.70 },
]

const PRACTICE_QUESTIONS = [
  { id: 1, kp_id: 1, content: 'The scientist was _____ by the unexpected results.', options: ['A. surprised', 'B. shocked', 'C. amazed', 'D. astonished'], answer: 'A', difficulty: 0.5 },
  { id: 2, kp_id: 1, content: 'The company decided to _____ the product launch.', options: ['A. delay', 'B. postpone', 'C. defer', 'D. put off'], answer: 'B', difficulty: 0.6 },
  { id: 3, kp_id: 3, content: 'What can be inferred from the passage?', options: ['A. ...', 'B. ...', 'C. ...', 'D. ...'], answer: 'B', difficulty: 0.7 },
  { id: 4, kp_id: 7, content: '求极限 lim(x→0) sin(x)/x = ?', options: ['A. 0', 'B. 1', 'C. ∞', 'D. 不存在'], answer: 'B', difficulty: 0.4 },
  { id: 5, kp_id: 8, content: '函数 f(x)=x³-3x 的极大值是？', options: ['A. 2', 'B. -2', 'C. 0', 'D. 4'], answer: 'A', difficulty: 0.6 },
  { id: 6, kp_id: 10, content: '栈的特点是？', options: ['A. 先进先出', 'B. 后进先出', 'C. 随机存取', 'D. 顺序存取'], answer: 'B', difficulty: 0.3 },
]

export default function AdaptiveLearning() {
  const [knowledgeMap, setKnowledgeMap] = useState(KNOWLEDGE_MAP)
  const [activeKP, setActiveKP] = useState(null)
  const [practiceMode, setPracticeMode] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [userAnswer, setUserAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, current_difficulty: 0.5 })
  const [activeTab, setActiveTab] = useState('dashboard')

  // IRT能力估计（简化版）
  const estimatedAbility = useMemo(() => {
    const weightedMastery = knowledgeMap.reduce((sum, kp) => sum + kp.mastery * kp.difficulty, 0)
    const totalDifficulty = knowledgeMap.reduce((sum, kp) => sum + kp.difficulty, 0)
    return Math.round(weightedMastery / totalDifficulty * 10) / 10
  }, [knowledgeMap])

  // 推荐学习路径（基于BKT）
  const recommendedPath = useMemo(() => {
    return [...knowledgeMap]
      .filter(kp => kp.mastery < 70)
      .sort((a, b) => {
        // 优先级 = (1 - mastery) * difficulty * (提分潜力)
        const aPriority = (1 - a.mastery / 100) * a.difficulty * (1 + a.questions_done / 50)
        const bPriority = (1 - b.mastery / 100) * b.difficulty * (1 + b.questions_done / 50)
        return bPriority - aPriority
      })
      .slice(0, 5)
  }, [knowledgeMap])

  // 开始自适应练习
  const startPractice = (kp) => {
    setActiveKP(kp)
    setPracticeMode(true)
    setCurrentQ(0)
    setUserAnswer(null)
    setShowResult(false)
    setSessionStats({ correct: 0, total: 0, current_difficulty: kp.mastery / 100 })
  }

  // 提交答案
  const submitAnswer = (answer) => {
    setUserAnswer(answer)
    setShowResult(true)
    const isCorrect = answer === PRACTICE_QUESTIONS[currentQ]?.answer
    const newStats = {
      ...sessionStats,
      correct: sessionStats.correct + (isCorrect ? 1 : 0),
      total: sessionStats.total + 1,
      // 自适应调整难度：答对升难度，答错降难度
      current_difficulty: Math.max(0.2, Math.min(0.95, sessionStats.current_difficulty + (isCorrect ? 0.08 : -0.1))),
    }
    setSessionStats(newStats)

    // 更新知识点掌握度（BKT简化更新）
    if (activeKP) {
      setKnowledgeMap(prev => prev.map(kp => {
        if (kp.id === activeKP.id) {
          const newMastery = Math.max(0, Math.min(100, kp.mastery + (isCorrect ? 3 : -2)))
          return { ...kp, mastery: newMastery, questions_done: kp.questions_done + 1, correct_rate: (kp.correct_rate * kp.questions_done + (isCorrect ? 1 : 0)) / (kp.questions_done + 1) }
        }
        return kp
      }))
    }
  }

  // 下一题
  const nextQuestion = () => {
    if (currentQ < PRACTICE_QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1)
      setUserAnswer(null)
      setShowResult(false)
    } else {
      toast.success(`练习完成！正确率 ${Math.round(sessionStats.correct / sessionStats.total * 100)}%`)
      setPracticeMode(false)
    }
  }

  // 掌握度分布
  const masteryDistOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'] },
    yAxis: { type: 'value', name: '知识点数' },
    series: [{
      type: 'bar',
      data: [
        knowledgeMap.filter(k => k.mastery < 20).length,
        knowledgeMap.filter(k => k.mastery >= 20 && k.mastery < 40).length,
        knowledgeMap.filter(k => k.mastery >= 40 && k.mastery < 60).length,
        knowledgeMap.filter(k => k.mastery >= 60 && k.mastery < 80).length,
        knowledgeMap.filter(k => k.mastery >= 80).length,
      ],
      itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] },
      label: { show: true, position: 'top' },
    }]
  }), [knowledgeMap])

  return (
    <div>
      <PageHeader
        title="🎯 自适应学习引擎"
        subtitle="IRT项目反应理论 · BKT知识追踪 · 动态难度调整 · 个性化学习路径"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['dashboard', '📊 学习仪表盘'], ['path', '🗺️ 推荐路径'], ['practice', '📝 自适应练习']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#1e40af' : '#6b7280', fontWeight: activeTab === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 概览卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>🧠 IRT能力估计值</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{estimatedAbility}<span style={{ fontSize: 14, color: '#6b7280' }}>/100</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 已掌握知识点</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{knowledgeMap.filter(k => k.mastery >= 70).length}<span style={{ fontSize: 14, color: '#6b7280' }}>/{knowledgeMap.length}</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>⚠️ 薄弱知识点</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{knowledgeMap.filter(k => k.mastery < 50).length}<span style={{ fontSize: 14, color: '#6b7280' }}>个</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>📝 累计练习题量</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>{knowledgeMap.reduce((a, k) => a + k.questions_done, 0)}<span style={{ fontSize: 14, color: '#6b7280' }}>道</span></div>
        </div>
      </div>

      {/* 练习模式 */}
      {practiceMode && activeKP && (
        <div className="card mb16" style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1px solid #bae6fd' }}>
          <div className="card-title">
            <span>📝 自适应练习 - {activeKP.name}</span>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span>当前难度: <b style={{ color: '#3b82f6' }}>{Math.round(sessionStats.current_difficulty * 100)}%</b></span>
              <span>正确率: <b style={{ color: sessionStats.total > 0 ? (sessionStats.correct / sessionStats.total >= 0.7 ? '#10b981' : '#f59e0b') : '#6b7280' }}>{sessionStats.total > 0 ? Math.round(sessionStats.correct / sessionStats.total * 100) : 0}%</b></span>
              <span>第 {currentQ + 1}/{PRACTICE_QUESTIONS.length} 题</span>
            </div>
          </div>
          {!showResult ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', marginBottom: 16, padding: 14, background: '#fff', borderRadius: 8 }}>
                {PRACTICE_QUESTIONS[currentQ]?.content}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PRACTICE_QUESTIONS[currentQ]?.options?.map((opt, i) => (
                  <button key={i} onClick={() => submitAnswer(opt.charAt(0))}
                    style={{ padding: '12px 16px', textAlign: 'left', borderRadius: 8, cursor: 'pointer', background: '#fff', border: '2px solid #e5e7eb', fontSize: 14, color: '#1f2937' }}
                    onMouseEnter={e => e.target.style.borderColor = '#3b82f6'}
                    onMouseLeave={e => e.target.style.borderColor = '#e5e7eb'}>
                    {opt}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: 14, background: userAnswer === PRACTICE_QUESTIONS[currentQ]?.answer ? '#f0fdf4' : '#fef2f2', borderRadius: 8, marginBottom: 12, border: `1px solid ${userAnswer === PRACTICE_QUESTIONS[currentQ]?.answer ? '#bbf7d0' : '#fecaca'}` }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: userAnswer === PRACTICE_QUESTIONS[currentQ]?.answer ? '#16a34a' : '#ef4444', marginBottom: 6 }}>
                  {userAnswer === PRACTICE_QUESTIONS[currentQ]?.answer ? '✅ 回答正确！难度提升中...' : '❌ 回答错误，难度降低中...'}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>你的答案: {userAnswer} | 正确答案: {PRACTICE_QUESTIONS[currentQ]?.answer}</div>
              </div>
              <button className="btn primary" onClick={nextQuestion}>{currentQ < PRACTICE_QUESTIONS.length - 1 ? '下一题 →' : '完成练习'}</button>
            </>
          )}
        </div>
      )}

      {/* 学习仪表盘 */}
      {activeTab === 'dashboard' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>📊 知识点掌握度分布</span></div>
            <EChart option={masteryDistOption} height={300} />
          </div>
          <div className="card">
            <div className="card-title"><span>📋 知识点掌握详情</span></div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {knowledgeMap.map(kp => (
                <div key={kp.id} style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Tag color={kp.subject === '英语' ? 'blue' : kp.subject === '数学' ? 'green' : 'purple'} style={{ fontSize: 10 }}>{kp.subject}</Tag>
                  <span style={{ fontSize: 13, flex: 1 }}>{kp.name}</span>
                  <div style={{ width: 80, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${kp.mastery}%`, height: '100%', background: kp.mastery >= 70 ? '#10b981' : kp.mastery >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: kp.mastery >= 70 ? '#10b981' : kp.mastery >= 50 ? '#f59e0b' : '#ef4444', minWidth: 40, textAlign: 'right' }}>{kp.mastery}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 推荐路径 */}
      {activeTab === 'path' && (
        <div className="card">
          <div className="card-title"><span>🗺️ BKT智能推荐学习路径</span><Tag color="purple">基于知识追踪</Tag></div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, padding: '10px 14px', background: '#faf5ff', borderRadius: 8 }}>
            💡 系统基于BKT知识追踪模型，分析每个知识点的掌握概率、学习速率和提分潜力，智能推荐最优学习顺序
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recommendedPath.map((kp, idx) => (
              <div key={kp.id} style={{ padding: 16, background: idx === 0 ? '#fef2f2' : '#f8fafc', borderRadius: 12, border: `1px solid ${idx === 0 ? '#fecaca' : '#e5e7eb'}`, borderLeft: `4px solid ${['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'][idx]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'][idx], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{idx + 1}</div>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>{kp.name}</span>
                    <Tag color={kp.subject === '英语' ? 'blue' : kp.subject === '数学' ? 'green' : 'purple'}>{kp.subject}</Tag>
                  </div>
                  <button className="btn primary sm" onClick={() => startPractice(kp)}>开始练习</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 12 }}>
                  <div><span style={{ color: '#6b7280' }}>当前掌握:</span> <b style={{ color: kp.mastery >= 70 ? '#10b981' : kp.mastery >= 50 ? '#f59e0b' : '#ef4444' }}>{kp.mastery}%</b></div>
                  <div><span style={{ color: '#6b7280' }}>题目难度:</span> <b>{Math.round(kp.difficulty * 100)}%</b></div>
                  <div><span style={{ color: '#6b7280' }}>已练习题:</span> <b>{kp.questions_done}道</b></div>
                  <div><span style={{ color: '#6b7280' }}>预计提分:</span> <b style={{ color: '#10b981' }}>+{Math.round((70 - kp.mastery) * 0.6)}%</b></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 自适应练习 */}
      {activeTab === 'practice' && !practiceMode && (
        <div className="card">
          <div className="card-title"><span>📝 选择知识点开始自适应练习</span></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {knowledgeMap.map(kp => (
              <div key={kp.id} style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => startPractice(kp)}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{kp.name}</span>
                  <Tag color={kp.subject === '英语' ? 'blue' : kp.subject === '数学' ? 'green' : 'purple'} style={{ fontSize: 10 }}>{kp.subject}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>掌握度: <b style={{ color: kp.mastery >= 70 ? '#10b981' : kp.mastery >= 50 ? '#f59e0b' : '#ef4444' }}>{kp.mastery}%</b></div>
                <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${kp.mastery}%`, height: '100%', background: kp.mastery >= 70 ? '#10b981' : kp.mastery >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
