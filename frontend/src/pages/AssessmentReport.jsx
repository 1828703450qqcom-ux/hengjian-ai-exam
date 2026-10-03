import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

const AssessmentReport = () => {
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState(null)
  const [overview, setOverview] = useState(null)
  const [questionAnalysis, setQuestionAnalysis] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview') // overview/questions/ai_analysis/export

  const fetchExams = useCallback(async () => {
    try {
      const res = await api.get('/exams?limit=50')
      setExams(res.data?.items || res.data?.exams || [])
    } catch (e) {
      console.error('获取考试列表失败', e)
    }
  }, [])

  useEffect(() => {
    fetchExams()
  }, [fetchExams])

  const loadExamData = async (examId) => {
    setLoading(true)
    setSelectedExam(examId)
    try {
      const [overviewRes, questionRes] = await Promise.all([
        api.get(`/assessment-report/exam/${examId}/overview`),
        api.get(`/assessment-report/exam/${examId}/question-analysis`),
      ])
      setOverview(overviewRes.data)
      setQuestionAnalysis(questionRes.data)
    } catch (e) {
      console.error('加载考试数据失败', e)
    }
    setLoading(false)
  }

  const generateReport = async () => {
    if (!selectedExam) return
    setLoading(true)
    try {
      const res = await api.post('/assessment-report/generate', {
        exam_id: selectedExam,
        report_type: 'full',
        include_ai_analysis: true,
      })
      setReport(res.data)
      setActiveTab('ai_analysis')
    } catch (e) {
      console.error('生成报告失败', e)
    }
    setLoading(false)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  const getScoreColor = (score) => {
    if (score >= 90) return '#059669'
    if (score >= 80) return '#10b981'
    if (score >= 70) return '#f59e0b'
    if (score >= 60) return '#f97316'
    return '#dc2626'
  }

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <style>{`
        .assessment-report .ar-card {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          padding: 20px;
        }
        .assessment-report .ar-tab {
          padding: 10px 20px;
          border-radius: 10px 10px 0 0;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          color: #64748b;
          border-bottom: 3px solid transparent;
        }
        .assessment-report .ar-tab:hover { color: #3b82f6; }
        .assessment-report .ar-tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          background: rgba(59,130,246,0.05);
        }
        .assessment-report .ar-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .assessment-report .ar-btn-primary {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }
        .assessment-report .ar-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .assessment-report .ar-btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }
        .assessment-report .ar-btn-secondary:hover { background: #e2e8f0; }
        .assessment-report .ar-stat-card {
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        .assessment-report .ar-stat-value {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .assessment-report .ar-stat-label {
          font-size: 12px;
          color: #64748b;
        }
        .assessment-report .ar-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .assessment-report .ar-table th {
          background: #f8fafc;
          padding: 10px;
          text-align: left;
          font-weight: 600;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        .assessment-report .ar-table td {
          padding: 10px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        .assessment-report .ar-table tr:hover { background: #f8fafc; }
        .assessment-report .ar-badge {
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .assessment-report .ar-analysis-box {
          background: #f8fafc;
          border-left: 4px solid #3b82f6;
          padding: 16px;
          border-radius: 0 12px 12px 0;
          margin-bottom: 16px;
        }
        .assessment-report .ar-suggestion-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
          margin-bottom: 8px;
        }
      `}</style>

      <div className="assessment-report">
        {/* 页面标题 */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📊 课程考核评估报告
            </h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
              基于AI大模型辅助生成课程考核评估报告、试卷分析、总评成绩统计，助力教学反拨与课程评估
            </p>
          </div>
          {selectedExam && (
            <button className="ar-btn ar-btn-primary" onClick={generateReport} disabled={loading}>
              {loading ? '⏳ 生成中...' : '🤖 AI生成完整报告'}
            </button>
          )}
        </div>

        {/* 考试选择 */}
        <div className="ar-card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>选择考试：</span>
            <select
              className="ar-btn ar-btn-secondary"
              value={selectedExam || ''}
              onChange={(e) => e.target.value && loadExamData(parseInt(e.target.value))}
              style={{ minWidth: '300px', textAlign: 'left' }}
            >
              <option value="">请选择要分析的考试</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} - {exam.course || '未分类'} ({formatDate(exam.start_time)})
                </option>
              ))}
            </select>
            {overview && (
              <span style={{ color: '#64748b', fontSize: '13px' }}>
                当前分析：<b style={{ color: '#3b82f6' }}>{overview.exam_title}</b>
              </span>
            )}
          </div>
        </div>

        {!selectedExam ? (
          <div className="ar-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.3 }}>📊</div>
            <h3 style={{ color: '#64748b', marginBottom: '8px' }}>请选择考试</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>选择一场已完成的考试，系统将自动生成课程考核评估报告</p>
          </div>
        ) : loading ? (
          <div className="ar-card" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
            <p>正在加载考试数据...</p>
          </div>
        ) : (
          <>
            {/* 标签页 */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div className={`ar-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                📈 考情总览
              </div>
              <div className={`ar-tab ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => setActiveTab('questions')}>
                📝 题目分析
              </div>
              <div className={`ar-tab ${activeTab === 'ai_analysis' ? 'active' : ''}`} onClick={() => setActiveTab('ai_analysis')}>
                🤖 AI分析报告
              </div>
              <div className={`ar-tab ${activeTab === 'export' ? 'active' : ''}`} onClick={() => setActiveTab('export')}>
                📥 导出报告
              </div>
            </div>

            {/* 考情总览 */}
            {activeTab === 'overview' && overview && (
              <div>
                {/* 核心指标卡片 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#3b82f6' }}>{overview.participants?.total || 0}</div>
                    <div className="ar-stat-label">应考人数</div>
                  </div>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#10b981' }}>{overview.participants?.submitted || 0}</div>
                    <div className="ar-stat-label">实考人数</div>
                  </div>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#f59e0b' }}>{overview.participants?.absent || 0}</div>
                    <div className="ar-stat-label">缺考人数</div>
                  </div>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: getScoreColor(overview.scores?.average || 0) }}>{overview.scores?.average?.toFixed(1) || '-'}</div>
                    <div className="ar-stat-label">平均分</div>
                  </div>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#059669' }}>{overview.scores?.pass_rate?.toFixed(1) || 0}%</div>
                    <div className="ar-stat-label">及格率</div>
                  </div>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#8b5cf6' }}>{overview.scores?.excellent_rate?.toFixed(1) || 0}%</div>
                    <div className="ar-stat-label">优秀率</div>
                  </div>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#64748b' }}>{overview.scores?.std_dev?.toFixed(1) || '-'}</div>
                    <div className="ar-stat-label">标准差</div>
                  </div>
                </div>

                {/* 分数段分布 */}
                <div className="ar-card" style={{ marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                    📊 分数段分布
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '200px' }}>
                    {Object.entries(overview.score_distribution || {}).map(([range, count]) => {
                      const maxCount = Math.max(...Object.values(overview.score_distribution || {}), 1)
                      const height = (count / maxCount) * 160
                      const colors = {
                        '90-100': '#059669',
                        '80-89': '#10b981',
                        '70-79': '#f59e0b',
                        '60-69': '#f97316',
                        '0-59': '#dc2626',
                      }
                      return (
                        <div key={range} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: colors[range], marginBottom: '4px' }}>{count}</div>
                          <div style={{
                            height: `${height}px`,
                            background: `linear-gradient(180deg, ${colors[range]}, ${colors[range]}88)`,
                            borderRadius: '8px 8px 0 0',
                            minHeight: count > 0 ? '8px' : '0',
                            transition: 'height 0.3s',
                          }} />
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>{range}分</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 考试基本信息 */}
                <div className="ar-card">
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                    📋 考试基本信息
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>考试名称</span><div style={{ fontWeight: 600, color: '#1e293b' }}>{overview.exam_title}</div></div>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>所属课程</span><div style={{ fontWeight: 600, color: '#1e293b' }}>{overview.course_name}</div></div>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>考试类型</span><div style={{ fontWeight: 600, color: '#1e293b' }}>{overview.exam_type === 'online' ? '在线考试' : '纸笔考试'}</div></div>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>开始时间</span><div style={{ fontWeight: 600, color: '#1e293b' }}>{formatDate(overview.start_time)}</div></div>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>结束时间</span><div style={{ fontWeight: 600, color: '#1e293b' }}>{formatDate(overview.end_time)}</div></div>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>考试时长</span><div style={{ fontWeight: 600, color: '#1e293b' }}>{overview.duration_minutes}分钟</div></div>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>最高分</span><div style={{ fontWeight: 600, color: '#059669' }}>{overview.scores?.max || '-'}</div></div>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>最低分</span><div style={{ fontWeight: 600, color: '#dc2626' }}>{overview.scores?.min || '-'}</div></div>
                    <div><span style={{ color: '#64748b', fontSize: '12px' }}>参考率</span><div style={{ fontWeight: 600, color: '#3b82f6' }}>{overview.participants?.attendance_rate?.toFixed(1) || 0}%</div></div>
                  </div>
                </div>
              </div>
            )}

            {/* 题目分析 */}
            {activeTab === 'questions' && questionAnalysis && (
              <div>
                {/* 整体指标 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#3b82f6' }}>{questionAnalysis.total_questions}</div>
                    <div className="ar-stat-label">题目总数</div>
                  </div>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#f59e0b' }}>{questionAnalysis.avg_difficulty?.toFixed(3) || '-'}</div>
                    <div className="ar-stat-label">平均难度系数</div>
                  </div>
                  <div className="ar-stat-card">
                    <div className="ar-stat-value" style={{ color: '#10b981' }}>{questionAnalysis.avg_discrimination?.toFixed(3) || '-'}</div>
                    <div className="ar-stat-label">平均区分度</div>
                  </div>
                </div>

                {/* 题目明细表 */}
                <div className="ar-card">
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                    📝 题目详细分析
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="ar-table">
                      <thead>
                        <tr>
                          <th>题号</th>
                          <th>题型</th>
                          <th>满分</th>
                          <th>平均分</th>
                          <th>得分率</th>
                          <th>难度</th>
                          <th>区分度</th>
                          <th>作答人数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questionAnalysis.questions && questionAnalysis.questions.map((q) => (
                          <tr key={q.question_id}>
                            <td style={{ fontWeight: 600, color: '#1e293b' }}>第{q.order}题</td>
                            <td>
                              <span className="ar-badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>
                                {q.question_type}
                              </span>
                            </td>
                            <td>{q.full_score}</td>
                            <td style={{ fontWeight: 600 }}>{q.avg_score?.toFixed(1)}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${q.score_rate}%`,
                                    height: '100%',
                                    background: q.score_rate >= 70 ? '#10b981' : q.score_rate >= 50 ? '#f59e0b' : '#dc2626',
                                    borderRadius: '3px',
                                  }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: q.score_rate >= 70 ? '#059669' : q.score_rate >= 50 ? '#d97706' : '#dc2626' }}>
                                  {q.score_rate?.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="ar-badge" style={{
                                background: q.difficulty < 0.3 ? 'rgba(16,185,129,0.1)' : q.difficulty < 0.7 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                color: q.difficulty < 0.3 ? '#059669' : q.difficulty < 0.7 ? '#d97706' : '#dc2626',
                              }}>
                                {q.difficulty_label}
                              </span>
                            </td>
                            <td>
                              <span className="ar-badge" style={{
                                background: q.discrimination >= 0.4 ? 'rgba(16,185,129,0.1)' : q.discrimination >= 0.3 ? 'rgba(59,130,246,0.1)' : q.discrimination >= 0.2 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                color: q.discrimination >= 0.4 ? '#059669' : q.discrimination >= 0.3 ? '#2563eb' : q.discrimination >= 0.2 ? '#d97706' : '#dc2626',
                              }}>
                                {q.discrimination_label}
                              </span>
                            </td>
                            <td>{q.total_answered}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* AI分析报告 */}
            {activeTab === 'ai_analysis' && (
              <div>
                {!report ? (
                  <div className="ar-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ fontSize: '64px', marginBottom: '20px', opacity: '0.3' }}>🤖</div>
                    <h3 style={{ color: '#64748b', marginBottom: '8px' }}>AI分析报告尚未生成</h3>
                    <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>点击下方按钮，AI将自动生成完整的课程考核评估报告</p>
                    <button className="ar-btn ar-btn-primary" onClick={generateReport} style={{ fontSize: '15px', padding: '12px 24px' }}>
                      🤖 生成AI分析报告
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* 整体评价 */}
                    <div className="ar-analysis-box">
                      <h4 style={{ margin: '0 0 8px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📊 整体评价
                      </h4>
                      <p style={{ margin: 0, color: '#475569', lineHeight: 1.8, fontSize: '14px' }}>
                        {report.ai_analysis?.overall_evaluation || '暂无整体评价数据'}
                      </p>
                    </div>

                    {/* 难度分析 */}
                    <div className="ar-analysis-box" style={{ borderLeftColor: '#f59e0b' }}>
                      <h4 style={{ margin: '0 0 8px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📈 试卷难度分析
                      </h4>
                      <p style={{ margin: 0, color: '#475569', lineHeight: 1.8, fontSize: '14px' }}>
                        {report.ai_analysis?.difficulty_analysis || '暂无难度分析数据'}
                      </p>
                    </div>

                    {/* 教学建议 */}
                    <div className="ar-card" style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 16px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        💡 教学建议
                      </h4>
                      {report.ai_analysis?.teaching_suggestions && report.ai_analysis.teaching_suggestions.length > 0 ? (
                        report.ai_analysis.teaching_suggestions.map((suggestion, idx) => (
                          <div key={idx} className="ar-suggestion-item">
                            <span style={{ fontSize: '20px' }}>💡</span>
                            <span style={{ color: '#475569', lineHeight: 1.6, fontSize: '14px' }}>{suggestion}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: '#94a3b8' }}>暂无教学建议</p>
                      )}
                    </div>

                    {/* 改进要点 */}
                    <div className="ar-card">
                      <h4 style={{ margin: '0 0 16px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎯 重点改进要点
                      </h4>
                      {report.ai_analysis?.improvement_points && report.ai_analysis.improvement_points.length > 0 ? (
                        <div>
                          {report.ai_analysis.improvement_points.map((point, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px',
                              background: point.priority === '高' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)',
                              borderRadius: '10px',
                              marginBottom: '8px',
                              borderLeft: `4px solid ${point.priority === '高' ? '#dc2626' : '#f59e0b'}`,
                            }}>
                              <span className="ar-badge" style={{
                                background: point.priority === '高' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                color: point.priority === '高' ? '#dc2626' : '#d97706',
                                flexShrink: 0,
                              }}>
                                {point.priority}优先级
                              </span>
                              <div>
                                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                                  第{point.question_order}题（{point.question_type}）得分率 {point.score_rate}%
                                </div>
                                <div style={{ color: '#64748b', fontSize: '13px' }}>{point.suggestion}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#94a3b8' }}>暂无改进要点，整体表现良好！</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 导出报告 */}
            {activeTab === 'export' && (
              <div className="ar-card">
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                  📥 导出评估报告
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
                  选择导出格式，系统将自动生成包含考情总览、题目分析、AI分析报告的完整评估文档
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>PDF格式</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>适合打印和正式提交</div>
                    <button className="ar-btn ar-btn-primary">导出PDF</button>
                  </div>

                  <div style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#10b981'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Excel格式</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>包含详细数据表格</div>
                    <button className="ar-btn" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>导出Excel</button>
                  </div>

                  <div style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📝</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Word格式</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>可编辑的完整报告</div>
                    <button className="ar-btn" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>导出Word</button>
                  </div>
                </div>

                <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(59,130,246,0.05)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>📋</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>报告内容包含</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        考情总览（应考/实考/缺考/平均分/及格率/优秀率/标准差）、分数段分布、考试基本信息、题目详细分析（得分率/难度/区分度）、AI整体评价、试卷难度分析、教学建议、重点改进要点
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AssessmentReport
