import { useState, useEffect, useMemo } from 'react'
import { PageHeader, Tag, Loading, toast } from '../components/ui'
import EChart from '../components/EChart'

// 薄弱知识点数据
const WEAK_POINTS = [
  { id: 1, name: '阅读理解·推理判断', subject: '英语', mastery: 45, wrong_count: 12, question_count: 20, trend: -5, priority: 'high',
    related_knowledge: ['细节理解', '主旨大意', '词义猜测'],
    learning_path: ['复习推理判断题解题技巧', '完成5篇推理判断专项练习', '错题复盘与总结', '进阶练习与测试'] },
  { id: 2, name: '完形填空·词汇辨析', subject: '英语', mastery: 52, wrong_count: 10, question_count: 18, trend: -3, priority: 'high',
    related_knowledge: ['固定搭配', '语境理解', '逻辑关系'],
    learning_path: ['积累高频易混淆词汇', '完成10篇完形填空专项', '总结词汇辨析规律', '限时训练提升速度'] },
  { id: 3, name: '翻译·长难句处理', subject: '英语', mastery: 58, wrong_count: 8, question_count: 15, trend: 2, priority: 'medium',
    related_knowledge: ['从句结构', '非谓语动词', '语序调整'],
    learning_path: ['学习长难句分析方法', '练习20个经典长难句翻译', '总结翻译技巧', '整段翻译训练'] },
  { id: 4, name: '写作·议论文结构', subject: '英语', mastery: 62, wrong_count: 6, question_count: 12, trend: 5, priority: 'medium',
    related_knowledge: ['论点明确', '论据充分', '连接词使用'],
    learning_path: ['学习议论文写作框架', '背诵5篇优秀范文', '每周写1篇议论文', '互评与修改'] },
  { id: 5, name: '听力·细节捕捉', subject: '英语', mastery: 68, wrong_count: 5, question_count: 15, trend: 8, priority: 'low',
    related_knowledge: ['数字信息', '时间地点', '人物关系'],
    learning_path: ['精听训练', '听写练习', '场景词汇积累', '模拟测试'] },
]

// 专项练习题库
const PRACTICE_QUESTIONS = {
  1: [
    { id: 1, type: '阅读', content: 'What can be inferred from the passage about the author\'s attitude?', options: ['A. Supportive', 'B. Critical', 'C. Neutral', 'D. Indifferent'], answer: 'B', analysis: '根据文中"however""but"等转折词后的内容，可以推断作者持批判态度。' },
    { id: 2, type: '阅读', content: 'The author mentions the example in paragraph 3 to illustrate that...', options: ['A. technology is beneficial', 'B. technology has drawbacks', 'C. technology is neutral', 'D. technology is complex'], answer: 'B', analysis: '例子后紧跟的总结句说明了技术的负面影响。' },
    { id: 3, type: '阅读', content: 'Which of the following can be concluded from the last paragraph?', options: ['A. The problem is solved', 'B. More research is needed', 'C. The situation is hopeless', 'D. No conclusion can be drawn'], answer: 'B', analysis: '最后一段提到"further studies are needed"，说明需要更多研究。' },
  ],
  2: [
    { id: 1, type: '完形', content: 'The scientist was _____ by the unexpected results of the experiment.', options: ['A. surprised', 'B. shocked', 'C. amazed', 'D. astonished'], answer: 'A', analysis: 'surprised是最通用的"惊讶"，shocked程度过重，amazed/astonished带有惊叹意味。' },
    { id: 2, type: '完形', content: 'The company decided to _____ the new product launch due to market conditions.', options: ['A. delay', 'B. postpone', 'C. defer', 'D. put off'], answer: 'B', analysis: 'postpone正式场合常用，delay偏中性，defer较正式，put off口语化。' },
  ],
  3: [
    { id: 1, type: '翻译', content: '虽然面临诸多挑战，但我们仍有信心完成这个项目。', answer: 'Despite facing many challenges, we are still confident in completing this project.', analysis: '"虽然"用despite后接名词短语，"有信心做某事"用be confident in doing。' },
    { id: 2, type: '翻译', content: '这项新技术的应用将极大地提高生产效率。', answer: 'The application of this new technology will greatly improve production efficiency.', analysis: '"...的应用"用the application of，"极大地提高"用greatly improve。' },
  ],
  4: [
    { id: 1, type: '写作', content: '写作练习：以"The Importance of Time Management"为题写一篇150词议论文', answer: '参考框架：1. 引言：时间管理的重要性 2. 主体：提高效率、减少压力、实现目标 3. 结论：总结并呼吁行动', analysis: '议论文结构：引言-主体-结论，每段有明确主题句。' },
  ],
  5: [
    { id: 1, type: '听力', content: '听力练习：听对话，回答：What time does the meeting start?', options: ['A. 9:00', 'B. 9:30', 'C. 10:00', 'D. 10:30'], answer: 'B', analysis: '对话中提到"the meeting was supposed to start at 9, but it was delayed by half an hour"，所以是9:30。' },
  ],
}

// 教师端班级数据
const CLASS_WEAK_POINTS = [
  { name: '阅读理解·推理判断', class_avg: 52, school_avg: 65, gap: -13, student_count: 32, suggestion: '建议用2课时讲解推理判断题解题技巧，配合5篇专项练习' },
  { name: '完形填空·词汇辨析', class_avg: 58, school_avg: 68, gap: -10, student_count: 28, suggestion: '建议整理高频易混淆词汇表，布置词汇积累作业' },
  { name: '翻译·长难句处理', class_avg: 62, school_avg: 70, gap: -8, student_count: 25, suggestion: '建议增加长难句分析训练，每周布置3个长难句翻译练习' },
  { name: '写作·议论文结构', class_avg: 68, school_avg: 72, gap: -4, student_count: 18, suggestion: '建议讲解议论文写作框架，提供模板和范文，增加写作练习频率' },
  { name: '听力·细节捕捉', class_avg: 75, school_avg: 73, gap: 2, student_count: 10, suggestion: '班级表现优于校平均，可适当增加难度进行提升训练' },
]

export default function LearningLoop() {
  const [role, setRole] = useState('student') // student / teacher
  const [weakPoints, setWeakPoints] = useState(WEAK_POINTS)
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [practiceMode, setPracticeMode] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [showResult, setShowResult] = useState(false)
  const [learningProgress, setLearningProgress] = useState({})
  const [activeTab, setActiveTab] = useState('diagnosis') // diagnosis / path / practice / progress

  // 计算练习结果
  const practiceResult = useMemo(() => {
    if (!selectedPoint || !showResult) return null
    const questions = PRACTICE_QUESTIONS[selectedPoint.id] || []
    let correct = 0
    questions.forEach((q, i) => {
      if (userAnswers[i] === q.answer) correct++
    })
    return { correct, total: questions.length, score: Math.round(correct / questions.length * 100) }
  }, [selectedPoint, showResult, userAnswers])

  // 开始练习
  const startPractice = (point) => {
    setSelectedPoint(point)
    setPracticeMode(true)
    setCurrentQuestion(0)
    setUserAnswers({})
    setShowResult(false)
  }

  // 提交答案
  const submitAnswer = (answer) => {
    setUserAnswers({ ...userAnswers, [currentQuestion]: answer })
  }

  // 下一题
  const nextQuestion = () => {
    const questions = PRACTICE_QUESTIONS[selectedPoint.id] || []
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      setShowResult(true)
      // 更新学习进度
      const newProgress = { ...learningProgress }
      newProgress[selectedPoint.id] = {
        last_practice: new Date().toLocaleDateString('zh-CN'),
        practice_count: (newProgress[selectedPoint.id]?.practice_count || 0) + 1,
        best_score: Math.max(newProgress[selectedPoint.id]?.best_score || 0, practiceResult?.score || 0),
      }
      setLearningProgress(newProgress)
    }
  }

  // 班级薄弱点雷达图
  const classRadarOption = useMemo(() => ({
    tooltip: { backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { data: ['班级平均', '校平均'], top: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    radar: {
      indicator: CLASS_WEAK_POINTS.map(p => ({ name: p.name.split('·')[1] || p.name, max: 100 })),
      shape: 'polygon', splitNumber: 4,
      axisName: { color: '#6b7280', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
    },
    series: [{
      type: 'radar',
      data: [
        { value: CLASS_WEAK_POINTS.map(p => p.class_avg), name: '班级平均', areaStyle: { color: 'rgba(59,130,246,0.2)' }, lineStyle: { color: '#3b82f6', width: 2 }, itemStyle: { color: '#3b82f6' } },
        { value: CLASS_WEAK_POINTS.map(p => p.school_avg), name: '校平均', areaStyle: { color: 'rgba(16,185,129,0.1)' }, lineStyle: { color: '#10b981', width: 2, type: 'dashed' }, itemStyle: { color: '#10b981' } },
      ]
    }]
  }), [])

  // 生成复习课件大纲
  const generateCourseware = () => {
    toast.success('复习课件大纲已生成，可导出为Word/PDF')
  }

  return (
    <div>
      <PageHeader
        title="🔄 考后诊断回流教学（学习闭环）"
        subtitle="以评促学 · 以评促教 · 薄弱知识点诊断 → 个性化学习路径 → 专项练习 → 教学反拨"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['student', '👨‍🎓 学生视角'], ['teacher', '👨‍🏫 教师视角']].map(([key, label]) => (
              <button key={key} onClick={() => setRole(key)}
                style={{
                  padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: role === key ? '#fff' : 'transparent',
                  color: role === key ? '#1e40af' : '#6b7280',
                  fontWeight: role === key ? 600 : 400,
                  boxShadow: role === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 练习模式弹窗 */}
      {practiceMode && selectedPoint && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 700, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
            {!showResult ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <Tag color="blue">{selectedPoint.name}</Tag>
                    <span style={{ fontSize: 14, color: '#6b7280', marginLeft: 8 }}>专项练习</span>
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280' }}>
                    第 {currentQuestion + 1} / {PRACTICE_QUESTIONS[selectedPoint.id]?.length || 0} 题
                  </div>
                </div>
                {/* 进度条 */}
                <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 20, overflow: 'hidden' }}>
                  <div style={{ width: `${(currentQuestion + 1) / (PRACTICE_QUESTIONS[selectedPoint.id]?.length || 1) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                {/* 题目 */}
                {PRACTICE_QUESTIONS[selectedPoint.id]?.[currentQuestion] && (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', marginBottom: 16, lineHeight: 1.7 }}>
                      {PRACTICE_QUESTIONS[selectedPoint.id][currentQuestion].content}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {PRACTICE_QUESTIONS[selectedPoint.id][currentQuestion].options?.map((opt, i) => (
                        <button key={i} onClick={() => submitAnswer(opt.charAt(0))}
                          style={{
                            padding: '12px 16px', textAlign: 'left', borderRadius: 8, cursor: 'pointer',
                            background: userAnswers[currentQuestion] === opt.charAt(0) ? '#eff6ff' : '#f8fafc',
                            border: `2px solid ${userAnswers[currentQuestion] === opt.charAt(0) ? '#3b82f6' : '#e5e7eb'}`,
                            fontSize: 14, color: '#1f2937',
                          }}>
                          {opt}
                        </button>
                      ))}
                      {!PRACTICE_QUESTIONS[selectedPoint.id][currentQuestion].options && (
                        <textarea rows={4} placeholder="请输入你的答案..." className="input" style={{ width: '100%' }} />
                      )}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                  <button className="btn" onClick={() => setPracticeMode(false)}>退出练习</button>
                  <button className="btn primary" onClick={nextQuestion} disabled={!userAnswers[currentQuestion]}>
                    {currentQuestion < (PRACTICE_QUESTIONS[selectedPoint.id]?.length || 1) - 1 ? '下一题 →' : '提交并查看结果'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>{practiceResult.score >= 80 ? '🎉' : practiceResult.score >= 60 ? '👍' : '💪'}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>练习完成！</div>
                  <div style={{ fontSize: 48, fontWeight: 700, color: practiceResult.score >= 80 ? '#10b981' : practiceResult.score >= 60 ? '#f59e0b' : '#ef4444' }}>
                    {practiceResult.score}分
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
                    正确 {practiceResult.correct} / {practiceResult.total} 题
                  </div>
                </div>
                {/* 答题详情 */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>📋 答题详情</div>
                  {PRACTICE_QUESTIONS[selectedPoint.id]?.map((q, i) => (
                    <div key={i} style={{ padding: 12, background: userAnswers[i] === q.answer ? '#f0fdf4' : '#fef2f2', borderRadius: 8, marginBottom: 8, border: `1px solid ${userAnswers[i] === q.answer ? '#bbf7d0' : '#fecaca'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>第{i + 1}题</span>
                        <Tag color={userAnswers[i] === q.answer ? 'green' : 'red'}>{userAnswers[i] === q.answer ? '正确' : '错误'}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>你的答案：{userAnswers[i] || '未作答'} | 正确答案：{q.answer}</div>
                      {q.analysis && <div style={{ fontSize: 12, color: '#4b5563', background: '#fff', padding: '6px 10px', borderRadius: 4 }}>💡 {q.analysis}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button className="btn" onClick={() => { setCurrentQuestion(0); setUserAnswers({}); setShowResult(false) }}>🔄 再练一次</button>
                  <button className="btn primary" onClick={() => setPracticeMode(false)}>返回诊断</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 学生视角 */}
      {role === 'student' && (
        <>
          {/* Tab切换 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
            {[['diagnosis', '🔍 薄弱点诊断'], ['path', '🗺️ 学习路径'], ['practice', '📝 专项练习'], ['progress', '📈 学习进度']].map(([key, label]) => (
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

          {/* 薄弱点诊断Tab */}
          {activeTab === 'diagnosis' && (
            <div className="card">
              <div className="card-title">
                <span>🔍 薄弱知识点诊断</span>
                <Tag color="red">{weakPoints.filter(p => p.priority === 'high').length}个高优先级</Tag>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {weakPoints.map(p => (
                  <div key={p.id} style={{ padding: 16, background: p.priority === 'high' ? '#fef2f2' : p.priority === 'medium' ? '#fffbeb' : '#f8fafc', borderRadius: 12, border: `1px solid ${p.priority === 'high' ? '#fecaca' : p.priority === 'medium' ? '#fde68a' : '#e5e7eb'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Tag color={p.subject === '英语' ? 'blue' : 'green'}>{p.subject}</Tag>
                          <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>{p.name}</span>
                          <Tag color={p.priority === 'high' ? 'red' : p.priority === 'medium' ? 'orange' : 'gray'}>
                            {p.priority === 'high' ? '高优先级' : p.priority === 'medium' ? '中优先级' : '低优先级'}
                          </Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          关联知识点：{p.related_knowledge.join('、')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: p.mastery >= 70 ? '#10b981' : p.mastery >= 55 ? '#f59e0b' : '#ef4444' }}>{p.mastery}%</div>
                        <div style={{ fontSize: 12, color: p.trend >= 0 ? '#10b981' : '#ef4444' }}>{p.trend >= 0 ? '↑' : '↓'}{Math.abs(p.trend)}% 较上次</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: '#6b7280', minWidth: 80 }}>掌握度</span>
                      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${p.mastery}%`, height: '100%', background: p.mastery >= 70 ? '#10b981' : p.mastery >= 55 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>错题 {p.wrong_count}/{p.question_count}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn primary sm" onClick={() => startPractice(p)}>📝 开始专项练习</button>
                      <button className="btn sm" onClick={() => setSelectedPoint(p)}>🗺️ 查看学习路径</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 学习路径Tab */}
          {activeTab === 'path' && (
            <div className="card">
              <div className="card-title"><span>🗺️ 个性化学习路径</span><Tag color="purple">AI智能规划</Tag></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {weakPoints.slice(0, 3).map((p, idx) => (
                  <div key={p.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: ['#ef4444', '#f59e0b', '#3b82f6'][idx], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{idx + 1}</div>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>{p.name}</span>
                      <Tag color={idx === 0 ? 'red' : idx === 1 ? 'orange' : 'blue'}>{idx === 0 ? '优先攻克' : idx === 1 ? '重点提升' : '稳步提高'}</Tag>
                    </div>
                    <div style={{ paddingLeft: 48, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 63, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} />
                      {p.learning_path.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16, position: 'relative' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: learningProgress[p.id]?.practice_count > i ? '#10b981' : '#fff', border: `2px solid ${learningProgress[p.id]?.practice_count > i ? '#10b981' : '#cbd5e1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: learningProgress[p.id]?.practice_count > i ? '#fff' : '#9ca3af', zIndex: 1, flexShrink: 0 }}>
                            {learningProgress[p.id]?.practice_count > i ? '✓' : i + 1}
                          </div>
                          <div style={{ flex: 1, padding: 12, background: learningProgress[p.id]?.practice_count > i ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${learningProgress[p.id]?.practice_count > i ? '#bbf7d0' : '#e5e7eb'}` }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>{step}</div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                              预计用时：{['30分钟', '1小时', '30分钟', '1小时'][i]} · 预计提升：{['5%', '8%', '5%', '10%'][i]}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 专项练习Tab */}
          {activeTab === 'practice' && (
            <div className="card">
              <div className="card-title"><span>📝 专项练习库</span><Tag color="blue">{weakPoints.length}个知识点</Tag></div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {weakPoints.map(p => (
                  <div key={p.id} style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Tag color={p.subject === '英语' ? 'blue' : 'green'}>{p.subject}</Tag>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{PRACTICE_QUESTIONS[p.id]?.length || 0}道题</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                      当前掌握度：<b style={{ color: p.mastery >= 70 ? '#10b981' : p.mastery >= 55 ? '#f59e0b' : '#ef4444' }}>{p.mastery}%</b>
                      {learningProgress[p.id]?.best_score && <span style={{ marginLeft: 8, color: '#10b981' }}>最佳练习：{learningProgress[p.id].best_score}分</span>}
                    </div>
                    <button className="btn primary" style={{ width: '100%' }} onClick={() => startPractice(p)}>开始练习</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 学习进度Tab */}
          {activeTab === 'progress' && (
            <div className="card">
              <div className="card-title"><span>📈 学习进度跟踪</span><Tag color="green">持续提升中</Tag></div>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#16a34a' }}>累计练习次数</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#166534', marginTop: 4 }}>{Object.values(learningProgress).reduce((a, p) => a + (p.practice_count || 0), 0)}</div>
                </div>
                <div style={{ padding: 16, background: '#eff6ff', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#3b82f6' }}>已攻克知识点</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>{Object.keys(learningProgress).length}/{weakPoints.length}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {weakPoints.map(p => (
                  <div key={p.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937', marginBottom: 4 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {learningProgress[p.id] ? `上次练习：${learningProgress[p.id].last_practice} · 最佳：${learningProgress[p.id].best_score}分` : '尚未开始练习'}
                      </div>
                    </div>
                    <div style={{ width: 150, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${p.mastery}%`, height: '100%', background: p.mastery >= 70 ? '#10b981' : p.mastery >= 55 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: p.mastery >= 70 ? '#10b981' : p.mastery >= 55 ? '#f59e0b' : '#ef4444', minWidth: 50, textAlign: 'right' }}>{p.mastery}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 教师视角 */}
      {role === 'teacher' && (
        <>
          {/* 班级薄弱点分析 */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-title"><span>📊 班级薄弱点雷达图</span><Tag color="blue">班级vs校平均</Tag></div>
              <EChart option={classRadarOption} height={320} />
            </div>
            <div className="card">
              <div className="card-title"><span>📈 班级整体提升建议</span><Tag color="purple">AI教学建议</Tag></div>
              <div style={{ padding: 16, background: '#faf5ff', borderRadius: 10, border: '1px solid #ddd6fe', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#5b21b6', marginBottom: 8 }}>🎯 教学重点调整建议</div>
                <div style={{ fontSize: 13, color: '#7c3aed', lineHeight: 1.8 }}>
                  1. 班级在<b>阅读理解·推理判断</b>（52%）和<b>完形填空·词汇辨析</b>（58%）上明显低于校平均，建议作为下一阶段教学重点。<br />
                  2. 建议用2-3课时专项讲解推理判断题解题技巧，配合5篇专项练习。<br />
                  3. 整理高频易混淆词汇表，布置每日词汇积累作业。<br />
                  4. 翻译和写作接近校平均，可保持现有教学节奏，适当增加练习频率。
                </div>
              </div>
              <button className="btn primary" style={{ width: '100%' }} onClick={generateCourseware}>
                📄 自动生成复习课件大纲
              </button>
            </div>
          </div>

          {/* 班级薄弱点详情 */}
          <div className="card">
            <div className="card-title"><span>📋 班级薄弱点详情与教学建议</span><Tag color="gray">{CLASS_WEAK_POINTS.length}个知识点</Tag></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>知识点</th><th>班级平均</th><th>校平均</th><th>差距</th><th>薄弱学生数</th><th>教学建议</th><th>操作</th></tr></thead>
                <tbody>
                  {CLASS_WEAK_POINTS.map((p, i) => (
                    <tr key={i}>
                      <td><b>{p.name}</b></td>
                      <td className="num" style={{ fontWeight: 600, color: p.class_avg >= 70 ? '#10b981' : p.class_avg >= 55 ? '#f59e0b' : '#ef4444' }}>{p.class_avg}%</td>
                      <td className="num">{p.school_avg}%</td>
                      <td className="num" style={{ color: p.gap >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{p.gap >= 0 ? '+' : ''}{p.gap}%</td>
                      <td className="num">{p.student_count}人</td>
                      <td style={{ fontSize: 12, color: '#4b5563', maxWidth: 300 }}>{p.suggestion}</td>
                      <td>
                        <div className="flex">
                          <button className="btn sm" onClick={() => toast.success('已推送专项练习给学生')}>推送练习</button>
                          <button className="btn sm" onClick={() => toast.success('已生成教学PPT大纲')}>生成课件</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 教学反拨效果 */}
          <div className="card mt16" style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #bbf7d0' }}>
            <div className="card-title"><span>🔄 教学反拨效果评估</span><Tag color="green">以评促教</Tag></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                ['已推送专项练习', '12次', 'blue'],
                ['已生成复习课件', '5份', 'purple'],
                ['学生平均提升', '+8.5%', 'green'],
                ['班级排名提升', '3名', 'orange'],
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: 16, background: '#fff', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: color === 'blue' ? '#3b82f6' : color === 'purple' ? '#8b5cf6' : color === 'green' ? '#10b981' : '#f59e0b', marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: 14, background: '#fff', borderRadius: 8, fontSize: 13, color: '#166534', lineHeight: 1.8 }}>
              💡 <b>闭环反拨效果总结：</b>通过考后诊断→薄弱点识别→个性化学习路径→专项练习→教学调整的完整闭环，班级整体成绩较上次考试提升8.5%，推理判断题正确率从45%提升至62%，词汇辨析题正确率从52%提升至68%。建议继续深化"以评促学、以评促教"模式，实现教学质量持续提升。
            </div>
          </div>
        </>
      )}
    </div>
  )
}
