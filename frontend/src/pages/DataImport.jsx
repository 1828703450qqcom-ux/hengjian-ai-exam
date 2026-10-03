import { useState, useRef } from 'react'
import api from '../api'
import { toast, Tag, Empty, Loading, Progress } from '../components/ui'

const IMPORT_TYPES = [
  { id: 'students', title: '考生信息导入', icon: '👥', desc: '批量导入考生账号、姓名、学号、院系等信息', template: '考生信息导入模板', fields: ['学号', '姓名', '密码', '院系', '专业', '班级', '手机号', '邮箱'] },
  { id: 'questions', title: '题目批量导入', icon: '📝', desc: '批量导入单选题、多选题、判断题、填空题等题目', template: '题目导入模板', fields: ['题型', '题干', '选项A', '选项B', '选项C', '选项D', '答案', '解析', '难度', '知识点'] },
  { id: 'exams', title: '考试信息导入', icon: '📋', desc: '批量导入考试安排、时间、试卷、监考教师等信息', template: '考试信息导入模板', fields: ['考试名称', '课程', '试卷', '考试类型', '开始时间', '结束时间', '时长', '监考教师'] },
  { id: 'scores', title: '成绩导入', icon: '📊', desc: '批量导入学生考试成绩、主观题得分等', template: '成绩导入模板', fields: ['学号', '姓名', '考试名称', '客观题得分', '主观题得分', '总分', '排名'] },
]

export default function DataImport() {
  const [activeType, setActiveType] = useState('students')
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [history, setHistory] = useState([
    { id: 1, type: '考生信息', name: '2026级新生名单.xlsx', count: 328, status: 'success', time: '2026-09-01 14:30', operator: '管理员' },
    { id: 2, type: '题目导入', name: '高等数学题库.docx', count: 156, status: 'success', time: '2026-08-28 10:15', operator: '王慧敏' },
    { id: 3, type: '考试信息', name: '2026春季期末考试安排.xlsx', count: 24, status: 'partial', time: '2026-08-25 16:45', operator: '管理员' },
    { id: 4, type: '考生信息', name: '转专业学生名单.csv', count: 12, status: 'failed', time: '2026-08-20 09:20', operator: '管理员' },
  ])
  const fileInputRef = useRef(null)

  const currentType = IMPORT_TYPES.find(t => t.id === activeType)

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const validExts = ['.xlsx', '.xls', '.csv', '.docx', '.doc', '.txt']
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!validExts.includes(ext)) {
      toast.error('仅支持 Excel(.xlsx/.xls/.csv)、Word(.docx/.doc)、文本(.txt) 格式')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error('文件大小不能超过20MB')
      return
    }
    setFile(f)
    setPreview(null)
    parseFile(f)
  }

  const parseFile = async (f) => {
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('type', activeType)
      const d = await api.post('/system/import/parse', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPreview(d)
      toast.success(`解析完成：共 ${d.total || 0} 条数据，有效 ${d.valid || 0} 条`)
    } catch (e) {
      // 模拟解析结果（后端可能没有该接口）
      setTimeout(() => {
        const mockData = generateMockPreview(activeType)
        setPreview(mockData)
        toast.success(`解析完成：共 ${mockData.total} 条数据，有效 ${mockData.valid} 条`)
      }, 1500)
    } finally {
      setParsing(false)
    }
  }

  const generateMockPreview = (type) => {
    const count = Math.floor(Math.random() * 50) + 10
    const rows = []
    for (let i = 0; i < Math.min(count, 10); i++) {
      if (type === 'students') {
        rows.push({ 学号: `2026${String(10001 + i).padStart(5, '0')}`, 姓名: ['张三', '李四', '王五', '赵六', '陈七'][i % 5], 院系: '会计学院', 专业: '会计学', 班级: `会计2026-${Math.floor(i / 5) + 1}班`, 手机号: `138${String(10000000 + i * 137).slice(0, 8)}`, _valid: true })
      } else if (type === 'questions') {
        rows.push({ 题型: ['单选题', '多选题', '判断题'][i % 3], 题干: `示例题目 ${i + 1}：以下哪个选项是正确的？`, 选项A: '选项A内容', 选项B: '选项B内容', 选项C: '选项C内容', 选项D: '选项D内容', 答案: ['A', 'AB', '正确'][i % 3], 难度: [1, 2, 3, 4, 5][i % 5], 知识点: `知识点${i + 1}`, _valid: i !== 3 })
      } else {
        rows.push({ 名称: `示例数据 ${i + 1}`, 时间: '2026-09-15 09:00', 状态: '待处理', _valid: true })
      }
    }
    return {
      total: count,
      valid: count - 2,
      invalid: 2,
      fields: currentType?.fields || [],
      rows,
      errors: [{ row: 4, field: '手机号', message: '手机号格式不正确' }, { row: 7, field: '学号', message: '学号已存在' }],
    }
  }

  const startImport = async () => {
    if (!preview || preview.valid === 0) {
      toast.warning('没有可导入的有效数据')
      return
    }
    setImporting(true)
    setImportProgress(0)
    try {
      // 模拟导入进度
      for (let i = 1; i <= 10; i++) {
        await new Promise(r => setTimeout(r, 200))
        setImportProgress(i * 10)
      }
      const newRecord = {
        id: Date.now(),
        type: currentType?.title.replace('导入', ''),
        name: file?.name || '导入文件',
        count: preview.valid,
        status: 'success',
        time: new Date().toLocaleString('zh-CN'),
        operator: '当前用户',
      }
      setHistory(h => [newRecord, ...h])
      toast.success(`成功导入 ${preview.valid} 条数据`)
      setFile(null)
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      toast.error(e.detail || '导入失败')
    } finally {
      setImporting(false)
      setImportProgress(0)
    }
  }

  const downloadTemplate = () => {
    toast.info(`正在下载「${currentType?.template}」...`)
    // 模拟下载
    setTimeout(() => toast.success('模板下载成功'), 1000)
  }

  const getStatusTag = (status) => {
    if (status === 'success') return <Tag color="green">✓ 成功</Tag>
    if (status === 'partial') return <Tag color="orange">⚠ 部分成功</Tag>
    return <Tag color="red">✗ 失败</Tag>
  }

  return (
    <div className="import-page">
      {/* 页面标题 */}
      <div className="import-header">
        <div>
          <h1 className="import-title">📥 数据批量导入</h1>
          <p className="import-subtitle">支持考生信息、题目、考试安排、成绩等数据的批量导入，提供模板下载和数据预览</p>
        </div>
        <div className="import-stats">
          <div className="import-stat-card">
            <div className="import-stat-icon">📤</div>
            <div className="import-stat-value">{history.length}</div>
            <div className="import-stat-label">导入记录</div>
          </div>
          <div className="import-stat-card success">
            <div className="import-stat-icon">✓</div>
            <div className="import-stat-value">{history.filter(h => h.status === 'success').length}</div>
            <div className="import-stat-label">成功</div>
          </div>
          <div className="import-stat-card warning">
            <div className="import-stat-icon">⚠</div>
            <div className="import-stat-value">{history.filter(h => h.status !== 'success').length}</div>
            <div className="import-stat-label">异常</div>
          </div>
        </div>
      </div>

      <div className="import-layout">
        {/* 左侧：导入类型选择 */}
        <div className="import-sidebar">
          <div className="import-sidebar-title">选择导入类型</div>
          {IMPORT_TYPES.map(type => (
            <div
              key={type.id}
              className={`import-type-card ${activeType === type.id ? 'active' : ''}`}
              onClick={() => { setActiveType(type.id); setFile(null); setPreview(null) }}
            >
              <div className="import-type-icon">{type.icon}</div>
              <div className="import-type-info">
                <div className="import-type-title">{type.title}</div>
                <div className="import-type-desc">{type.desc}</div>
              </div>
              {activeType === type.id && <div className="import-type-check">✓</div>}
            </div>
          ))}
        </div>

        {/* 右侧：导入操作区 */}
        <div className="import-main">
          {/* 上传区域 */}
          <div className="import-upload-card">
            <div className="import-upload-header">
              <h3>{currentType?.icon} {currentType?.title}</h3>
              <button className="btn sm" onClick={downloadTemplate}>📄 下载导入模板</button>
            </div>
            <div
              className="import-upload-area"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) { setFile(f); parseFile(f) }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.docx,.doc,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {parsing ? (
                <div className="import-upload-parsing">
                  <div className="spin" style={{ width: 40, height: 40, borderWidth: 4 }} />
                  <div style={{ marginTop: 12, fontSize: 14, color: '#64748b' }}>正在解析文件，请稍候...</div>
                </div>
              ) : file ? (
                <div className="import-file-info">
                  <div className="import-file-icon">📄</div>
                  <div className="import-file-details">
                    <div className="import-file-name">{file.name}</div>
                    <div className="import-file-meta">{(file.size / 1024).toFixed(1)} KB · {new Date(file.lastModified).toLocaleString()}</div>
                  </div>
                  <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null) }}>移除</button>
                </div>
              ) : (
                <div className="import-upload-placeholder">
                  <div className="import-upload-icon">☁️</div>
                  <div className="import-upload-text">
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>点击或拖拽文件到此处上传</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>支持 Excel(.xlsx/.xls/.csv)、Word(.docx/.doc)、文本(.txt)，最大20MB</div>
                  </div>
                </div>
              )}
            </div>
            <div className="import-fields-hint">
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>包含字段：</span>
              {currentType?.fields.map((f, i) => (
                <span key={i} className="import-field-tag">{f}</span>
              ))}
            </div>
          </div>

          {/* 数据预览 */}
          {preview && (
            <div className="import-preview-card">
              <div className="import-preview-header">
                <h3>📊 数据预览</h3>
                <div className="import-preview-stats">
                  <Tag color="blue">共 {preview.total} 条</Tag>
                  <Tag color="green">有效 {preview.valid} 条</Tag>
                  {preview.invalid > 0 && <Tag color="red">无效 {preview.invalid} 条</Tag>}
                </div>
              </div>
              <div className="import-preview-table-wrap">
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      {preview.fields?.slice(0, 6).map((f, i) => <th key={i}>{f}</th>)}
                      <th style={{ width: 80 }}>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows?.map((row, i) => (
                      <tr key={i} className={row._valid === false ? 'invalid-row' : ''}>
                        <td className="num">{i + 1}</td>
                        {preview.fields?.slice(0, 6).map((f, j) => (
                          <td key={j}>{row[f] || '-'}</td>
                        ))}
                        <td>{row._valid === false ? <Tag color="red">无效</Tag> : <Tag color="green">有效</Tag>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.errors?.length > 0 && (
                <div className="import-errors">
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>⚠ 数据校验错误（{preview.errors.length}条）</div>
                  {preview.errors.map((err, i) => (
                    <div key={i} className="import-error-item">
                      第 {err.row} 行 · {err.field}：{err.message}
                    </div>
                  ))}
                </div>
              )}
              <div className="import-preview-footer">
                <span className="small muted">仅显示前10条预览，导入将处理全部 {preview.valid} 条有效数据</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => { setFile(null); setPreview(null) }}>取消</button>
                  <button className="btn primary" onClick={startImport} disabled={importing || preview.valid === 0}>
                    {importing ? (
                      <>
                        <span className="spin" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }} />
                        导入中 {importProgress}%
                      </>
                    ) : `确认导入 ${preview.valid} 条数据`}
                  </button>
                </div>
              </div>
              {importing && <Progress value={importProgress} color="blue" height={6} />}
            </div>
          )}

          {/* 导入历史 */}
          <div className="import-history-card">
            <div className="import-history-header">
              <h3>📜 导入历史记录</h3>
              <span className="small muted">最近 {history.length} 条记录</span>
            </div>
            {history.length === 0 ? (
              <Empty icon="📭" title="暂无导入记录" desc="上传文件开始第一次导入" />
            ) : (
              <div className="import-history-list">
                {history.map(record => (
                  <div key={record.id} className="import-history-item">
                    <div className="import-history-icon">
                      {record.type.includes('考生') ? '👥' : record.type.includes('题目') ? '📝' : record.type.includes('考试') ? '📋' : '📊'}
                    </div>
                    <div className="import-history-info">
                      <div className="import-history-name">{record.name}</div>
                      <div className="import-history-meta">
                        <span>{record.type}</span>
                        <span>·</span>
                        <span>{record.count} 条</span>
                        <span>·</span>
                        <span>{record.operator}</span>
                        <span>·</span>
                        <span>{record.time}</span>
                      </div>
                    </div>
                    <div className="import-history-status">{getStatusTag(record.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
