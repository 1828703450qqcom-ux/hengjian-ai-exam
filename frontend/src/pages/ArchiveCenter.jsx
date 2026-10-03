import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

const ArchiveCenter = () => {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedExam, setSelectedExam] = useState(null)
  const [materials, setMaterials] = useState(null)
  const [proctorLog, setProctorLog] = useState(null)
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    course_id: '',
    start_date: '',
    end_date: '',
  })
  const [activeTab, setActiveTab] = useState('exams') // exams/student/materials/proctor

  const fetchExams = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/exams-enhanced/archive/list?'
      const params = new URLSearchParams()
      if (searchParams.keyword) params.append('keyword', searchParams.keyword)
      if (searchParams.course_id) params.append('course_id', searchParams.course_id)
      if (searchParams.start_date) params.append('start_date', searchParams.start_date)
      if (searchParams.end_date) params.append('end_date', searchParams.end_date)
      url += params.toString()

      const res = await api.get(url)
      setExams(res.data?.exams || res.data?.items || [])
    } catch (e) {
      console.error('获取归档列表失败', e)
    }
    setLoading(false)
  }, [searchParams])

  useEffect(() => {
    fetchExams()
  }, [fetchExams])

  const fetchMaterials = async (examId) => {
    try {
      const res = await api.get(`/exams-enhanced/archive/${examId}/materials`)
      setMaterials(res.data)
      setSelectedExam(examId)
      setActiveTab('materials')
    } catch (e) {
      console.error('获取归档材料失败', e)
    }
  }

  const fetchProctorLog = async (examId) => {
    try {
      const res = await api.get(`/exams-enhanced/archive/${examId}/proctor-log`)
      setProctorLog(res.data)
      setActiveTab('proctor')
    } catch (e) {
      console.error('获取监考日志失败', e)
    }
  }

  const handleSearch = () => {
    fetchExams()
  }

  const handleReset = () => {
    setSearchParams({ keyword: '', course_id: '', start_date: '', end_date: '' })
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  const materialIcons = {
    grade_sheet: '📊',
    grade_report: '📈',
    paper_package: '📦',
    login_log: '🔐',
    proctor_log: '🎥',
    proctor_video: '🎬',
  }

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <style>{`
        .archive-center .ac-card {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          padding: 20px;
        }
        .archive-center .ac-tab {
          padding: 10px 20px;
          border-radius: 10px 10px 0 0;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          color: #64748b;
          border-bottom: 3px solid transparent;
        }
        .archive-center .ac-tab:hover { color: #3b82f6; }
        .archive-center .ac-tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          background: rgba(59,130,246,0.05);
        }
        .archive-center .ac-btn {
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
        .archive-center .ac-btn-primary {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }
        .archive-center .ac-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .archive-center .ac-btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }
        .archive-center .ac-btn-secondary:hover { background: #e2e8f0; }
        .archive-center .ac-input {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          transition: border-color 0.2s;
        }
        .archive-center .ac-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .archive-center .ac-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .archive-center .ac-table th {
          background: #f8fafc;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        .archive-center .ac-table td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        .archive-center .ac-table tr:hover { background: #f8fafc; }
        .archive-center .ac-badge {
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .archive-center .material-item {
          display: flex;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
          margin-bottom: 12px;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .archive-center .material-item:hover {
          background: white;
          border-color: #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
      `}</style>

      <div className="archive-center">
        {/* 页面标题 */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📦 归档中心
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
            学生电子化考试数据档案室，按考试场次查询历史考试信息，按学号/姓名搜索成绩和答卷，支持打印学生答卷
          </p>
        </div>

        {/* 标签页 */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <div className={`ac-tab ${activeTab === 'exams' ? 'active' : ''}`} onClick={() => setActiveTab('exams')}>
            📋 考试归档列表
          </div>
          <div className={`ac-tab ${activeTab === 'student' ? 'active' : ''}`} onClick={() => setActiveTab('student')}>
            🔍 学生成绩查询
          </div>
          {selectedExam && (
            <div className={`ac-tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
              📦 归档材料包
            </div>
          )}
          {selectedExam && (
            <div className={`ac-tab ${activeTab === 'proctor' ? 'active' : ''}`} onClick={() => setActiveTab('proctor')}>
              🎥 监考日志
            </div>
          )}
        </div>

        {/* 考试归档列表 */}
        {activeTab === 'exams' && (
          <div>
            {/* 搜索筛选 */}
            <div className="ac-card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>考试名称关键字</label>
                  <input
                    className="ac-input"
                    placeholder="输入考试名称关键字"
                    value={searchParams.keyword}
                    onChange={(e) => setSearchParams({ ...searchParams, keyword: e.target.value })}
                    style={{ width: '200px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>开始日期</label>
                  <input
                    className="ac-input"
                    type="date"
                    value={searchParams.start_date}
                    onChange={(e) => setSearchParams({ ...searchParams, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>结束日期</label>
                  <input
                    className="ac-input"
                    type="date"
                    value={searchParams.end_date}
                    onChange={(e) => setSearchParams({ ...searchParams, end_date: e.target.value })}
                  />
                </div>
                <button className="ac-btn ac-btn-primary" onClick={handleSearch}>
                  🔍 搜索
                </button>
                <button className="ac-btn ac-btn-secondary" onClick={handleReset}>
                  重置
                </button>
              </div>
            </div>

            {/* 考试列表 */}
            <div className="ac-card">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>加载中...</div>
              ) : exams.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📦</div>
                  <p style={{ fontSize: '15px' }}>暂无归档考试</p>
                  <p style={{ fontSize: '13px' }}>考试结束并完成阅卷后将自动归档</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="ac-table">
                    <thead>
                      <tr>
                        <th>考试名称</th>
                        <th>课程</th>
                        <th>类型</th>
                        <th>考试时间</th>
                        <th>应考/实考</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.map((exam) => (
                        <tr key={exam.id}>
                          <td style={{ fontWeight: 600, color: '#1e293b' }}>{exam.title}</td>
                          <td>{exam.course || '-'}</td>
                          <td>
                            <span className="ac-badge" style={{
                              background: exam.exam_type === 'online' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                              color: exam.exam_type === 'online' ? '#2563eb' : '#059669',
                            }}>
                              {exam.exam_type === 'online' ? '在线考试' : '纸笔考试'}
                            </span>
                          </td>
                          <td>{formatDate(exam.start_time)}</td>
                          <td>{exam.participants || 0} / {exam.submitted || 0}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="ac-btn ac-btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => fetchMaterials(exam.id)}>
                                📦 材料包
                              </button>
                              <button className="ac-btn ac-btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => fetchProctorLog(exam.id)}>
                                🎥 监考日志
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 学生成绩查询 */}
        {activeTab === 'student' && (
          <StudentSearch />
        )}

        {/* 归档材料包 */}
        {activeTab === 'materials' && materials && (
          <div className="ac-card">
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
              📦 {materials.exam_title} - 归档材料包
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              考试结束后系统自动生成归档材料，包括成绩单、成绩报告、试卷包、登录日志、监考日志等，可一键下载压缩材料包
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {Object.entries(materials.materials || {}).map(([key, mat]) => (
                <div key={key} className="material-item">
                  <div style={{ fontSize: '32px', marginRight: '16px' }}>
                    {materialIcons[mat.type] || '📄'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px', marginBottom: '4px' }}>
                      {key}
                      {!mat.available && (
                        <span className="ac-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', marginLeft: '8px' }}>
                          暂不可用
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                      {mat.description}
                    </div>
                    {mat.count !== undefined && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        共 {mat.count} 条记录
                      </div>
                    )}
                  </div>
                  {mat.available && (
                    <button className="ac-btn ac-btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                      ⬇️ 下载
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(59,130,246,0.05)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>📦</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>一键下载压缩材料包</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>将所有归档材料打包为ZIP文件下载，包含成绩单、成绩报告、试卷包、登录日志、监考日志等</div>
                </div>
                <button className="ac-btn ac-btn-primary">
                  📦 一键下载全部
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 监考日志 */}
        {activeTab === 'proctor' && proctorLog && (
          <div className="ac-card">
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
              🎥 监考日志 - 共 {proctorLog.total_events} 条事件
            </h3>

            {proctorLog.events && proctorLog.events.length > 0 ? (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {proctorLog.events.map((event, idx) => (
                  <div key={event.id || idx} style={{
                    display: 'flex',
                    padding: '12px',
                    borderBottom: '1px solid #f1f5f9',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      marginTop: '6px',
                      background: event.severity === 'critical' ? '#dc2626' : event.severity === 'high' ? '#f59e0b' : event.severity === 'medium' ? '#3b82f6' : '#10b981',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
                          {event.student_name} - {event.event_type}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {formatDate(event.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        置信度: {Math.round((event.confidence || 0) * 100)}% | 严重程度: {event.severity} | 来源: {event.source}
                      </div>
                      {event.detail && typeof event.detail === 'object' && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                          {JSON.stringify(event.detail)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
                <p>本场考试无异常事件记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 学生成绩查询子组件
const StudentSearch = () => {
  const [searchType, setSearchType] = useState('student_no')
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!searchValue.trim()) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchType === 'student_no') params.append('student_no', searchValue)
      else params.append('student_name', searchValue)
      const res = await api.get(`/exams-enhanced/archive/student-search?${params.toString()}`)
      setResults(res.data?.students || [])
    } catch (e) {
      console.error('学生查询失败', e)
    }
    setLoading(false)
  }

  return (
    <div className="ac-card">
      <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
        🔍 学生成绩查询
      </h3>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
        通过学号或姓名搜索学生的所有课程成绩和答卷，支持打印学生答卷
      </p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select className="ac-input" value={searchType} onChange={(e) => setSearchType(e.target.value)} style={{ width: '120px' }}>
          <option value="student_no">学号</option>
          <option value="student_name">姓名</option>
        </select>
        <input
          className="ac-input"
          placeholder={searchType === 'student_no' ? '请输入学号' : '请输入姓名'}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1 }}
        />
        <button className="ac-btn ac-btn-primary" onClick={handleSearch}>
          🔍 查询
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>查询中...</div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>👤</div>
          <p>请输入学号或姓名进行查询</p>
        </div>
      ) : (
        <div>
          {results.map((student) => (
            <div key={student.student_id} style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>{student.name}</span>
                  <span style={{ marginLeft: '12px', color: '#64748b', fontSize: '13px' }}>学号: {student.student_no || '-'}</span>
                  <span style={{ marginLeft: '12px', color: '#64748b', fontSize: '13px' }}>{student.college || ''} {student.major || ''}</span>
                </div>
                <span className="ac-badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>
                  共 {student.exam_count} 场考试
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="ac-table">
                  <thead>
                    <tr>
                      <th>考试名称</th>
                      <th>成绩</th>
                      <th>状态</th>
                      <th>交卷时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.exams && student.exams.map((exam) => (
                      <tr key={exam.exam_id}>
                        <td style={{ fontWeight: 500 }}>{exam.exam_title}</td>
                        <td>
                          <span style={{
                            fontWeight: 700,
                            fontSize: '16px',
                            color: exam.score >= 60 ? '#059669' : '#dc2626',
                          }}>
                            {exam.score !== null && exam.score !== undefined ? exam.score : '-'}
                          </span>
                        </td>
                        <td>
                          <span className="ac-badge" style={{
                            background: exam.status === 'graded' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                            color: exam.status === 'graded' ? '#059669' : '#d97706',
                          }}>
                            {exam.status === 'graded' ? '已评阅' : exam.status === 'submitted' ? '待评阅' : exam.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>{exam.submit_time ? new Date(exam.submit_time).toLocaleString('zh-CN') : '-'}</td>
                        <td>
                          <button className="ac-btn ac-btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>
                            📄 查看答卷
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ArchiveCenter
